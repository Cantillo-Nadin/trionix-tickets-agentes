import { Router } from "express";
import Joi from "joi";
import Agente from "../models/Agente.js";
import Ticket, { CAMPOS_AGENTE, formatearTicket } from "../models/Ticket.js";
import { HttpError } from "../middleware/errores.js";
import { validar, ES_OBJECT_ID } from "../middleware/validar.js";

const router = Router();

/* ---------- Esquemas de Joi ---------- */
const ESPECIALIDADES = ["redes", "software", "hardware", "general"];

const crearAgente = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  especialidad: Joi.string().valid(...ESPECIALIDADES).required(),
  activo: Joi.boolean(),
});

const actualizarAgente = Joi.object({
  nombre: Joi.string().trim().min(3).max(100),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }),
  especialidad: Joi.string().valid(...ESPECIALIDADES),
  activo: Joi.boolean(),
}).min(1);

const filtros = Joi.object({
  especialidad: Joi.string().valid(...ESPECIALIDADES),
  activo: Joi.boolean(),
});

/* ---------- Utilidades ---------- */
router.param("id", (req, res, next, id) => {
  if (!ES_OBJECT_ID.test(id)) {
    return next(new HttpError(400, "El id del agente no tiene formato de ObjectId válido"));
  }
  next();
});

const noExiste = (id) => new HttpError(404, `No existe un agente con id ${id}`);

/* ---------- Rutas ---------- */

// GET /api/agentes?especialidad=&activo=
router.get("/", async (req, res) => {
  const { especialidad, activo } = validar(filtros, req.query);

  const filtro = {};
  if (especialidad) filtro.especialidad = especialidad;
  if (activo !== undefined) filtro.activo = activo;

  const agentes = await Agente.find(filtro).sort({ nombre: 1 });
  res.json(agentes);
});

// Bonus: GET /api/agentes/stats
// IMPORTANTE: va ANTES de "/:id", si no Express tomaría "stats" como un id
router.get("/stats", async (req, res) => {
  const stats = await Agente.aggregate([
    {
      $lookup: {
        from: "tickets",
        localField: "_id",
        foreignField: "agenteId",
        as: "tickets",
      },
    },
    {
      $project: {
        _id: 1,
        nombre: 1,
        especialidad: 1,
        activo: 1,
        abiertos: {
          $size: { $filter: { input: "$tickets", cond: { $eq: ["$$this.estado", "abierto"] } } },
        },
        resueltos: {
          $size: { $filter: { input: "$tickets", cond: { $eq: ["$$this.estado", "resuelto"] } } },
        },
      },
    },
    { $sort: { nombre: 1 } },
  ]);
  res.json(stats);
});

// GET /api/agentes/:id
router.get("/:id", async (req, res) => {
  const agente = await Agente.findById(req.params.id);
  if (!agente) throw noExiste(req.params.id);
  res.json(agente);
});

// POST /api/agentes  (si el correo existe, MongoDB lanza E11000 y errores.js lo vuelve un 400 legible)
router.post("/", async (req, res) => {
  const datos = validar(crearAgente, req.body);
  const agente = await Agente.create(datos);
  res.status(201).json(agente);
});

// PUT /api/agentes/:id
router.put("/:id", async (req, res) => {
  const datos = validar(actualizarAgente, req.body);
  const agente = await Agente.findByIdAndUpdate(
    req.params.id,
    { $set: datos },
    { new: true, runValidators: true }
  );
  if (!agente) throw noExiste(req.params.id);
  res.json(agente);
});

// DELETE /api/agentes/:id  (409 si tiene tickets abiertos asignados)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const agente = await Agente.exists({ _id: id });
  if (!agente) throw noExiste(id);

  const abiertos = await Ticket.countDocuments({ agenteId: id, estado: "abierto" });
  if (abiertos > 0) {
    throw new HttpError(
      409,
      `No se puede eliminar el agente: tiene ${abiertos} ticket(s) abierto(s) asignado(s). ` +
        "Resuélvelos o reasígnalos primero."
    );
  }

  await Agente.findByIdAndDelete(id);
  // Los tickets resueltos de este agente quedan sin asignar, para no dejar ids huérfanos
  await Ticket.updateMany({ agenteId: id }, { $set: { agenteId: null } });

  res.status(204).end();
});

// GET /api/agentes/:id/tickets
router.get("/:id/tickets", async (req, res) => {
  const { id } = req.params;
  const agente = await Agente.exists({ _id: id });
  if (!agente) throw noExiste(id);

  const tickets = await Ticket.find({ agenteId: id })
    .sort({ createdAt: -1 })
    .populate("agenteId", CAMPOS_AGENTE);

  res.json(tickets.map(formatearTicket));
});

export default router;