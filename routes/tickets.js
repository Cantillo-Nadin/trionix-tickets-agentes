import { Router } from "express";
import Joi from "joi";
import Ticket, { CAMPOS_AGENTE, formatearTicket } from "../models/Ticket.js";
import Agente from "../models/Agente.js";
import { HttpError } from "../middleware/errores.js";
import { validar, idObjeto, ES_OBJECT_ID } from "../middleware/validar.js";

const router = Router();

/* ---------- Esquemas de Joi ---------- */
const PRIORIDADES = ["baja", "media", "alta"];
const ESTADOS = ["abierto", "resuelto"];

// Al crear, el estado NO se acepta: siempre nace "abierto"
const crearTicket = Joi.object({
  cliente: Joi.string().trim().min(2).max(100).required(),
  asunto: Joi.string().trim().min(5).max(200).required(),
  prioridad: Joi.string().valid(...PRIORIDADES).required(),
});

const actualizarTicket = Joi.object({
  cliente: Joi.string().trim().min(2).max(100),
  asunto: Joi.string().trim().min(5).max(200),
  prioridad: Joi.string().valid(...PRIORIDADES),
  estado: Joi.string().valid(...ESTADOS),
}).min(1);

const comentario = Joi.object({
  autor: Joi.string().trim().min(2).max(100).required(),
  texto: Joi.string().trim().min(3).max(1000).required(),
});

const asignar = Joi.object({
  agenteId: idObjeto.required(),
});

const filtros = Joi.object({
  estado: Joi.string().valid(...ESTADOS),
  prioridad: Joi.string().valid(...PRIORIDADES),
  q: Joi.string().trim().max(100), // bonus: búsqueda
});

/* ---------- Utilidades ---------- */

// Todos los :id de este router deben tener formato de ObjectId (400 si no)
router.param("id", (req, res, next, id) => {
  if (!ES_OBJECT_ID.test(id)) {
    return next(new HttpError(400, "El id del ticket no tiene formato de ObjectId válido"));
  }
  next();
});

const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const noExiste = (id) => new HttpError(404, `No existe un ticket con id ${id}`);

/* ---------- Rutas ---------- */

// GET /api/tickets?estado=&prioridad=&q=
router.get("/", async (req, res) => {
  const { estado, prioridad, q } = validar(filtros, req.query);

  const filtro = {};
  if (estado) filtro.estado = estado;
  if (prioridad) filtro.prioridad = prioridad;
  if (q) {
    const regex = { $regex: escaparRegex(q), $options: "i" };
    filtro.$or = [{ asunto: regex }, { cliente: regex }];
  }

  const tickets = await Ticket.find(filtro)
    .sort({ createdAt: -1 })
    .populate("agenteId", CAMPOS_AGENTE);

  res.json(tickets.map(formatearTicket));
});

// GET /api/tickets/:id
router.get("/:id", async (req, res) => {
  const ticket = await Ticket.findById(req.params.id).populate("agenteId", CAMPOS_AGENTE);
  if (!ticket) throw noExiste(req.params.id);
  res.json(formatearTicket(ticket));
});

// POST /api/tickets
router.post("/", async (req, res) => {
  const datos = validar(crearTicket, req.body);
  const ticket = await Ticket.create(datos);
  res.status(201).json(formatearTicket(ticket));
});

// PUT /api/tickets/:id
router.put("/:id", async (req, res) => {
  const datos = validar(actualizarTicket, req.body);
  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    { $set: datos },
    { new: true, runValidators: true }
  ).populate("agenteId", CAMPOS_AGENTE);

  if (!ticket) throw noExiste(req.params.id);
  res.json(formatearTicket(ticket));
});

// DELETE /api/tickets/:id
router.delete("/:id", async (req, res) => {
  const eliminado = await Ticket.findByIdAndDelete(req.params.id);
  if (!eliminado) throw noExiste(req.params.id);
  res.status(204).end();
});

// POST /api/tickets/:id/comentarios
router.post("/:id/comentarios", async (req, res) => {
  const datos = validar(comentario, req.body);
  const ticket = await Ticket.findByIdAndUpdate(
    req.params.id,
    { $push: { comentarios: datos } },
    { new: true, runValidators: true }
  ).populate("agenteId", CAMPOS_AGENTE);

  if (!ticket) throw noExiste(req.params.id);
  res.status(201).json(formatearTicket(ticket));
});

// POST /api/tickets/:id/asignar   body: { "agenteId": "<id>" }
router.post("/:id/asignar", async (req, res) => {
  // 1) Formato de los dos ids (el del ticket ya lo validó router.param)
  const { agenteId } = validar(asignar, req.body);

  // 2) El ticket existe
  const ticket = await Ticket.exists({ _id: req.params.id });
  if (!ticket) throw noExiste(req.params.id);

  // 3) El agente existe y está activo
  const agente = await Agente.findById(agenteId);
  if (!agente) throw new HttpError(404, `No existe un agente con id ${agenteId}`);
  if (!agente.activo) {
    throw new HttpError(400, `El agente ${agente.nombre} está inactivo y no puede recibir tickets`);
  }

  // 4) Todo es válido: se escribe la asignación
  const actualizado = await Ticket.findByIdAndUpdate(
    req.params.id,
    { $set: { agenteId: agente._id } },
    { new: true, runValidators: true }
  ).populate("agenteId", CAMPOS_AGENTE);

  if (!actualizado) throw noExiste(req.params.id);
  res.status(200).json(formatearTicket(actualizado));
});

export default router;