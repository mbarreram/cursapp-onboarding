
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

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const pid = qs.pid || "";
  const cid = qs.cid || "";

  try{
    const headers = event.headers || {};
    const ct = (headers["content-type"] || headers["Content-Type"] || "").toLowerCase();

    let token = "";
    if(ct.includes("application/json")){
      const b = JSON.parse(event.body || "{}");
      token = b.token_ws || b.token || "";
    }else{
      const form = parseForm(event.body || "");

      if(form.TBK_TOKEN || form.TBK_ORDEN_COMPRA || form.TBK_ID_SESION){
        return { statusCode: 302, headers: { Location: `/pay_result.html?ok=0&pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}` } };
      }

      token = form.token_ws || "";
    }

    if(!token){
      return { statusCode: 302, headers: { Location: `/pay_result.html?ok=0&pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}` } };
    }

    const tx = getTx();
    const resp = await tx.commit(token);

    const ok = String(resp.response_code) === "0";
    const loc = `/pay_result.html?ok=${ok?1:0}&pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}&amount=${encodeURIComponent(resp.amount||"")}&auth=${encodeURIComponent(resp.authorization_code||"")}&resp=${encodeURIComponent(resp.response_code||"")}`;

    return { statusCode: 302, headers: { Location: loc } };
  }catch(e){
    return { statusCode: 302, headers: { Location: `/pay_result.html?ok=0&pid=${encodeURIComponent(pid)}&cid=${encodeURIComponent(cid)}` } };
  }
};
