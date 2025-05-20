// components/SimpleCalendar.js 
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import es from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(Calendar);
const COLORS = ['blue','red','green','cyan','yellow','gray','lightblue','orange'];

const DEFAULT_TEMPLATES = [
  "¡Hola {nombre}! Soy David de Buceo España. Recuerda que mañana tienes tu actividad \"{actividad}\" a las {hora}. ¡Nos vemos en el agua!",
  "¡Hola {nombre}! Solo para recordarte tu cita de \"{actividad}\" mañana a las {hora}. Cualquier duda, avísame.",
  "¡Buenas, {nombre}! Te espero mañana para \"{actividad}\" a las {hora} con todo listo para bucear. ¡Vamos a disfrutar!"
];

function rellenarPlantilla(mensaje, datos) {
  return mensaje
    .replace('{nombre}', datos.nombre)
    .replace('{actividad}', datos.actividad)
    .replace('{hora}', datos.hora);
}
function crearLinkWhatsApp(telefono, mensaje) {
  const telefonoFormateado = "34" + telefono.replace(/\D/g, "");
  const mensajeCodificado = encodeURIComponent(mensaje);
  return `https://wa.me/${telefonoFormateado}?text=${mensajeCodificado}`;
}
function guardarHistorialWhatsApp(center, cliente, mensaje, actividad, usuario="") {
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
export default function SimpleCalendar() {
  // HOOKS
  const [events,         setEvents]       = useState([]);
  const [clientsList,    setClientsList]  = useState([]);
  const [selectedEvent,  setSelectedEvent]= useState(null);
  const [showEditForm,   setShowEditForm] = useState(false);

  // WhatsApp
  const [waClienteIdx, setWaClienteIdx] = useState(null);
  const [waPlantillaIdx, setWaPlantillaIdx] = useState(0);
  const [waMensaje, setWaMensaje] = useState("");
  const [waTelefono, setWaTelefono] = useState("");

  // PLANTILLAS en panel lateral
  const [waTemplates, setWaTemplates] = useState(DEFAULT_TEMPLATES);
  const [newTemplate, setNewTemplate] = useState("");
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // PRO modal: completar cursos cliente a cliente
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completarClientes, setCompletarClientes] = useState([]);

  let center = "";
  if (typeof window !== 'undefined') {
    center = localStorage.getItem('active_center') || "";
  }
  if (typeof window !== 'undefined' && !center) return <p>Elige un centro</p>;
  if (typeof window === 'undefined') return null;

  // Plantillas en LocalStorage
  useEffect(() => {
    if (!center) return;
    const saved = localStorage.getItem(`dive_manager_whatsapp_templates_${center}`);
    if (saved) {
      setWaTemplates(JSON.parse(saved));
    } else {
      setWaTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem(`dive_manager_whatsapp_templates_${center}`, JSON.stringify(DEFAULT_TEMPLATES));
    }
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_whatsapp_templates_${center}`, JSON.stringify(waTemplates));
  }, [waTemplates, center]);
  useEffect(() => {
    if (!center) return;
    const rawEv = localStorage.getItem(`dive_manager_events_${center}`) || '[]';
    setEvents(JSON.parse(rawEv).map(ev => ({
      ...ev,
      start: new Date(ev.start),
      end:   new Date(ev.end),
      instructor: ev.instructor || '',
      clientsList: ev.clientsList || [],
      color:      ev.color      || COLORS[0],
      capacity:   ev.capacity   || 1,
    })));
    const rawClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    setClientsList(rawClients.map(x => x.name));
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_events_${center}`, JSON.stringify(events));
  }, [events, center]);

  const formatForInput = date => {
    const pad = n => n.toString().padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSelectSlot = ({ start, end }) => {
    const title = window.prompt('Título del evento');
    if (title) {
      setEvents([...events, {
        id: Date.now(),
        title,
        start, end,
        instructor: '',
        clientsList: [],
        color: COLORS[0],
        capacity: 1
      }]);
    }
  };
  const moveEvent = ({ event, start, end }) => {
    setEvents(events.map(ev =>
      ev.id === event.id ? { ...ev, start, end } : ev
    ));
  };
  const handleSelectEvent = ev => {
    setSelectedEvent({ ...ev, clientInput: '' });
    setShowEditForm(true);
  };
  const addClient = () => {
    const name = selectedEvent.clientInput?.trim();
    if (name && !selectedEvent.clientsList.includes(name)) {
      setSelectedEvent(se => ({
        ...se,
        clientsList: [...se.clientsList, name],
        clientInput: ''
      }));
    }
  };
  const removeClient = idx => {
    setSelectedEvent(se => ({
      ...se,
      clientsList: se.clientsList.filter((_,i)=>i!==idx)
    }));
  };
  const handleUpdateEvent = e => {
    e.preventDefault();
    const baseTitle = selectedEvent.title.split('(')[0].trim();
    const newTitle = `${baseTitle} (${selectedEvent.clientsList.join(', ')})`;
    setEvents(events.map(ev =>
      ev.id === selectedEvent.id ? { ...selectedEvent, title: newTitle } : ev
    ));
    setShowEditForm(false);
  };
  const handleDeleteEvent = () => {
    setEvents(events.filter(ev => ev.id !== selectedEvent.id));
    setShowEditForm(false);
  };

  // WhatsApp modal - abrir para cliente seleccionado
  const abrirWhatsAppModal = (idx) => {
    if (!selectedEvent) return;
    setWaClienteIdx(idx);
    setWaPlantillaIdx(0);
    const clienteNombre = selectedEvent.clientsList[idx];
    let telefono = "";
    const clientObj = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]').find(x => x.name === clienteNombre);
    if (clientObj) telefono = clientObj.phone || clientObj.telefono || "";
    setWaTelefono(telefono);

    const actividad = selectedEvent.title.split('(')[0].trim();
    const hora = selectedEvent.start instanceof Date 
      ? selectedEvent.start.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})
      : "";
    const plantilla = waTemplates[0];
    setWaMensaje(rellenarPlantilla(plantilla, {nombre: clienteNombre, actividad, hora}));
  };
  const cambiarPlantilla = (idx) => {
    setWaPlantillaIdx(idx);
    if (selectedEvent && waClienteIdx !== null) {
      const clienteNombre = selectedEvent.clientsList[waClienteIdx];
      const actividad = selectedEvent.title.split('(')[0].trim();
      const hora = selectedEvent.start instanceof Date 
        ? selectedEvent.start.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})
        : "";
      setWaMensaje(rellenarPlantilla(waTemplates[idx], {nombre: clienteNombre, actividad, hora}));
    }
  };
  const handleEnviarWhatsApp = () => {
    const telefono = waTelefono || "";
    if (!telefono) { alert("No se ha encontrado el teléfono del cliente."); return; }
    const link = crearLinkWhatsApp(telefono, waMensaje);
    if (selectedEvent && waClienteIdx !== null) {
      const clienteNombre = selectedEvent.clientsList[waClienteIdx];
      guardarHistorialWhatsApp(center, clienteNombre, waMensaje, selectedEvent.title, "David");
    }
    window.open(link, "_blank");
    setWaClienteIdx(null);
  };
  const cerrarWhatsAppModal = () => {
    setWaClienteIdx(null);
  };

  // GESTOR DE PLANTILLAS
  const handleAddTemplate = () => {
    if (newTemplate.trim()) {
      setWaTemplates([...waTemplates, newTemplate.trim()]);
      setNewTemplate("");
    }
  };
  const handleDeleteTemplate = (idx) => {
    if (window.confirm("¿Seguro que quieres borrar esta plantilla?")) {
      setWaTemplates(waTemplates.filter((_, i) => i !== idx));
    }
  };
  const handleEditTemplate = (idx, val) => {
    setWaTemplates(waTemplates.map((tpl, i) => i === idx ? val : tpl));
  };

  // --------- MODAL PRO MARCAR COMPLETADOS --------
  const abrirModalCompletarPro = () => {
    if (!selectedEvent || !selectedEvent.clientsList.length) {
      alert("No hay clientes asociados a este evento.");
      return;
    }
    const cursoSugerido = selectedEvent.title.split('(')[0].trim();
    setCompletarClientes(selectedEvent.clientsList.map(nombre => ({
      name: nombre,
      curso: cursoSugerido,
      checked: true
    })));
    setShowCompleteModal(true);
  };

  // ---------- RENDER ----------
  return (
    <div style={{ position:'relative', padding:20, fontFamily:'sans-serif' }}>
      <h2 style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        Agenda de Instructores — Centro: {center}
        <button
          style={{
            marginLeft:16, background:'#25d366', color:'#fff',
            border:'none', borderRadius:6, padding:'8px 18px',
            fontWeight:'bold', fontSize:16, cursor:'pointer', minWidth:160
          }}
          onClick={() => setShowTemplatePanel(!showTemplatePanel)}
        >
          {showTemplatePanel ? "Cerrar plantillas" : "Plantillas WhatsApp"}
        </button>
      </h2>

      {/* PANEL LATERAL DE PLANTILLAS */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: showTemplatePanel ? 0 : '-420px',
        width: 400,
        height: '100vh',
        background: '#f7faff',
        borderLeft: '2px solid #25d366',
        boxShadow: showTemplatePanel ? '-4px 0 20px #25d36633' : 'none',
        padding: '32px 24px 24px 24px',
        zIndex: 3000,
        transition: 'right 0.4s cubic-bezier(.67,-0.07,.27,1.12)',
        overflowY: 'auto'
      }}>
        <h3 style={{marginTop:0}}>Plantillas de WhatsApp</h3>
        <ul style={{paddingLeft:18}}>
          {waTemplates.map((tpl, idx) => (
            <li key={idx} style={{marginBottom:10, display:'flex', alignItems:'center'}}>
              <input
                value={tpl}
                onChange={e => handleEditTemplate(idx, e.target.value)}
                style={{width:'70%', padding:4, marginRight:8}}
              />
              <button
                onClick={()=>handleDeleteTemplate(idx)}
                style={{color:'#d11', background:'none', border:'1px solid #faa', borderRadius:4, padding:'2px 8px', cursor:'pointer'}}
              >Borrar</button>
            </li>
          ))}
        </ul>
        <div style={{display:'flex', marginTop:10}}>
          <input
            value={newTemplate}
            onChange={e => setNewTemplate(e.target.value)}
            placeholder='Nueva plantilla (usa {nombre} {actividad} {hora})'
            style={{flex:1, padding:4, marginRight:8}}
          />
          <button
            onClick={handleAddTemplate}
            style={{background:'#25d366', color:'#fff', border:'none', borderRadius:4, padding:'4px 12px', fontWeight:'bold'}}
          >Añadir</button>
        </div>
        <p style={{fontSize:13, color:'#555', marginTop:14}}>
          Usa <b>{'{nombre}'}</b>, <b>{'{actividad}'}</b> y <b>{'{hora}'}</b> para personalizar los mensajes.
        </p>
      </div>

      {/* MODAL WhatsApp */}
      {showEditForm && selectedEvent && waClienteIdx !== null && (
        <div style={{
          position:'absolute', top:60, left:440, width:360,
          background:'#e6ffe6', padding:20, border:'2px solid #0c5',
          borderRadius:8, zIndex:2000
        }}>
          <h3>Enviar WhatsApp a <span style={{color:'#028'}}>
            {selectedEvent.clientsList[waClienteIdx]}
          </span></h3>
          <div>
            <label>Plantilla:</label><br/>
            <select
              value={waPlantillaIdx}
              onChange={e => cambiarPlantilla(Number(e.target.value))}
              style={{width:'100%',padding:8,marginBottom:10}}
            >
              {waTemplates.map((txt,idx) => (
                <option key={idx} value={idx}>{txt.slice(0, 40)}...</option>
              ))}
            </select>
            <label>Mensaje:</label>
            <textarea
              style={{ width:'100%', height:90, padding:6, margin:'10px 0' }}
              value={waMensaje}
              onChange={e => setWaMensaje(e.target.value)}
            />
            <button
              style={{padding:'8px 18px', background:'#25d366',color:'#fff',fontWeight:'bold',border:'none',borderRadius:4,marginRight:10}}
              onClick={handleEnviarWhatsApp}
            >
              Enviar WhatsApp
            </button>
            <button onClick={cerrarWhatsAppModal} style={{padding:'8px 18px'}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL PRO marcar completados cliente a cliente */}
      {showCompleteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.3)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', padding: 32, borderRadius: 10, minWidth: 380, maxWidth: 460, boxShadow: '0 8px 24px #8888'
          }}>
            <h3>Registrar curso completado</h3>
            <p>Marca y edita los datos para cada cliente. Solo se guardarán los seleccionados.</p>
            <form onSubmit={e => {
              e.preventDefault();
              const center = localStorage.getItem('active_center');
              const clientesCRM = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]");
              const fechaHoy = new Date().toISOString().slice(0, 10);
              let actualizados = 0;
              completarClientes.forEach(({ name, curso, checked }) => {
                if (!checked) return;
                const idx = clientesCRM.findIndex(c => c.name === name);
                if (idx === -1) return;
                if (!Array.isArray(clientesCRM[idx].cursos)) clientesCRM[idx].cursos = [];
               if (!clientesCRM[idx].cursos.some(c => c.curso === curso && c.fecha === fechaHoy)) {
  clientesCRM[idx].cursos.push({ curso, fecha: fechaHoy });
  registrarOportunidadVenta(center, clientesCRM[idx].name, curso, fechaHoy); // <-- AÑADE ESTA LÍNEA
  actualizados++;
}

              });
              localStorage.setItem(`dive_manager_clients_${center}`, JSON.stringify(clientesCRM));
              alert(`¡${actualizados} cliente(s) registrados como completados!`);
              setShowCompleteModal(false);
            }}>
              {completarClientes.map((cliente, i) => (
                <div key={cliente.name} style={{
                  display: 'flex', alignItems: 'center', marginBottom: 8
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
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{ marginRight: 10, padding: '7px 18px' }}
                  onClick={() => setShowCompleteModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ background: '#2196f3', color: '#fff', padding: '7px 18px', border: 'none', borderRadius: 4, fontWeight: 'bold' }}
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
          position:'absolute', top:60, left:60, width:360,
          background:'#fff', padding:20, border:'1px solid #ccc',
          borderRadius:4, zIndex:1000
        }}>
          <h3>Editar Evento</h3>
          <form onSubmit={handleUpdateEvent}>
            {/* ULTRA PRO BOTÓN NUEVO */}
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
            {/* BOTÓN clásico */}
            <button
              type="button"
              style={{
                background: "#2196f3", color: "#fff", border: "none",
                borderRadius: 4, padding: "8px 18px", marginBottom: 12, fontWeight: "bold", marginLeft: 12
              }}
              onClick={async () => {
                if (!selectedEvent || !selectedEvent.clientsList.length) {
                  alert("No hay clientes asociados a este evento.");
                  return;
                }
                if (!window.confirm("¿Registrar este evento como COMPLETADO para todos los clientes?")) return;
                const center = localStorage.getItem('active_center');
                const clientesCRM = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]");
                const fechaHoy = new Date().toISOString().slice(0, 10);
                let actualizados = 0;
                let curso = selectedEvent.title.split('(')[0].trim();
                selectedEvent.clientsList.forEach(nombreCliente => {
                  const idx = clientesCRM.findIndex(c => c.name === nombreCliente);
                  if (idx === -1) return;
                  if (!Array.isArray(clientesCRM[idx].cursos)) clientesCRM[idx].cursos = [];
                  if (!clientesCRM[idx].cursos.some(c => c.curso === curso && c.fecha === fechaHoy)) {
                  clientesCRM[idx].cursos.push({ curso, fecha: fechaHoy });
                  actualizados++;
                  }

                });
                localStorage.setItem(`dive_manager_clients_${center}`, JSON.stringify(clientesCRM));
                alert(`¡${actualizados} cliente(s) registrados como completados para ${curso} (${fechaHoy})!`);
              }}
            >
              Marcar como completado
            </button>
            {/* Clientes */}
            <label>Clientes:</label><br/>
            <div style={{ display:'flex', marginBottom:8 }}>
              <input
                list="clients-dl"
                placeholder="Buscar cliente..."
                style={{ flex:1, padding:6 }}
                value={selectedEvent.clientInput || ''}
                onChange={e => setSelectedEvent(se => ({ ...se, clientInput: e.target.value }))}
              />
              <button type="button" onClick={addClient}
                      style={{ marginLeft:8, padding:'6px 12px' }}>
                Añadir
              </button>
            </div>
            <datalist id="clients-dl">
              {clientsList.map(c => <option key={c} value={c}/>)}
            </datalist>
            <div style={{ marginBottom:12 }}>
              {selectedEvent.clientsList.map((c,i) => (
                <span key={i} style={{
                  display:'inline-block', padding:'2px 6px', margin:2,
                  background:'#eef', borderRadius:4
                }}>
                  {c}
                  <button type="button" onClick={()=>removeClient(i)}
                          style={{
                            marginLeft:4, background:'transparent',
                            border:'none', cursor:'pointer', fontWeight:'bold'
                          }}>
                    ×
                  </button>
                  <button
                    type="button"
                    onClick={()=>abrirWhatsAppModal(i)}
                    style={{
                      marginLeft:8, background:'#25d366', color:'#fff', border:'none',
                      borderRadius:4, padding:'2px 8px', cursor:'pointer', fontSize:12
                    }}
                    title="Enviar WhatsApp"
                  >
                    WhatsApp
                  </button>
                </span>
              ))}
            </div>
            {/* Instructor libre */}
            <label>Instructor:</label><br/>
            <input
              type="text"
              placeholder="Nombre del instructor"
              value={selectedEvent.instructor}
              onChange={e => setSelectedEvent(se => ({ ...se, instructor: e.target.value }))}
              style={{ width:'100%', padding:6, marginBottom:12 }}
            />
            {/* Título */}
            <label>Actividad (título):</label><br/>
            <input
              type="text"
              value={selectedEvent.title}
              onChange={e => setSelectedEvent(se => ({ ...se, title: e.target.value }))}
              style={{ width:'100%', padding:6, marginBottom:12 }}
            /><br/>
            {/* Fecha inicio */}
            <label>Inicio:</label><br/>
            <input
              type="datetime-local"
              value={formatForInput(selectedEvent.start)}
              onChange={e => setSelectedEvent(se => ({ ...se, start: new Date(e.target.value) }))}
              style={{ width:'100%', padding:6, marginBottom:12 }}
            /><br/>
            {/* Fecha fin */}
            <label>Fin:</label><br/>
            <input
              type="datetime-local"
              value={formatForInput(selectedEvent.end)}
              onChange={e => setSelectedEvent(se => ({ ...se, end: new Date(e.target.value) }))}
              style={{ width:'100%', padding:6, marginBottom:12 }}
            /><br/>
            {/* Color */}
            <label>Color:</label><br/>
            <div style={{ display:'flex', flexWrap:'wrap', marginBottom:12 }}>
              {COLORS.map(c => (
                <div key={c}
                  onClick={()=>setSelectedEvent(se=>({...se, color:c}))}
                  style={{
                    width:24, height:24, backgroundColor:c, margin:4,
                    border: selectedEvent.color===c ? '2px solid #000' : '1px solid #ccc',
                    cursor:'pointer'
                  }}/>
              ))}
            </div>
            {/* Capacidad */}
            <label>Máx. clientes:</label><br/>
            <input
              type="number"
              min="1"
              value={selectedEvent.capacity}
              onChange={e=>setSelectedEvent(se => ({ ...se, capacity: Number(e.target.value) }))}
              style={{ width:100, padding:6, marginBottom:12 }}
            /><br/>
            <button type="submit" style={{ marginRight:8, padding:'6px 12px' }}>Guardar</button>
            <button type="button" onClick={()=>setShowEditForm(false)} style={{ marginRight:8, padding:'6px 12px' }}>Cancelar</button>
            <button type="button" onClick={handleDeleteEvent} style={{ padding:'6px 12px', color:'red' }}>Borrar</button>
          </form>
        </div>
      )}

      <div style={{ height:'80vh', filter: showEditForm ? 'blur(2px)' : '' }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="week"
          views={['month','week','day']}
          style={{ height:'100%' }}
          selectable
          resizable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={moveEvent}
          onEventResize={moveEvent}
          eventPropGetter={evt => ({
            style: {
              backgroundColor: evt.color,
              borderRadius:'4px',
              border:'1px solid #444'
            }
          })}
        />
      </div>
    </div>
  );
}
