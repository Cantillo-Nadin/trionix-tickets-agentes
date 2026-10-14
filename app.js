import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { conectarDB } from "./db.js";
import ticketsRouter from "./routes/tickets.js";
import agentesRouter from "./routes/agentes.js";
import { HttpError, errorHandler } from "./middleware/errores.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/tickets", ticketsRouter);
app.use("/api/agentes", agentesRouter);

// Cualquier otra ruta de la API: 404 en JSON
app.use("/api", (req, res, next) => next(new HttpError(404, "Ruta no encontrada")));

// El manejo de errores va SIEMPRE al final
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

try {
  await conectarDB(); // primero la base de datos, después app.listen
  app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
} catch (err) {
  console.error("No se pudo iniciar:", err.message);
  process.exit(1);
}