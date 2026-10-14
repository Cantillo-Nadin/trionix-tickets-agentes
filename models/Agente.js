import mongoose from "mongoose";

const agenteSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    especialidad: { type: String, enum: ["redes", "software", "hardware", "general"], required: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Agente", agenteSchema);