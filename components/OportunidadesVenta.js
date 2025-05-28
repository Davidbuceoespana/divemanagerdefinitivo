import React, { useState, useEffect } from 'react';

// Helpers
function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

// Estados posibles y labels para mostrar
const ESTADOS = ["pendiente", "contactado", "vendido", "descartado"];
const ESTADO_LABEL = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  vendido: "Vendido",
  descartado: "Descartado"
};

// Gatillos por defecto
const DEFAULT_TRIGGERS = [
  { baseCourse: "Open Water", minDays: 90, recommend: "Advanced", message: "¡Ofrécele el Advanced ya!" },
  { baseCourse: "Advanced", minDays: 120, recommend: "Rescue", message: "¡Es momento de hablarle del Rescue Diver!" }
];

export default function OportunidadesVentaPro() {
  const [clients, setClients] = useState([]);
  const [courses, setCourses] = useState([]);
  const [triggers, setTriggers] = useState(DEFAULT_TRIGGERS);
  const [newTrig, setNewTrig] = useState({ baseCourse:"", minDays:30, recommend:"", message:"" });

  // Oportunidades guardadas/gestionadas
  const [oportunidades, setOportunidades] = useState([]);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [search, setSearch] = useState("");

  // Ir atrás
  function goBack() {
    window.history.back();
  }

  // Cargar datos
  useEffect(() => {
    const center = localStorage.getItem('active_center');
    if (!center) return;

    // Clientes
    const cl = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    setClients(cl);

    // Cursos (historial de cursos)
    let cs = [];
    cl.forEach(cliente => {
      if (Array.isArray(cliente.cursos)) {
        cliente.cursos.forEach(cur =>
          cs.push({ name: cliente.name, phone: cliente.phone || "", curso: cur.curso, fecha: cur.fecha })
        );
      }
    });
    setCourses(cs);

    // Gatillos
    const t = localStorage.getItem(`dive_manager_upsell_triggers_${center}`);
    if (t) setTriggers(JSON.parse(t));
    else setTriggers(DEFAULT_TRIGGERS);

    // Oportunidades guardadas (persistente)
    const op = localStorage.getItem(`dive_manager_opportunities_${center}`);
    if (op) setOportunidades(JSON.parse(op));
    else setOportunidades([]);
  }, []);

  // Guardar triggers y oportunidades en localStorage al cambiar
  useEffect(() => {
    const center = localStorage.getItem('active_center');
    if (!center) return;
    localStorage.setItem(`dive_manager_upsell_triggers_${center}`, JSON.stringify(triggers));
  }, [triggers]);

  useEffect(() => {
    const center = localStorage.getItem('active_center');
    if (!center) return;
    localStorage.setItem(`dive_manager_opportunities_${center}`, JSON.stringify(oportunidades));
  }, [oportunidades]);

  // ---- CALCULAR oportunidades automáticas (según triggers) Y fusionar con las editadas ----
  const hoy = new Date();
  // Generar oportunidades “nuevas” que no están ya creadas
  let autoOportunidades = [];
  courses.forEach(item => {
    triggers.forEach(trig => {
      if (
        item.curso && trig.baseCourse &&
        item.curso.toLowerCase() === trig.baseCourse.toLowerCase() &&
        daysBetween(new Date(item.fecha), hoy) >= trig.minDays
      ) {
        // Si no está ya creada para ese cliente/curso/trigger…
        const existe = oportunidades.find(
          o =>
            o.name === item.name &&
            o.curso === item.curso &&
            o.recommend === trig.recommend
        );
        if (!existe) {
          autoOportunidades.push({
            name: item.name,
            phone: item.phone,
            curso: item.curso,
            fecha: item.fecha,
            dias: daysBetween(new Date(item.fecha), hoy),
            recommend: trig.recommend,
            message: trig.message,
            estado: "pendiente",
            comentarios: "",
            fechaUltimoContacto: "",
            historial: []
          });
        }
      }
    });
  });

  // Unir oportunidades persistidas con las nuevas automáticas
  let todasOportunidades = [
    ...oportunidades,
    ...autoOportunidades
  ];

  // Filtros
  let oportunidadesFiltradas = todasOportunidades;
  if (showOnlyNew) {
    oportunidadesFiltradas = oportunidadesFiltradas.filter(o => o.estado === "pendiente");
  }
  if (search.trim()) {
    oportunidadesFiltradas = oportunidadesFiltradas.filter(
      o => o.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  // --- HANDLERS ---
  // WhatsApp y registrar contacto
  function sendWhatsApp(idx) {
    const o = oportunidadesFiltradas[idx];
    if (!o.phone) { alert("El cliente no tiene teléfono"); return; }
    const tel = "34" + o.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(`¡Hola ${o.name}! ${o.message}`);
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
    // Registrar contacto
    actualizarOportunidad(idx, {
      estado: "contactado",
      fechaUltimoContacto: new Date().toISOString(),
      historial: [
        ...(o.historial || []),
        { accion: "Contacto WhatsApp", fecha: new Date().toISOString(), comentario: "" }
      ]
    });
  }

  function handleEstadoChange(idx, nuevoEstado) {
    const o = oportunidadesFiltradas[idx];
    actualizarOportunidad(idx, {
      estado: nuevoEstado,
      historial: [
        ...(o.historial || []),
        { accion: "Estado: " + ESTADO_LABEL[nuevoEstado], fecha: new Date().toISOString(), comentario: "" }
      ]
    });
  }

  function handleComentario(idx, comentario) {
    const o = oportunidadesFiltradas[idx];
    actualizarOportunidad(idx, { comentarios: comentario });
  }

  function borrarOportunidad(idx) {
    // Borrar solo si estado es descartado
    if (!window.confirm("¿Seguro que quieres borrar esta oportunidad?")) return;
    const o = oportunidadesFiltradas[idx];
    setOportunidades(prev =>
      prev.filter(
        op => !(op.name === o.name && op.curso === o.curso && op.recommend === o.recommend)
      )
    );
  }

  // Actualiza la oportunidad en el array "oportunidades"
  function actualizarOportunidad(idx, changes) {
    const o = oportunidadesFiltradas[idx];
    setOportunidades(prev =>
      prev.map(op =>
        op.name === o.name && op.curso === o.curso && op.recommend === o.recommend
          ? { ...op, ...changes }
          : op
      )
    );
  }

  // --- UI ---
  return (
    <div style={{ padding: 30, maxWidth: 1050, margin: '0 auto' }}>
      <button onClick={goBack} style={{
        marginBottom: 20, background: '#f0f7ff', color: '#155fa0',
        border: '1px solid #c3d8ef', borderRadius: 7, padding: '7px 22px', fontWeight: 'bold', fontSize: 16, cursor: 'pointer'
      }}>← Atrás</button>

      <h2 style={{ marginTop: 0 }}>Oportunidades de Venta / Upselling</h2>

      {/* Barra de filtros */}
      <div style={{ marginBottom: 30, display: "flex", gap: 18, alignItems: "center" }}>
        <button
          style={{
            background: '#25d366',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '3px 10px',
            fontWeight: 'bold',
            marginRight: 8,
            cursor: "pointer"
          }}
          onClick={() => setShowOnlyNew(!showOnlyNew)}
        >{showOnlyNew ? "Ver todas" : "Ver solo nuevas"}</button>
        <input
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "8px 14px", border: "1px solid #bbb", borderRadius: 5, width: 210 }}
        />
      </div>

      {/* GATILLOS */}
      <div style={{
        background: '#e7f6fc', padding: 18, borderRadius: 8, marginBottom: 30, border: '1px solid #b0e0fc'
      }}>
        <h3>Gatillos de Upselling</h3>
        <table style={{ width: '100%', marginBottom: 14 }}>
          <thead>
            <tr style={{ background: '#f0fbff' }}>
              <th>Curso base</th>
              <th>Días desde que lo hizo</th>
              <th>Recomendar</th>
              <th>Mensaje sugerido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t, idx) => (
              <tr key={idx}>
                <td>
                  <input value={t.baseCourse}
                    onChange={e => {
                      const n = [...triggers];
                      n[idx].baseCourse = e.target.value;
                      setTriggers(n);
                    }}
                    style={{ width: '98%' }}
                  />
                </td>
                <td>
                  <input type="number" value={t.minDays}
                    onChange={e => {
                      const n = [...triggers];
                      n[idx].minDays = Number(e.target.value);
                      setTriggers(n);
                    }}
                    style={{ width: 60 }}
                  />
                </td>
                <td>
                  <input value={t.recommend}
                    onChange={e => {
                      const n = [...triggers];
                      n[idx].recommend = e.target.value;
                      setTriggers(n);
                    }}
                    style={{ width: '96%' }}
                  />
                </td>
                <td>
                  <input value={t.message}
                    onChange={e => {
                      const n = [...triggers];
                      n[idx].message = e.target.value;
                      setTriggers(n);
                    }}
                    style={{ width: '98%' }}
                  />
                </td>
                <td>
                  <button onClick={() => {
                    const n = triggers.filter((_, i) => i !== idx);
                    setTriggers(n);
                  }} style={{
                    color: 'red', border: 'none', background: 'none', fontWeight: 'bold'
                  }}>✖</button>
                </td>
              </tr>
            ))}
            {/* Añadir nuevo */}
            <tr>
              <td>
                <input placeholder="Curso base" value={newTrig.baseCourse}
                  onChange={e => setNewTrig(n => ({ ...n, baseCourse: e.target.value }))}
                  style={{ width: '98%' }}
                />
              </td>
              <td>
                <input type="number" placeholder="Días" value={newTrig.minDays}
                  onChange={e => setNewTrig(n => ({ ...n, minDays: Number(e.target.value) }))}
                  style={{ width: 60 }}
                />
              </td>
              <td>
                <input placeholder="Recomendar..." value={newTrig.recommend}
                  onChange={e => setNewTrig(n => ({ ...n, recommend: e.target.value }))}
                  style={{ width: '96%' }}
                />
              </td>
              <td>
                <input placeholder="Mensaje sugerido" value={newTrig.message}
                  onChange={e => setNewTrig(n => ({ ...n, message: e.target.value }))}
                  style={{ width: '98%' }}
                />
              </td>
              <td>
                <button onClick={() => {
                  if (!newTrig.baseCourse || !newTrig.recommend || !newTrig.message) return;
                  setTriggers([...triggers, { ...newTrig }]);
                  setNewTrig({ baseCourse: "", minDays: 30, recommend: "", message: "" });
                }} style={{
                  color: '#2196f3', border: 'none', background: 'none', fontWeight: 'bold'
                }}>➕</button>
              </td>
            </tr>
          </tbody>
        </table>
        <small>
          <b>Ejemplo:</b> Si un cliente hizo el "Open Water" hace más de 90 días, recomiéndale el "Advanced" con un mensaje personalizado.<br />
          Puedes añadir o modificar cualquier criterio en cualquier momento.
        </small>
      </div>

      {/* OPORTUNIDADES */}
      <h3>
        Clientes con Oportunidad
        <span style={{ fontSize: 14, color: "#888", marginLeft: 8 }}>
          ({oportunidadesFiltradas.length} resultados)
        </span>
      </h3>
      <table style={{ width: '100%', marginBottom: 40, fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#e0f7fa' }}>
            <th>Cliente</th>
            <th>Curso</th>
            <th>Fecha</th>
            <th>Días</th>
            <th>Recomendar</th>
            <th>Estado</th>
            <th>Último contacto</th>
            <th>Comentarios</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {oportunidadesFiltradas.map((o, idx) => (
            <tr key={idx} style={{
              background: o.estado === "pendiente" ? "#f8ffe7" :
                o.estado === "contactado" ? "#f0f9ff" :
                  o.estado === "vendido" ? "#e0ffe6" :
                    o.estado === "descartado" ? "#fff3f2" : "#fff"
            }}>
              <td>{o.name}</td>
              <td>{o.curso}</td>
              <td>{o.fecha && (new Date(o.fecha)).toLocaleDateString()}</td>
              <td>{o.dias}</td>
              <td>
                <b>{o.recommend}</b>
                <br /><span style={{ fontSize: 12, color: '#888' }}>{o.message}</span>
              </td>
              <td>
                <select value={o.estado} onChange={e => handleEstadoChange(idx, e.target.value)}
                  style={{ padding: 4, borderRadius: 4, background: "#eef" }}>
                  {ESTADOS.map(st => <option value={st} key={st}>{ESTADO_LABEL[st]}</option>)}
                </select>
              </td>
              <td>
                {o.fechaUltimoContacto ? new Date(o.fechaUltimoContacto).toLocaleString() : "-"}
              </td>
              <td>
                <textarea
                  value={o.comentarios || ""}
                  onChange={e => handleComentario(idx, e.target.value)}
                  style={{ width: 140, minHeight: 34, borderRadius: 5, border: "1px solid #aaa", fontSize: 13 }}
                  placeholder="Escribe nota o comentario..."
                />
              </td>
              <td>
                <button
                  style={{
                    background: '#25d366', color: '#fff', border: 'none',
                    borderRadius: 4, padding: '3px 10px', fontWeight: 'bold', marginRight: 8, cursor: "pointer"
                  }}
                  onClick={() => sendWhatsApp(idx)}
                >WhatsApp</button>
                {/* Historial */}
                {o.historial && o.historial.length > 0 && (
                  <button
                    style={{
                      background: "#aaa", color: "#fff", border: 'none',
                      borderRadius: 3, padding: '2px 7px', fontSize: 12, cursor: "pointer", marginRight: 7
                    }}
                    onClick={() => alert(
                      o.historial
                        .map(h =>
                          `${h.accion} - ${h.fecha && new Date(h.fecha).toLocaleString()}${h.comentario ? " | " + h.comentario : ""}`
                        ).join("\n")
                    )}
                  >Historial</button>
                )}
                {/* Borrar (solo si está descartado) */}
                {o.estado === "descartado" && (
                  <button
                    style={{
                      background: "#ff4c4c", color: "#fff", border: 'none',
                      borderRadius: 3, padding: '2px 10px', fontSize: 14, cursor: "pointer"
                    }}
                    onClick={() => borrarOportunidad(idx)}
                    title="Borrar oportunidad"
                  >🗑️</button>
                )}
              </td>
            </tr>
          ))}
          {oportunidadesFiltradas.length === 0 && (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', color: '#aaa', padding: 20 }}>
                <i>No hay oportunidades de venta actualmente</i>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
