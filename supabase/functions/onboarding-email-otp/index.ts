import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SERVER_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TTL_SECONDS = 10 * 60;
const ALLOWED_ORIGINS = new Set([
  "https://micursox.cl",
  "https://www.micursox.cl",
  "https://cursapp-onboarding.pages.dev",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://micursox.cl";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textB64url(value: string) {
  return b64url(new TextEncoder().encode(value));
}

function fromB64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(padded);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

function decodeTextB64url(value: string) {
  return new TextDecoder().decode(fromB64url(value));
}

async function hmac(message: string) {
  if (!SERVER_KEY) throw new Error("Servidor OTP no configurado.");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVER_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", baseKey, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomOtp() {
  const max = 0xffffffff;
  const limit = max - (max % 900000);
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(100000 + (buf[0] % 900000));
}

async function makeChallenge(email: string, code: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const otpMac = await hmac(`otp|v1|${email}|${exp}|${nonce}|${code}`);
  const payload = textB64url(JSON.stringify({ v: 1, email, exp, nonce, otpMac }));
  const signature = await hmac(`challenge|${payload}`);
  return { challenge: `${payload}.${signature}`, exp };
}

async function parseChallenge(challenge: string) {
  const [payload, signature, extra] = String(challenge || "").split(".");
  if (!payload || !signature || extra) return null;
  const expected = await hmac(`challenge|${payload}`);
  if (!safeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(decodeTextB64url(payload));
    if (!data || data.v !== 1 || !data.email || !data.exp || !data.nonce || !data.otpMac) return null;
    return data as { v: number; email: string; exp: number; nonce: string; otpMac: string };
  } catch (_) {
    return null;
  }
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${"*".repeat(Math.max(2, local.length - shown.length))}@${domain}`;
}

function otpHtml(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#111827">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px">
    <div style="background:#fff;border-radius:22px;border:1px solid #e5e7eb;overflow:hidden">
      <div style="padding:24px 30px 20px;text-align:center;border-bottom:1px solid #ede9fe">
        <img src="https://micursox.cl/assets/brand/micursox-compact.svg" alt="MiCursoX" width="210" style="display:inline-block;max-width:210px;width:100%;height:auto;border:0">
      </div>
      <div style="padding:30px">
        <h1 style="font-size:26px;line-height:1.2;margin:0 0 14px;color:#111827">Verifica tu correo</h1>
        <p style="font-size:16px;line-height:1.6;color:#475569;margin:0">Usa este código para continuar tu registro en MiCursoX.</p>
        <div style="margin:26px 0;text-align:center">
          <div style="display:inline-block;letter-spacing:8px;font-size:34px;font-weight:800;color:#6d28d9;background:#faf8ff;border:1px solid #ddd6fe;border-radius:16px;padding:18px 22px">${code}</div>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#64748b;margin:0"><b>El código vence en 10 minutos.</b> Si no solicitaste este código, puedes ignorar este correo.</p>
      </div>
      <div style="background:#faf8ff;border-top:1px solid #ede9fe;padding:18px 30px;text-align:center">
        <div style="font-size:14px;font-weight:700;color:#6d28d9">MiCursoX</div>
        <div style="font-size:12px;line-height:1.5;color:#64748b;margin-top:5px">Gestión simple y segura para tu curso.</div>
      </div>
    </div>
  </div></body></html>`;
}

async function sendOtp(req: Request, email: string) {
  if (!RESEND_API_KEY) return json(req, { error: "Servicio de correo no configurado." }, 503);
  const code = randomOtp();
  const { challenge, exp } = await makeChallenge(email, code);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MiCursoX <notificaciones@micursox.cl>",
      to: [email],
      subject: "Tu código de verificación MiCursoX",
      html: otpHtml(code),
      text: `Tu código de verificación MiCursoX es ${code}. Vence en 10 minutos.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Resend OTP:", response.status, detail);
    return json(req, { error: "No se pudo enviar el código. Intenta nuevamente." }, 502);
  }

  return json(req, {
    ok: true,
    challenge,
    expires_in: TTL_SECONDS,
    expires_at: new Date(exp * 1000).toISOString(),
    email_masked: maskEmail(email),
  });
}

async function verifyOtp(req: Request, email: string, code: string, challenge: string) {
  if (!/^\d{6}$/.test(code)) return json(req, { error: "Ingresa los 6 dígitos del código." }, 400);
  const data = await parseChallenge(challenge);
  if (!data || data.email !== email) return json(req, { error: "El código no es válido. Solicita uno nuevo." }, 400);
  if (Math.floor(Date.now() / 1000) > Number(data.exp)) return json(req, { error: "El código expiró. Solicita uno nuevo." }, 410);
  const expected = await hmac(`otp|v1|${email}|${data.exp}|${data.nonce}|${code}`);
  if (!safeEqual(expected, String(data.otpMac))) return json(req, { error: "Código incorrecto." }, 400);

  return json(req, {
    ok: true,
    verified: true,
    email,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Number(data.exp) * 1000).toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return json(req, { error: "Correo inválido." }, 400);

    if (action === "send") return await sendOtp(req, email);
    if (action === "verify") return await verifyOtp(req, email, String(body.code || "").trim(), String(body.challenge || ""));
    return json(req, { error: "Acción inválida." }, 400);
  } catch (error) {
    console.error("Onboarding OTP:", error);
    return json(req, { error: "No fue posible procesar el código. Intenta nuevamente." }, 500);
  }
});
