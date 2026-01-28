// Netlify Function: createTransaction
// Implementa aquí la creación REAL de la transacción en tu backend (Webpay/Transbank u otra pasarela).
// Requiere variables de entorno (commerce_code, api_key, environment) y librería oficial del proveedor.
//
// Debe retornar: { redirectUrl: "https://..." }

exports.handler = async (event) => {
  try{
    const body = JSON.parse(event.body || "{}");
    const { paymentId, checkoutId, amount, returnUrl } = body;

    if(!paymentId || !amount || !returnUrl){
      return { statusCode: 400, body: JSON.stringify({ error: "Faltan parámetros" }) };
    }

    // TODO: Crear transacción real con el SDK del proveedor.
    // Por ahora devolvemos error explícito para que se note que falta configuración.
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Webpay no está configurado aún. Configura la Netlify Function createTransaction con el SDK y credenciales."
      })
    };
  }catch(e){
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Error" }) };
  }
};
