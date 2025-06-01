import React, { useState, useEffect, useRef } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

function getGoogleCalendarLink(event) {
  if (!event || !event.start || !event.end) return "#";
  const pad = (n) => n.toString().padStart(2, "0");
  // Google Calendar espera formato UTC, así que puedes ajustar la hora si quieres, aquí te lo dejo "a pelo" para España
  const formatDate = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
      d.getHours()
    )}${pad(d.getMinutes())}00Z`;
  const start = formatDate(event.start);
  const end = formatDate(event.end);

  const title = encodeURIComponent(event.title || "");
  const details = encodeURIComponent(
    `Instructor: ${event.instructor || ""}\nClientes: ${(event.clientsList || []).join(", ")}`
  );
  const location = encodeURIComponent("Buceo España - La Herradura");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}&sf=true&output=xml`;
}


// Configuración del localizador para semanas de lunes a domingo y en español
const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date, locale) => startOfWeek(date, { weekStartsOn: 1, locale: es }), // LUNES
  getDay,
  locales
});
const DnDCalendar = withDragAndDrop(Calendar);
const COLORS = ["#2196F3", "#43A047", "#000", "#FBC02D", "#FF5722", "#607D8B", "#9C27B0", "#25d366"];
const ACTIVITIES = [
  { text: "Open", color: COLORS[0] },
  { text: "Avanzado", color: COLORS[1] },
  { text: "Cueva", color: COLORS[2] },
  { text: "Nitrox", color: COLORS[3] },
  { text: "Profundo", color: COLORS[4] },
  { text: "Rescue", color: COLORS[5] }
];

// Frases motivadoras
const FRASES_MOTIVADORAS = [
  "Cada inmersión es una historia… y tu las agendas booom.",
  "¡El mejor instructor no es el que más sabe, es el que más disfruta! 🐙",
  "La vida es como el buceo, solo hay que fluir",
  "Si tienes dudas, huye hacia delante.",
  "Un día sin buceo es como un neopreno meao, un asco."
];

// Plantillas WhatsApp por defecto
const DEFAULT_TEMPLATES = [
  "¡Hola {nombre}! Recuerda que mañana tienes tu actividad \"{actividad}\" a las {hora}. ¡Nos vemos en el agua!",
  "¡Buenas, {nombre}! Te espero mañana para \"{actividad}\" a las {hora} con todo listo para bucear. ¡Vamos a disfrutar!",
  "No olvides tu cita para \"{actividad}\". Nos vemos a las {hora}, {nombre}.",
  "¡Hey {nombre}! Listo para \"{actividad}\" a las {hora}?"
];

function rellenarPlantilla(mensaje, datos) {
  return mensaje
    .replace("{nombre}", datos.nombre)
    .replace("{actividad}", datos.actividad)
    .replace("{hora}", datos.hora);
}

function crearLinkWhatsApp(telefono, mensaje) {
  const telefonoFormateado = telefono.startsWith("34") ? telefono : "34" + telefono.replace(/\D/g, "");
  const mensajeCodificado = encodeURIComponent(mensaje);
  return `https://wa.me/${telefonoFormateado}?text=${mensajeCodificado}`;
}

function guardarHistorialWhatsApp(center, cliente, mensaje, actividad, usuario = "") {
  const clave = `dive_manager_whatsapp_historial_${center}`;
  const old = JSON.parse(localStorage.getItem(clave) || "[]");
  old.push({
    fecha: new Date().toISOString(),
    cliente,
    mensaje,
    actividad,
    usuario
  });
  localStorage.setItem(clave, JSON.stringify(old));
}

// Oportunidades de venta
function registrarOportunidadVenta(center, cliente, curso, fecha) {
  const clave = `dive_manager_opportunities_${center}`;
  const old = JSON.parse(localStorage.getItem(clave) || "[]");
  old.push({
    fecha,
    cliente,
    curso,
    estado: "nuevo" // puede ser: nuevo, contactado, convertido, descartado
  });
  localStorage.setItem(clave, JSON.stringify(old));
}

// Colores automáticos por actividad
function getColorByTitle(title = "") {
  title = title.toLowerCase();
  if (title.includes("avanzado")) return COLORS[1];
  if (title.includes("cueva")) return COLORS[2];
  if (title.includes("nitrox")) return COLORS[3];
  if (title.includes("profundo")) return COLORS[4];
  if (title.includes("open")) return COLORS[0];
  if (title.includes("rescue")) return COLORS[5];
  return COLORS[7]; // WhatsApp verde por defecto
}

export default function SuperCalendar() {
  // HOOKS
  const [events, setEvents] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [instructorsList, setInstructorsList] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [fraseDia, setFraseDia] = useState("");
  const [waTemplates, setWaTemplates] = useState(DEFAULT_TEMPLATES);
  const [newWaTemplate, setNewWaTemplate] = useState("");
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [waClienteIdx, setWaClienteIdx] = useState(null);
  const [waPlantillaIdx, setWaPlantillaIdx] = useState(0);
  const [waMensaje, setWaMensaje] = useState("");
  const [waTelefono, setWaTelefono] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completarClientes, setCompletarClientes] = useState([]);
  const [newInstructor, setNewInstructor] = useState("");

  // Setup
  let center = "";
  if (typeof window !== "undefined") {
    center = localStorage.getItem("active_center") || "";
  }
  if (typeof window !== "undefined" && !center)
    return <p>Elige un centro</p>;
  if (typeof window === "undefined") return null;

  // Cargar datos iniciales
  useEffect(() => {
    // Plantillas WhatsApp
    const saved = localStorage.getItem(
      `dive_manager_whatsapp_templates_${center}`
    );
    if (saved) {
      setWaTemplates(JSON.parse(saved));
    } else {
      setWaTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem(
        `dive_manager_whatsapp_templates_${center}`,
        JSON.stringify(DEFAULT_TEMPLATES)
      );
    }
    // Eventos
    const rawEv = localStorage.getItem(
      `dive_manager_events_${center}`
    ) || "[]";
    setEvents(
      JSON.parse(rawEv).map((ev) => ({
        ...ev,
        start: new Date(ev.start),
        end: new Date(ev.end),
        instructor: ev.instructor || "",
        clientsList: ev.clientsList || [],
        color: ev.color || getColorByTitle(ev.title),
        capacity: ev.capacity || 6
      }))
    );
    // Clientes
    const rawClients = JSON.parse(
      localStorage.getItem(`dive_manager_clients_${center}`) || "[]"
    );
    setClientsList(rawClients.map((x) => x.name));
    // Instructores
    const rawInstructors = JSON.parse(
      localStorage.getItem(`dive_manager_instructors_${center}`) || "[]"
    );
    setInstructorsList(rawInstructors);
    // Frase motivadora
    setFraseDia(
      FRASES_MOTIVADORAS[Math.floor(Math.random() * FRASES_MOTIVADORAS.length)]
    );
  }, [center]);

  useEffect(() => {
    if (!center) return;
    localStorage.setItem(
      `dive_manager_whatsapp_templates_${center}`,
      JSON.stringify(waTemplates)
    );
  }, [waTemplates, center]);

  useEffect(() => {
    if (!center) return;
    localStorage.setItem(
      `dive_manager_events_${center}`,
      JSON.stringify(events)
    );
  }, [events, center]);

  useEffect(() => {
    if (!center) return;
    localStorage.setItem(
      `dive_manager_instructors_${center}`,
      JSON.stringify(instructorsList)
    );
  }, [instructorsList, center]);

  // Formatear fecha para input datetime-local
  const formatForInput = (date) => {
    const pad = (n) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Crear nuevo evento
  const handleSelectSlot = ({ start, end }) => {
   setSelectedEvent({
  title: "",
  start,
  end,
  instructor: "",
  clientsList: [],
  color: getColorByTitle(""),
  capacity: 6
});
    setShowEditForm(true);
  };

  // Mover evento drag&drop
  const moveEvent = ({ event, start, end }) => {
    setEvents(
      events.map((ev) =>
        ev.id === event.id ? { ...ev, start, end } : ev
      )
    );
  };

  // Seleccionar evento para editar
  const handleSelectEvent = (ev) => {
    setSelectedEvent({ ...ev, clientInput: "" });
    setShowEditForm(true);
  };

  // Añadir cliente a evento
  const addClient = () => {
    const name = selectedEvent.clientInput?.trim();
     if (
    name &&
    !selectedEvent.clientsList.includes(name)
  ) {
    setSelectedEvent((se) => ({
      ...se,
      clientsList: [...se.clientsList, name],
      clientInput: ""
    }));
  }
};
  // Eliminar cliente
  const removeClient = (idx) => {
    setSelectedEvent((se) => ({
      ...se,
      clientsList: se.clientsList.filter((_, i) => i !== idx)
    }));
  };

  // Guardar evento nuevo/editado
 const handleUpdateEvent = (e) => {
  e.preventDefault();
  if (!selectedEvent.title || !selectedEvent.title.trim()) {
    alert("Ponle un nombre al evento 😉");
    return;
  }
  // NO recalcules color aquí si el usuario ya lo ha elegido (¡eso ya lo hemos corregido!)
  if (selectedEvent.id) {
    setEvents(
      events.map((ev) =>
        ev.id === selectedEvent.id
          ? { ...selectedEvent }
          : ev
      )
    );
  } else {
    setEvents([
      ...events,
      {
        ...selectedEvent,
        id: Date.now(),
      }
    ]);
  }
  setShowEditForm(false);
};


  // Eliminar evento
  const handleDeleteEvent = () => {
    setEvents(events.filter((ev) => ev.id !== selectedEvent.id));
    setShowEditForm(false);
  };

  // WhatsApp MODAL
  const abrirWhatsAppModal = (idx) => {
    if (!selectedEvent) return;
    setWaClienteIdx(idx);
    setWaPlantillaIdx(0);
    const clienteNombre = selectedEvent.clientsList[idx];
    let telefono = "";
    const clientObj = JSON.parse(
      localStorage.getItem(`dive_manager_clients_${center}`) || "[]"
    ).find((x) => x.name === clienteNombre);
    if (clientObj)
      telefono = clientObj.phone || clientObj.telefono || "";
    setWaTelefono(telefono);
    const actividad = selectedEvent.title.split("(")[0].trim();
    const hora =
      selectedEvent.start instanceof Date
        ? selectedEvent.start.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          })
        : "";
    const plantilla = waTemplates[0];
    setWaMensaje(
      rellenarPlantilla(plantilla, {
        nombre: clienteNombre,
        actividad,
        hora
      })
    );
  };
  const cambiarPlantilla = (idx) => {
    setWaPlantillaIdx(idx);
    if (selectedEvent && waClienteIdx !== null) {
      const clienteNombre = selectedEvent.clientsList[waClienteIdx];
      const actividad = selectedEvent.title.split("(")[0].trim();
      const hora =
        selectedEvent.start instanceof Date
          ? selectedEvent.start.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            })
          : "";
      setWaMensaje(
        rellenarPlantilla(waTemplates[idx], {
          nombre: clienteNombre,
          actividad,
          hora
        })
      );
    }
  };
  const handleEnviarWhatsApp = () => {
    const telefono = waTelefono || "";
    if (!telefono) {
      alert("No se ha encontrado el teléfono del cliente.");
      return;
    }
    const link = crearLinkWhatsApp(telefono, waMensaje);
    if (selectedEvent && waClienteIdx !== null) {
      const clienteNombre = selectedEvent.clientsList[waClienteIdx];
      guardarHistorialWhatsApp(
        center,
        clienteNombre,
        waMensaje,
        selectedEvent.title,
        "David"
      );
    }
    window.open(link, "_blank");
    setWaClienteIdx(null);
  };
  const cerrarWhatsAppModal = () => setWaClienteIdx(null);

  // Gestión plantillas WhatsApp
  const handleAddTemplate = () => {
    if (newWaTemplate.trim()) {
      setWaTemplates([...waTemplates, newWaTemplate.trim()]);
      setNewWaTemplate("");
    }
  };
  const handleDeleteTemplate = (idx) => {
    if (window.confirm("¿Seguro que quieres borrar esta plantilla?")) {
      setWaTemplates(waTemplates.filter((_, i) => i !== idx));
    }
  };
  const handleEditTemplate = (idx, val) => {
    setWaTemplates(waTemplates.map((tpl, i) => (i === idx ? val : tpl)));
  };

  // Modal curso completado PRO
  const abrirModalCompletarPro = () => {
    if (!selectedEvent || !selectedEvent.clientsList.length) {
      alert("No hay clientes asociados a este evento.");
      return;
    }
    const cursoSugerido = selectedEvent.title.split("(")[0].trim();
    setCompletarClientes(
      selectedEvent.clientsList.map((nombre) => ({
        name: nombre,
        curso: cursoSugerido,
        checked: true
      }))
    );
    setShowCompleteModal(true);
  };

  // Guardar completados + oportunidad de venta
  const guardarCompletados = (e) => {
    e.preventDefault();
    const clientesCRM = JSON.parse(
      localStorage.getItem(`dive_manager_clients_${center}`) || "[]"
    );
    const fechaHoy = new Date().toISOString().slice(0, 10);
    let actualizados = 0;
    completarClientes.forEach(({ name, curso, checked }) => {
      if (!checked) return;
      const idx = clientesCRM.findIndex((c) => c.name === name);
      if (idx === -1) return;
      if (!Array.isArray(clientesCRM[idx].cursos)) clientesCRM[idx].cursos = [];
      if (
        !clientesCRM[idx].cursos.some(
          (c) => c.curso === curso && c.fecha === fechaHoy
        )
      ) {
        clientesCRM[idx].cursos.push({ curso, fecha: fechaHoy });
        registrarOportunidadVenta(center, clientesCRM[idx].name, curso, fechaHoy);
        actualizados++;
      }
    });
    localStorage.setItem(
      `dive_manager_clients_${center}`,
      JSON.stringify(clientesCRM)
    );
    alert(`¡${actualizados} cliente(s) registrados como completados!`);
    setShowCompleteModal(false);
  };

  // Instructores: añadir, editar, borrar
  const addInstructor = () => {
    const name = newInstructor.trim();
    if (name && !instructorsList.includes(name)) {
      setInstructorsList([...instructorsList, name]);
      setNewInstructor("");
    }
  };
  const removeInstructor = (idx) => {
    if (
      window.confirm(
        `¿Seguro que quieres borrar a ${instructorsList[idx]}?`
      )
    ) {
      setInstructorsList(instructorsList.filter((_, i) => i !== idx));
    }
  };

  // Mini-dashboard eventos del día y conflicto de aforo/instructores
  const now = new Date();
  const inicioDia = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const finDia = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const eventosHoy = events.filter(
    (ev) => ev.start >= inicioDia && ev.start <= finDia
  );
  const conflictivos = eventosHoy.filter(
    (ev) =>
      ev.clientsList.length >= ev.capacity ||
      eventosHoy.filter((e) => e.instructor === ev.instructor).length > 1
  );

  // Horarios del calendario: empieza a las 08:00, termina a las 20:00
  const minTime = new Date();
  minTime.setHours(8, 0, 0, 0);
  const maxTime = new Date();
  maxTime.setHours(20, 0, 0, 0);

  // Orden español de días
  const messages = {
    week: "Semana",
    work_week: "Semana laboral",
    day: "Día",
    month: "Mes",
    previous: "Anterior",
    next: "Siguiente",
    today: "Hoy",
    agenda: "Agenda",
    date: "Fecha",
    time: "Hora",
    event: "Evento",
    allDay: "Todo el día",
    noEventsInRange: "Sin eventos en este rango",
    showMore: (total) => `+ Ver ${total} más`
  };

  // RENDER
  return (
    <div style={{ position: "relative", padding: 20, fontFamily: "sans-serif" }}>
      {/* Frase motivadora del día */}
      <h2>
        Agenda de Instructores — Centro: {center}
        <div style={{
          float: "right",
          fontSize: 18,
          background: "#f7e92d",
          color: "#2d2d2d",
          padding: "7px 22px",
          borderRadius: 18,
          marginLeft: 16,
          fontWeight: "bold"
        }}>
          {fraseDia}
        </div>
      </h2>

      {/* Mini-dashboard */}
      <div style={{ display: "flex", gap: 30, margin: "12px 0 18px 0" }}>
        <div style={{ background: "#e0f7fa", padding: 14, borderRadius: 8, flex: 1 }}>
          <b>Hoy:</b> {eventosHoy.length} eventos.
        </div>
        <div style={{ background: "#ffd6d6", padding: 14, borderRadius: 8, flex: 2 }}>
          <b>Conflictivos:</b>{" "}
          {conflictivos.length
            ? conflictivos.map((ev) => (
                <span key={ev.id} style={{ marginRight: 10 }}>
                  {ev.title} ({ev.instructor}){" "}
                  {ev.clientsList.length >= ev.capacity && (
                    <span style={{ color: "red" }}>¡Lleno! 🚨</span>
                  )}
                </span>
              ))
            : "Sin conflictos"}
        </div>
        <div style={{ background: "#f5e1ff", padding: 14, borderRadius: 8, flex: 2 }}>
          <b>Ranking instructores:</b>{" "}
          {instructorsList.length > 0
            ? instructorsList
                .map((inst) => {
                  const count = events.filter((ev) => ev.instructor === inst).length;
                  return `${inst} (${count})`;
                })
                .join(" | ")
            : "Sin instructores"}
        </div>
      </div>

      {/* Barra lateral de instructores */}
      <div style={{ marginBottom: 20 }}>
        <b>Instructores:</b>
        <ul style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 4 }}>
          {instructorsList.map((name, idx) => (
            <li key={idx} style={{ listStyle: "none" }}>
              <span style={{
                background: "#f4f4f4",
                padding: "6px 12px",
                borderRadius: 6,
                marginRight: 8
              }}>{name}</span>
              <button style={{ color: "red", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => removeInstructor(idx)}>x</button>
            </li>
          ))}
          <li>
            <input
              type="text"
              placeholder="Nuevo instructor"
              value={newInstructor}
              onChange={(e) => setNewInstructor(e.target.value)}
              style={{ padding: "4px 10px" }}
            />
            <button onClick={addInstructor}
              style={{
                marginLeft: 8,
                background: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "4px 12px",
                fontWeight: "bold"
              }}>Añadir</button>
          </li>
        </ul>
      </div>

      {/* Botón Plantillas WhatsApp */}
      <button
        style={{
          marginBottom: 14,
          background: "#25d366",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "8px 18px",
          fontWeight: "bold",
          fontSize: 16,
          cursor: "pointer"
        }}
        onClick={() => setShowTemplatePanel(!showTemplatePanel)}
      >
        {showTemplatePanel ? "Cerrar plantillas WhatsApp" : "Plantillas WhatsApp"}
      </button>

      {/* Panel lateral plantillas WhatsApp */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: showTemplatePanel ? 0 : "-420px",
          width: 400,
          height: "100vh",
          background: "#f7faff",
          borderLeft: "2px solid #25d366",
          boxShadow: showTemplatePanel ? "-4px 0 20px #25d36633" : "none",
          padding: "32px 24px 24px 24px",
          zIndex: 3000,
          transition: "right 0.4s cubic-bezier(.67,-0.07,.27,1.12)",
          overflowY: "auto"
        }}
      >
        <h3 style={{ marginTop: 0 }}>Plantillas de WhatsApp</h3>
        <ul style={{ paddingLeft: 18 }}>
          {waTemplates.map((tpl, idx) => (
            <li key={idx} style={{ marginBottom: 10, display: "flex", alignItems: "center" }}>
              <input
                value={tpl}
                onChange={e => handleEditTemplate(idx, e.target.value)}
                style={{ width: "70%", padding: 4, marginRight: 8 }}
              />
              <button
                onClick={() => handleDeleteTemplate(idx)}
                style={{ color: "#d11", background: "none", border: "1px solid #faa", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
              >Borrar</button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", marginTop: 10 }}>
          <input
            value={newWaTemplate}
            onChange={e => setNewWaTemplate(e.target.value)}
            placeholder='Nueva plantilla (usa {nombre} {actividad} {hora})'
            style={{ flex: 1, padding: 4, marginRight: 8 }}
          />
          <button
            onClick={handleAddTemplate}
            style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 4, padding: "4px 12px", fontWeight: "bold" }}
          >Añadir</button>
        </div>
        <p style={{ fontSize: 13, color: "#555", marginTop: 14 }}>
          Usa <b>{'{nombre}'}</b>, <b>{'{actividad}'}</b> y <b>{'{hora}'}</b> para personalizar los mensajes.
        </p>
      </div>

      {/* MODAL WhatsApp */}
      {showEditForm && selectedEvent && waClienteIdx !== null && (
        <div style={{
          position: "absolute", top: 60, left: 500, width: 360,
          background: "#e6ffe6", padding: 20, border: "2px solid #0c5",
          borderRadius: 8, zIndex: 2000
        }}>
          <h3>Enviar WhatsApp a <span style={{ color: "#028" }}>
            {selectedEvent.clientsList[waClienteIdx]}
          </span></h3>
          <a
  href={getGoogleCalendarLink(selectedEvent)}
  target="_blank"
  rel="noopener noreferrer"
  style={{
    display: "inline-block",
    margin: "8px 0 0 0",
    background: "#4285F4",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 4,
    fontWeight: "bold",
    textDecoration: "none"
  }}
>
  Añadir a Google Calendar
</a>
          <div>
            <label>Plantilla:</label><br />
            <select
              value={waPlantillaIdx}
              onChange={e => cambiarPlantilla(Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginBottom: 10 }}
            >
              {waTemplates.map((txt, idx) => (
                <option key={idx} value={idx}>{txt.slice(0, 40)}...</option>
              ))}
            </select>
            <label>Mensaje:</label>
            <textarea
              style={{ width: "100%", height: 90, padding: 6, margin: "10px 0" }}
              value={waMensaje}
              onChange={e => setWaMensaje(e.target.value)}
            />
            <label>Teléfono:</label>
            <input value={waTelefono} onChange={e => setWaTelefono(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
            <button
              style={{ padding: "8px 18px", background: "#25d366", color: "#fff", fontWeight: "bold", border: "none", borderRadius: 4, marginRight: 10 }}
              onClick={handleEnviarWhatsApp}
            >
              Enviar WhatsApp
            </button>
            <button onClick={cerrarWhatsAppModal} style={{ padding: "8px 18px" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL PRO marcar completados cliente a cliente */}
      {showCompleteModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.3)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#fff", padding: 32, borderRadius: 10, minWidth: 380, maxWidth: 460, boxShadow: "0 8px 24px #8888"
          }}>
            <h3>Registrar curso completado</h3>
            <p>Marca y edita los datos para cada cliente. Solo se guardarán los seleccionados.</p>
            <form onSubmit={guardarCompletados}>
              {completarClientes.map((cliente, i) => (
                <div key={cliente.name} style={{
                  display: "flex", alignItems: "center", marginBottom: 8
                }}>
                  <input
                    type="checkbox"
                    checked={cliente.checked}
                    onChange={e => {
                      setCompletarClientes(arr =>
                        arr.map((c, idx) => idx === i ? { ...c, checked: e.target.checked } : c)
                      );
                    }}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ minWidth: 110 }}>{cliente.name}</span>
                  <input
                    type="text"
                    value={cliente.curso}
                    onChange={e => {
                      setCompletarClientes(arr =>
                        arr.map((c, idx) => idx === i ? { ...c, curso: e.target.value } : c)
                      );
                    }}
                    style={{ marginLeft: 8, flex: 1, padding: 4 }}
                  />
                </div>
              ))}
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{ marginRight: 10, padding: "7px 18px" }}
                  onClick={() => setShowCompleteModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: "#2196f3", color: "#fff", padding: "7px 18px", border: "none", borderRadius: 4, fontWeight: "bold" }}
                >
                  Guardar completados
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDICION */}
      {showEditForm && selectedEvent && (
        <div style={{
          position: "absolute", top: 60, left: 60, width: 400,
          background: "#fff", padding: 20, border: "1px solid #ccc",
          borderRadius: 6, zIndex: 1000
        }}>
          <h3>{selectedEvent.id ? "Editar Evento" : "Crear Evento"}</h3>
          <form onSubmit={handleUpdateEvent}>
            <button
              type="button"
              style={{
                background: "#0d69d1", color: "#fff", border: "none",
                borderRadius: 4, padding: "8px 18px", marginBottom: 12, fontWeight: "bold"
              }}
              onClick={abrirModalCompletarPro}
            >
              Marcar como completado (PRO)
            </button>
            {/* Clientes */}
            <label>Clientes:</label><br />
            <div style={{ display: "flex", marginBottom: 8 }}>
              <input
                list="clients-dl"
                placeholder="Buscar cliente..."
                style={{ flex: 1, padding: 6 }}
                value={selectedEvent.clientInput || ""}
                onChange={e => setSelectedEvent(se => ({ ...se, clientInput: e.target.value }))}
              />
              <button type="button" onClick={addClient}
                style={{ marginLeft: 8, padding: "6px 12px" }}>
                Añadir
                
              </button>
            </div>
            <datalist id="clients-dl">
              {clientsList.map(c => <option key={c} value={c} />)}
            </datalist>
            <div style={{ marginBottom: 12 }}>
              {selectedEvent.clientsList.map((c, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "2px 6px", margin: 2,
                  background: "#eef", borderRadius: 4
                }}>
                  {c}
                  <button type="button" onClick={() => removeClient(i)}
                    style={{
                      marginLeft: 4, background: "transparent",
                      border: "none", cursor: "pointer", fontWeight: "bold"
                    }}>
                    ×
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirWhatsAppModal(i)}
                    style={{
                      marginLeft: 8, background: "#25d366", color: "#fff", border: "none",
                      borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 12
                    }}
                    title="Enviar WhatsApp"
                  >
                    WhatsApp
                  </button>
                </span>
                
              ))}
            </div>
            {/* Instructor */}
            <label>Instructor:</label><br />
            <select
              value={selectedEvent.instructor}
              onChange={e => setSelectedEvent(se => ({ ...se, instructor: e.target.value }))}
              style={{ width: "100%", padding: 6, marginBottom: 12 }}
            >
              <option value="">Selecciona instructor...</option>
              {instructorsList.map((inst, idx) => (
                <option key={idx} value={inst}>{inst}</option>
              ))}
            </select>
            {/* Título */}
           <label>Actividad (título):</label><br />
<input
  type="text"
  value={selectedEvent.title}
  onChange={e => setSelectedEvent(se => ({ ...se, title: e.target.value }))}
  style={{ width: "100%", padding: 6, marginBottom: 12 }}
/><br />
            {/* Fecha inicio */}
            <label>Inicio:</label><br />
            <input
              type="datetime-local"
              value={formatForInput(selectedEvent.start)}
              onChange={e => setSelectedEvent(se => ({ ...se, start: new Date(e.target.value) }))}
              style={{ width: "100%", padding: 6, marginBottom: 12 }}
            /><br />
            {/* Fecha fin */}
            <label>Fin:</label><br />
            <input
              type="datetime-local"
              value={formatForInput(selectedEvent.end)}
              onChange={e => setSelectedEvent(se => ({ ...se, end: new Date(e.target.value) }))}
              style={{ width: "100%", padding: 6, marginBottom: 12 }}
            /><br />
            {/* Color automático */}
            <label>Color:</label><br />
            <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 12 }}>
              {COLORS.map((c, idx) => (
                <div key={c}
                  onClick={() => setSelectedEvent(se => ({ ...se, color: c }))}
                  title={ACTIVITIES[idx]?.text || "Otro"}
                  style={{
                    width: 24, height: 24, backgroundColor: c, margin: 4,
                    border: selectedEvent.color === c ? "2px solid #000" : "1px solid #ccc",
                    cursor: "pointer"
                  }} />
              ))}
            </div>
            {/* Capacidad */}
            <label>Máx. clientes:</label><br />
            <input
              type="number"
              min="1"
              value={selectedEvent.capacity}
              onChange={e => setSelectedEvent(se => ({ ...se, capacity: Number(e.target.value) }))}
              style={{ width: 100, padding: 6, marginBottom: 12 }}
            /><br />
            <button type="submit" style={{ marginRight: 8, padding: "6px 12px" }}>Guardar</button>
            <button type="button" onClick={() => setShowEditForm(false)} style={{ marginRight: 8, padding: "6px 12px" }}>Cancelar</button>
            <button type="button" onClick={handleDeleteEvent} style={{ padding: "6px 12px", color: "red" }}>Borrar</button>
           <a
    href={getGoogleCalendarLink(selectedEvent)}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "inline-block",
      margin: "8px 0 0 0",
      background: "#4285F4",
      color: "#fff",
      padding: "6px 14px",
      borderRadius: 4,
      fontWeight: "bold",
      textDecoration: "none"
    }}
  >
    Añadir a Google Calendar
  </a>
</form>
          
        </div>
      )}

      {/* EL CALENDARIO */}
      <div style={{ height: "78vh", filter: showEditForm ? "blur(2px)" : "" }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
           startOfWeek="lunes"
            culture="es"
          endAccessor="end"
          defaultView="week"
          views={["month", "week", "day"]}
          style={{ height: "100%" }}
          selectable
          resizable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
          eventPropGetter={evt => ({
            style: {
              backgroundColor: evt.color,
              borderRadius: "4px",
              border: "1px solid #444",
              color: "#fff"
            }
          })}
          messages={messages}
          min={minTime}
          max={maxTime}
          timeslots={2}
          step={30}
        />
      </div>
    </div>
  );
}
