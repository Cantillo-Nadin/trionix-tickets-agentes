import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    cliente: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    asunto: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    prioridad: { type: String, enum: ["baja", "media", "alta"], required: true },
    estado: { type: String, enum: ["abierto", "resuelto"], default: "abierto" },
    comentarios: [{ autor: String, texto: String, fecha: { type: Date, default: Date.now } }],
    agenteId: { type: mongoose.Schema.Types.ObjectId, ref: "Agente", default: null },
  },
  { timestamps: true }
);

// Bonus: índice compuesto. Acelera las consultas por agente y por estado.
ticketSchema.index({ agenteId: 1, estado: 1 });

const Ticket = mongoose.model("Ticket", ticketSchema);
export default Ticket;

// Campos del agente que se traen con populate
export const CAMPOS_AGENTE = "nombre especialidad";

// Convierte el ticket al JSON de la API: el campo se llama "agente" y es null si no hay nadie asignado
export function formatearTicket(doc) {
  const obj = doc.toObject({ versionKey: false });
  const { agenteId, ...resto } = obj;
  const agente = agenteId && agenteId._id ? agenteId : null;
  return { ...resto, agente };
}