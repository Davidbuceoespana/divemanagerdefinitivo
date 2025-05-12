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

export default function SimpleCalendar() {
  if (typeof window === 'undefined') return null;
  const center = localStorage.getItem('active_center');
  if (!center) return <p>Elige un centro</p>;

  const [events,         setEvents]       = useState([]);
  const [clientsList,    setClientsList]  = useState([]);
  const [selectedEvent,  setSelectedEvent]= useState(null);
  const [showEditForm,   setShowEditForm] = useState(false);

  // Carga inicial de eventos y clientes CRM
  useEffect(() => {
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

  // Persiste cambios en eventos
  useEffect(() => {
    localStorage.setItem(`dive_manager_events_${center}`, JSON.stringify(events));
  }, [events, center]);

  const formatForInput = date => {
    const pad = n => n.toString().padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Crear evento
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

  // Mover o redimensionar
  const moveEvent = ({ event, start, end }) => {
    setEvents(events.map(ev =>
      ev.id === event.id ? { ...ev, start, end } : ev
    ));
  };

  // Abrir modal de edición
  const handleSelectEvent = ev => {
    setSelectedEvent({ ...ev, clientInput: '' });
    setShowEditForm(true);
  };

  // Clientes en el modal
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

  // Guardar edición
  const handleUpdateEvent = e => {
    e.preventDefault();
    // Reconstruir título incluyendo clientes
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

  return (
    <div style={{ position:'relative', padding:20, fontFamily:'sans-serif' }}>
      <h2>Agenda de Instructores — Centro: {center}</h2>

      {showEditForm && selectedEvent && (
        <div style={{
          position:'absolute', top:60, left:60, width:360,
          background:'#fff', padding:20, border:'1px solid #ccc',
          borderRadius:4, zIndex:1000
        }}>
          <h3>Editar Evento</h3>
          <form onSubmit={handleUpdateEvent}>

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
