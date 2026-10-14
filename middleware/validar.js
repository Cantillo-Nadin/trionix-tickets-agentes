import Joi from "joi";
import { HttpError } from "./errores.js";

export const ES_OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Mensajes de Joi en español
const MENSAJES = {
  "any.required": "{{#label}} es obligatorio",
  "string.base": "{{#label}} debe ser texto",
  "string.empty": "{{#label}} no puede estar vacío",
  "string.min": "{{#label}} debe tener al menos {{#limit}} caracteres",
  "string.max": "{{#label}} no puede superar los {{#limit}} caracteres",
  "string.email": "{{#label}} debe ser un correo con formato válido",
  "any.only": "{{#label}} debe ser uno de {{#valids}}",
  "boolean.base": "{{#label}} debe ser true o false",
  "object.min": "Envía al menos un campo para actualizar",
  "object.base": "El cuerpo de la petición debe ser un objeto JSON",
};

// Valida los datos con un esquema de Joi.
// stripUnknown descarta los campos no declarados (así un "estado" enviado al crear nunca llega a la BD).
export function validar(schema, datos) {
  const { error, value } = schema.validate(datos ?? {}, {
    abortEarly: false,
    stripUnknown: true,
    messages: MENSAJES,
    errors: { wrap: { label: false } },
  });

  if (error) {
    const detalles = error.details.map((d) => ({ campo: d.path.join("."), mensaje: d.message }));
    throw new HttpError(400, detalles.map((d) => d.mensaje).join(". "), detalles);
  }
  return value;
}

export const idObjeto = Joi.string()
  .pattern(ES_OBJECT_ID)
  .messages({ "string.pattern.base": "{{#label}} no tiene formato de ObjectId válido" });