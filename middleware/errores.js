// Error con código HTTP propio, para lanzarlo desde las rutas
export class HttpError extends Error {
  constructor(status, message, detalles) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

// Todas las respuestas de error tienen la forma { error: "mensaje legible" }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ error: err.message, ...(err.detalles && { detalles: err.detalles }) });
  }

  // Correo duplicado: lo lanza MongoDB con code 11000 (no es un ValidationError de Mongoose)
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue ?? err.keyPattern ?? {})[0] ?? "valor";
    const valor = err.keyValue?.[campo];
    const mensaje =
      campo === "email"
        ? `Ya existe un agente registrado con el correo ${valor}`
        : `Ya existe un registro con ese ${campo}`;
    return res.status(400).json({ error: mensaje });
  }

  if (err.name === "ValidationError") {
    const mensajes = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: mensajes.join(". ") });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ error: `El valor de "${err.path}" no es válido` });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}