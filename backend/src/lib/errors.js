// Error con código HTTP y mensaje que sí se puede mostrar al usuario.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}
