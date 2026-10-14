# Trionix Tickets: sistema de soporte con agentes

**Estudiante:** Nadin Cantillo
**Materia:** Desarrollo Web Backend (Node.js), parcial del segundo corte
**URL pública:** https://trionix-tickets-agentes-vhbc.onrender.com

## Descripción

Aplicación completa para registrar tickets de soporte técnico y llevar el control de los agentes que los atienden.

- **API REST** con Node.js y Express, con validación de entrada usando Joi.
- **Base de datos** MongoDB con Mongoose, con dos colecciones (`tickets` y `agentes`) relacionadas por una referencia (`agenteId`).
- **Asignación** de un agente a un ticket, validando que ambos existan y que el agente esté activo.
- **Frontend** en HTML, CSS y JavaScript plano, servido con `express.static`, que consume la API con `fetch` sin recargar la página.
- **Despliegue** en Render, con MongoDB Atlas como base de datos en producción.

## Cómo correrlo localmente

Requisitos: Node.js 20 o superior y una base de datos MongoDB (por ejemplo, un cluster gratuito de Atlas).

1. Clonar el repositorio e instalar dependencias:
```bash
   npm install
```
2. Copiar `.env.example` como `.env` y completar `MONGODB_URI` con la cadena de conexión.
3. Iniciar el servidor:
```bash
   npm run dev
```
4. Abrir http://localhost:3000

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `MONGODB_URI` | Cadena de conexión de MongoDB (en producción, MongoDB Atlas) |
| `PORT` | Puerto del servidor (en producción lo asigna Render) |

El archivo `.env` no se sube al repositorio. Solo se sube `.env.example`, sin valores reales.

## Endpoints

### Tickets

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/tickets` | Lista tickets (filtros opcionales `?estado=`, `?prioridad=`, `?q=`) |
| GET | `/api/tickets/:id` | Un ticket con el agente asignado resuelto |
| POST | `/api/tickets` | Crea un ticket (el estado siempre nace `abierto`) |
| PUT | `/api/tickets/:id` | Actualiza un ticket |
| DELETE | `/api/tickets/:id` | Elimina un ticket |
| POST | `/api/tickets/:id/comentarios` | Agrega un comentario embebido |
| POST | `/api/tickets/:id/asignar` | Asigna un agente: `{ "agenteId": "<id>" }` |

### Agentes

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/agentes` | Lista agentes (filtros opcionales `?especialidad=`, `?activo=`) |
| GET | `/api/agentes/stats` | Tickets abiertos y resueltos por agente (bonus) |
| GET | `/api/agentes/:id` | Un agente |
| POST | `/api/agentes` | Crea un agente (correo duplicado responde 400 con mensaje legible) |
| PUT | `/api/agentes/:id` | Actualiza un agente |
| DELETE | `/api/agentes/:id` | Elimina un agente (409 si tiene tickets abiertos asignados) |
| GET | `/api/agentes/:id/tickets` | Tickets asignados a ese agente |

Los errores responden siempre con la forma `{ "error": "mensaje legible" }`.

## Cómo se resuelve el agente en los tickets

El esquema del ticket declara `agenteId` con `ref: "Agente"`. Las consultas usan `.populate("agenteId", "nombre especialidad")` y la respuesta JSON entrega el resultado en un campo llamado `agente`, que vale `null` si el ticket no tiene agente asignado. Así el frontend no necesita una segunda petición.

## Estructura del proyecto

```
├── public/        frontend estático (index.html, styles.css, app.js)
├── models/        Ticket.js y Agente.js (Mongoose)
├── routes/        tickets.js y agentes.js
├── middleware/    errores.js y validar.js
├── db.js          conexión a MongoDB y creación de índices
├── app.js         arranque de Express
├── .env.example
└── README.md
```

## Partes bonus implementadas

- **Estadísticas por agente:** `GET /api/agentes/stats`, agregación con `$lookup` entre `agentes` y `tickets`.
- **Búsqueda:** `GET /api/tickets?q=texto`, búsqueda con `$regex` (sin distinguir mayúsculas) sobre `asunto` y `cliente`.
- **Índice compuesto** `{ agenteId: 1, estado: 1 }` en `tickets`. Sirve para las consultas que filtran por agente: la lista de tickets de un agente, la comprobación de tickets abiertos antes de eliminarlo y el `$lookup` de las estadísticas. Se indexa lo que se filtra con frecuencia.
