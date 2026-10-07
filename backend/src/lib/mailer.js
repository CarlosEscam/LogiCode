// Envío de correos. Mientras no haya servidor de correo configurado,
// el mensaje se escribe en la consola de la API para poder probar el flujo.
export async function sendMail({ to, subject, text }) {
  console.log(`\n[correo] Para: ${to}\n[correo] Asunto: ${subject}\n${text}\n`);
}
