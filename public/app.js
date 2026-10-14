/* Trionix Tickets - frontend. Consume la API con fetch, sin recargar la página. */

const $ = (selector) => document.querySelector(selector);

// Crea elementos del DOM sin usar innerHTML (así el texto del usuario nunca se interpreta como HTML).
function h(tag, props = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === false || valor == null) continue;
    if (clave === "class") nodo.className = valor;
    else if (clave.startsWith("on")) nodo.addEventListener(clave.slice(2).toLowerCase(), valor);
    else if (clave in nodo) nodo[clave] = valor;
    else nodo.setAttribute(clave, valor === true ? "" : valor);
  }
  for (const hijo of hijos.flat()) {
    if (hijo == null || hijo === false) continue;
    nodo.append(hijo.nodeType ? hijo : document.createTextNode(hijo));
  }
  return nodo;
}

/* ---------- Estado ---------- */
const estado = {
  tickets: [],
  agentes: [],
  comentariosAbiertos: new Set(), // ids de tickets con la sección de comentarios abierta
  confirmando: null,              // "ticket:<id>" o "agente:<id>" esperando segundo clic para eliminar
  ultimoAutor: "",
};

/* ---------- API ---------- */
async function api(url, { method = "GET", body } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }

  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.error || `La solicitud falló (código ${respuesta.status})`);
  }
  return datos;
}

/* ---------- Avisos ---------- */
function avisar(mensaje, tipo = "error") {
  const caja = $("#aviso");
  $("#aviso-texto").textContent = mensaje;
  caja.className = tipo === "ok" ? "aviso ok" : "aviso";
  caja.setAttribute("role", tipo === "ok" ? "status" : "alert");
  caja.hidden = false;
}
$("#aviso-cerrar").addEventListener("click", () => ($("#aviso").hidden = true));

// Ejecuta una acción y muestra el error de la API (400, 404, 409...) de forma legible.
async function intentar(accion, mensajeOk) {
  try {
    await accion();
    if (mensajeOk) avisar(mensajeOk, "ok");
    else $("#aviso").hidden = true;
    return true;
  } catch (err) {
    avisar(err.message, "error");
    return false;
  }
}

/* ---------- Carga de datos ---------- */
async function cargarTickets() {
  estado.tickets = await api("/api/tickets");
  renderTickets();
}

async function cargarAgentes() {
  estado.agentes = await api("/api/agentes");
  renderAgentes();
  renderTickets(); // los <select> de asignación dependen de los agentes activos
}

function reemplazarTicket(ticket) {
  const i = estado.tickets.findIndex((t) => t._id === ticket._id);
  if (i >= 0) estado.tickets[i] = ticket;
  else estado.tickets.unshift(ticket);
  renderTickets();
}

/* ---------- Render: tickets ---------- */
const formatoFecha = (iso) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function renderResumen() {
  const total = estado.tickets.length;
  const abiertos = estado.tickets.filter((t) => t.estado === "abierto").length;
  const sinAsignar = estado.tickets.filter((t) => t.estado === "abierto" && !t.agente).length;
  $("#resumen").textContent =
    total === 0
      ? "Todavía no hay tickets"
      : `${abiertos} abiertos, ${total - abiertos} resueltos, ${sinAsignar} abiertos sin asignar`;
}

function renderTickets() {
  renderResumen();

  const fEstado = $("#filtro-estado").value;
  const fPrioridad = $("#filtro-prioridad").value;
  const visibles = estado.tickets.filter(
    (t) => (!fEstado || t.estado === fEstado) && (!fPrioridad || t.prioridad === fPrioridad)
  );

  const contenedor = $("#lista-tickets");
  contenedor.replaceChildren();

  if (visibles.length === 0) {
    contenedor.append(
      h("p", { class: "vacio-estado" },
        estado.tickets.length === 0
          ? "Aún no hay tickets. Crea el primero desde el formulario “Nuevo ticket”."
          : "Ningún ticket coincide con los filtros elegidos.")
    );
    return;
  }

  contenedor.append(...visibles.map(renderTicket));
}

function renderTicket(t) {
  const claveEliminar = `ticket:${t._id}`;
  const abierto = t.estado === "abierto";

  const select = h("select", { "aria-label": `Agente para el ticket “${t.asunto}”` },
    h("option", { value: "" }, "Elegir agente"),
    estado.agentes
      .filter((a) => a.activo)
      .map((a) => h("option", { value: a._id, selected: t.agente?._id === a._id }, `${a.nombre} (${a.especialidad})`))
  );

  const comentariosAbiertos = estado.comentariosAbiertos.has(t._id);

  return h("article", { class: `ticket p-${t.prioridad} ${t.estado}` },
    h("div", { class: "ticket-cabecera" },
      h("h3", { class: "ticket-asunto" }, t.asunto),
      h("div", { class: "etiquetas" },
        h("span", { class: `etiqueta ${t.prioridad}` }, `Prioridad ${t.prioridad}`),
        h("span", { class: `etiqueta ${t.estado}` }, abierto ? "Abierto" : "Resuelto")
      )
    ),
    h("p", { class: "meta" }, `Cliente: ${t.cliente}. Creado el ${formatoFecha(t.createdAt)}.`),
    t.agente
      ? h("p", { class: "agente-asignado" }, `Atiende: ${t.agente.nombre} (${t.agente.especialidad})`)
      : h("p", { class: "agente-asignado vacio" }, "Sin asignar"),

    h("div", { class: "acciones" },
      h("div", { class: "asignar" },
        select,
        h("button", { type: "button", class: "btn", onClick: () => asignarAgente(t, select.value) }, "Asignar")
      ),
      h("button", {
        type: "button", class: "btn",
        onClick: () => cambiarEstado(t, abierto ? "resuelto" : "abierto"),
      }, abierto ? "Marcar como resuelto" : "Reabrir"),
      h("button", {
        type: "button", class: "btn", "aria-expanded": String(comentariosAbiertos),
        onClick: () => alternarComentarios(t._id),
      }, `Comentarios (${t.comentarios.length})`),
      estado.confirmando === claveEliminar
        ? [
            h("button", { type: "button", class: "btn btn-peligro confirmar", onClick: () => eliminarTicket(t) }, "Sí, eliminar"),
            h("button", { type: "button", class: "btn", onClick: () => pedirConfirmacion(null) }, "Cancelar"),
          ]
        : h("button", { type: "button", class: "btn btn-peligro", onClick: () => pedirConfirmacion(claveEliminar) }, "Eliminar")
    ),

    comentariosAbiertos ? renderComentarios(t) : null
  );
}

function renderComentarios(t) {
  const autor = h("input", { required: true, minlength: "2", maxlength: "100", value: estado.ultimoAutor, autocomplete: "off" });
  const texto = h("textarea", { required: true, minlength: "3", maxlength: "1000" });

  const formulario = h("form", { class: "comentario-form" },
    h("label", {}, "Tu nombre", autor),
    h("label", {}, "Comentario", texto),
    h("button", { type: "submit", class: "btn btn-primario" }, "Agregar comentario")
  );
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    estado.ultimoAutor = autor.value.trim();
    await intentar(async () => {
      const actualizado = await api(`/api/tickets/${t._id}/comentarios`, {
        method: "POST",
        body: { autor: autor.value, texto: texto.value },
      });
      reemplazarTicket(actualizado);
    }, "Comentario agregado");
  });

  return h("div", { class: "comentarios" },
    t.comentarios.length === 0
      ? h("p", { class: "meta" }, "Este ticket todavía no tiene comentarios.")
      : h("ul", {},
          t.comentarios.map((c) =>
            h("li", {}, h("span", { class: "meta" }, `${c.autor}, ${formatoFecha(c.fecha)}`), c.texto)
          )),
    formulario
  );
}

/* ---------- Acciones sobre tickets ---------- */
function pedirConfirmacion(clave) {
  estado.confirmando = clave;
  renderTickets();
  renderAgentes();
}

function alternarComentarios(id) {
  if (estado.comentariosAbiertos.has(id)) estado.comentariosAbiertos.delete(id);
  else estado.comentariosAbiertos.add(id);
  renderTickets();
}

async function asignarAgente(ticket, agenteId) {
  if (!agenteId) return avisar("Elige un agente de la lista antes de asignar.", "error");
  await intentar(async () => {
    const actualizado = await api(`/api/tickets/${ticket._id}/asignar`, { method: "POST", body: { agenteId } });
    reemplazarTicket(actualizado);
  }, `Ticket asignado a ${estado.agentes.find((a) => a._id === agenteId)?.nombre ?? "el agente"}`);
}

async function cambiarEstado(ticket, nuevoEstado) {
  await intentar(async () => {
    const actualizado = await api(`/api/tickets/${ticket._id}`, { method: "PUT", body: { estado: nuevoEstado } });
    reemplazarTicket(actualizado);
  }, nuevoEstado === "resuelto" ? "Ticket marcado como resuelto" : "Ticket reabierto");
}

async function eliminarTicket(ticket) {
  estado.confirmando = null;
  await intentar(async () => {
    await api(`/api/tickets/${ticket._id}`, { method: "DELETE" });
    estado.tickets = estado.tickets.filter((t) => t._id !== ticket._id);
    estado.comentariosAbiertos.delete(ticket._id);
    renderTickets();
  }, "Ticket eliminado");
}

/* ---------- Render y acciones: agentes ---------- */
function renderAgentes() {
  const lista = $("#lista-agentes");
  lista.replaceChildren();

  if (estado.agentes.length === 0) {
    lista.append(h("li", { class: "meta" }, "No hay agentes registrados. Registra uno para poder asignar tickets."));
    return;
  }

  for (const a of estado.agentes) {
    const clave = `agente:${a._id}`;
    lista.append(
      h("li", { class: a.activo ? "" : "inactivo" },
        h("span", { class: "agente-nombre" }, a.nombre),
        h("span", { class: "meta" }, `${a.especialidad}, ${a.email}${a.activo ? "" : " (inactivo)"}`),
        h("div", { class: "agente-acciones" },
          h("button", { type: "button", class: "btn", onClick: () => alternarActivo(a) }, a.activo ? "Desactivar" : "Activar"),
          estado.confirmando === clave
            ? [
                h("button", { type: "button", class: "btn btn-peligro confirmar", onClick: () => eliminarAgente(a) }, "Sí, eliminar"),
                h("button", { type: "button", class: "btn", onClick: () => pedirConfirmacion(null) }, "Cancelar"),
              ]
            : h("button", { type: "button", class: "btn btn-peligro", onClick: () => pedirConfirmacion(clave) }, "Eliminar")
        )
      )
    );
  }
}

async function alternarActivo(agente) {
  await intentar(async () => {
    await api(`/api/agentes/${agente._id}`, { method: "PUT", body: { activo: !agente.activo } });
    await Promise.all([cargarAgentes(), cargarTickets()]);
  }, agente.activo ? `${agente.nombre} ahora está inactivo` : `${agente.nombre} ahora está activo`);
}

async function eliminarAgente(agente) {
  estado.confirmando = null;
  // Si el agente tiene tickets abiertos, la API responde 409 y se muestra el motivo.
  const ok = await intentar(async () => {
    await api(`/api/agentes/${agente._id}`, { method: "DELETE" });
    await Promise.all([cargarAgentes(), cargarTickets()]);
  }, `Agente ${agente.nombre} eliminado`);
  if (!ok) pedirConfirmacion(null);
}

/* ---------- Formularios ---------- */
function manejarFormulario(formulario, accion, mensajeOk) {
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = formulario.querySelector("button[type=submit]");
    boton.disabled = true;
    const datos = Object.fromEntries(new FormData(formulario));
    const ok = await intentar(() => accion(datos), mensajeOk);
    boton.disabled = false;
    if (ok) formulario.reset();
  });
}

manejarFormulario(
  $("#form-ticket"),
  async (datos) => reemplazarTicket(await api("/api/tickets", { method: "POST", body: datos })),
  "Ticket creado"
);

manejarFormulario(
  $("#form-agente"),
  async (datos) => {
    await api("/api/agentes", { method: "POST", body: datos });
    await cargarAgentes();
  },
  "Agente registrado"
);

$("#filtro-estado").addEventListener("change", renderTickets);
$("#filtro-prioridad").addEventListener("change", renderTickets);

/* ---------- Inicio ---------- */
(async function iniciar() {
  const ok = await intentar(() => Promise.all([cargarAgentes(), cargarTickets()]));
  if (!ok) $("#resumen").textContent = "No se pudieron cargar los datos";
})();