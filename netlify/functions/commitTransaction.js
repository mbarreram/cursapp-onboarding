const {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus
} = require("transbank-sdk");

function getTx(){
  const env = (process.env.TBK_ENV || "Integration").toLowerCase();
  if(env === "production"){
    const commerceCode = process.env.TBK_COMMERCE_CODE;
    const apiKey = process.env.TBK_API_KEY;
    if(!commerceCode || !apiKey){
      throw new Error("Faltan TBK_COMMERCE_CODE / TBK_API_KEY");
    }
    return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, Environment.Production));
  }
  return new WebpayPlus.Transaction(new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  ));
}

function parseForm(body){
  const params = new URLSearchParams(body || "");
  return Object.fromEntries(params.entries());
}

function decodeBody(event){
  if(!event.body) return "";
  if(event.isBase64Encoded){
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

function redirect(url){
  return { statusCode: 302, headers: { Location: url } };
}

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const pid = qs.pid || "";
  const cid = qs.cid || "";

  const fail = (reason, extra) => {
    const msg = extra ? String(extra).slice(0, 180) : "";
    const loc = `/pay_result.html?ok=0&pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}&reason=${encodeURIComponent(reason||"unknown")}&msg=${encodeURIComponent(msg)}`;
    return redirect(loc);
  };

  try{
    const headers = event.headers || {};
    const ct = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();

    const rawBody = decodeBody(event);
    let token = (qs.token_ws || qs.token || "").trim();

    if(!token){
      if(ct.includes("application/json")){
        const b = JSON.parse(rawBody || "{}");
        token = (b.token_ws || b.token || "").trim();
      }else{
        const form = parseForm(rawBody || "");

        if(form.TBK_TOKEN || form.TBK_ORDEN_COMPRA || form.TBK_ID_SESION){
          return fail("cancelled", JSON.stringify({TBK_TOKEN: !!form.TBK_TOKEN, TBK_ORDEN_COMPRA: !!form.TBK_ORDEN_COMPRA}));
        }

        token = (form.token_ws || "").trim();
      }
    }

    if(!token){
      return fail("no_token_ws", `ct=${ct} base64=${!!event.isBase64Encoded} bodyLen=${(rawBody||"").length}`);
    }

    const tx = getTx();
    const resp = await tx.commit(token);

    const ok = String(resp.response_code) === "0";

    const loc = `/pay_result.html?ok=${ok?1:0}`
      + `&pid=${encodeURIComponent(pid)}`
      + `&cid=${encodeURIComponent(cid)}`
      + `&amount=${encodeURIComponent(resp.amount||"")}`
      + `&auth=${encodeURIComponent(resp.authorization_code||"")}`
      + `&resp=${encodeURIComponent(resp.response_code||"")}`
      + `&reason=${encodeURIComponent(ok?"approved":"rejected")}`;

    return redirect(loc);

  }catch(e){
    return fail("commit_error", e && e.message ? e.message : String(e));
  }
};
