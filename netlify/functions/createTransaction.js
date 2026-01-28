
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
  // Integración por defecto
  return new WebpayPlus.Transaction(new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  ));
}

exports.handler = async (event) => {
  try{
    const body = JSON.parse(event.body || "{}");
    const { amount, returnUrl, paymentId, checkoutId } = body;

    if(!amount || !returnUrl){
      return { statusCode: 400, body: JSON.stringify({ error: "Faltan parámetros (amount, returnUrl)" }) };
    }

    const tx = getTx();
    const buyOrder = ("O-" + (paymentId||"") + "-" + Date.now()).slice(0, 26);
    const sessionId = ("S-" + (checkoutId||"") + "-" + Date.now()).slice(0, 61);

    const resp = await tx.create(buyOrder, sessionId, amount, returnUrl);
    return { statusCode: 200, body: JSON.stringify({ token: resp.token, url: resp.url }) };
  }catch(e){
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Error" }) };
  }
};
