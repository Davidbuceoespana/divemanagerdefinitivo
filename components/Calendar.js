// components/Calendar.js
import { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import Link from 'next/link';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const COLORS = ['blue','red','green','cyan','yellow','gray','lightblue','orange'];
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek, getDay,
  locales: { es: require('date-fns/locale/es') },
});

export default function Calendar() {
  // 1) Leer el centro activo
  const center = typeof window !== 'undefined'
    ? localStorage.getItem('active_center')
    : null;
  if (!center) return null;

  // 2) Claves por centro
  const EVENTS_KEY  = `dive_manager_events_${center}`;
  const STAFF_KEY   = `dive_manager_staff_${center}`;
  const CLIENTS_KEY = `dive_manager_clients_${center}`;

  // 3) States
  const [events, setEvents]           = useState([]);
  const [staff, setStaff]             = useState([]);    // sólo nombres
  const [clientsList, setClientsList] = useState([]);    // sólo nombres
  const [showForm, setShowForm]       = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    instructor: '',
    clientsList: [],
    clientInput: '',
    activity: '',
    datetime: '',
    color: COLORS[0],
  });

  // 4) Carga inicial
  useEffect(() => {
    // Staff
    const rawStaff = localStorage.getItem(STAFF_KEY) || '[]';
    const arrStaff = JSON.parse(rawStaff);
    setStaff(arrStaff.map(x => x.name));

    // Clientes
    const rawClients = localStorage.getItem(CLIENTS_KEY) || '[]';
    const arrClients = JSON.parse(rawClients);
    setClientsList(arrClients.map(x => x.name));

    // Eventos
    const rawEv = localStorage.getItem(EVENTS_KEY) || '[]';
    const arrEv  = JSON.parse(rawEv);
    setEvents(arrEv.map(ev => ({
      ...ev,
      start: new Date(ev.start),
      end:   new Date(ev.end),
    })));
  }, [center]);

  // 5) Persiste eventos
  useEffect(() => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }, [events, center]);

  // 6) Cuando abra el formulario, si instructor está vacío, pon el primero
  useEffect(() => {
    if (showForm && !formData.instructor && staff.length > 0) {
      setFormData(fd => ({ ...fd, instructor: staff[0] }));
    }
  }, [showForm, staff]);

  // 7) Handlers crear/editar/borrar
  const handleSelectSlot = ({ start }) => {
    setFormData({
      id: null,
      instructor: '',
      clientsList: [],
      clientInput: '',
      activity: '',
      datetime: start.toISOString().slice(0,16),
      color: COLORS[0],
    });
    setEditMode(false);
    setShowForm(true);
  };
  const addClient = () => {
    const name = formData.clientInput.trim();
    if (name && !formData.clientsList.includes(name)) {
      setFormData(fd => ({
        ...fd,
        clientsList: [...fd.clientsList, name],
        clientInput: ''
      }));
    }
  };
  const removeClient = idx => {
    setFormData(fd => ({
      ...fd,
      clientsList: fd.clientsList.filter((_,i) => i!==idx)
    }));
  };
  const handleCreate = e => {
    e.preventDefault();
    const date = new Date(formData.datetime);
    const ev = {
      id: Date.now(),
      instructor: formData.instructor,
      clients: formData.clientsList.join(', '),
      activity: formData.activity,
      title: `${formData.instructor} – ${formData.activity} (${formData.clientsList.join(', ')})`,
      start: date, end: date,
      color: formData.color,
    };
    setEvents(list => [...list, ev]);
    setShowForm(false);
  };
  const handleSelectEvent = ev => {
    setFormData({
      id: ev.id,
      instructor: ev.instructor,
      clientsList: ev.clients.split(', ').filter(Boolean),
      clientInput: '',
      activity: ev.activity,
      datetime: ev.start.toISOString().slice(0,16),
      color: ev.color,
    });
    setEditMode(true);
    setShowForm(true);
  };
  const handleUpdate = e => {
    e.preventDefault();
    const date = new Date(formData.datetime);
    setEvents(list => list.map(ev =>
      ev.id === formData.id
        ? {
            ...ev,
            instructor: formData.instructor,
            clients: formData.clientsList.join(', '),
            activity: formData.activity,
            title: `${formData.instructor} – ${formData.activity} (${formData.clientsList.join(', ')})`,
            start: date, end: date,
            color: formData.color,
          }
        : ev
    ));
    setShowForm(false);
  };
  const handleDelete = () => {
    setEvents(list => list.filter(ev => ev.id !== formData.id));
    setShowForm(false);
  };
  const handleCancel = () => setShowForm(false);

  return (
    <div style={{padding:20,fontFamily:'sans-serif',position:'relative'}}>
      <h2>Agenda de Instructores — Centro: {center}</h2>
      <Link href="/" style={{
        display:'inline-block', marginBottom:20,
        padding:'6px 12px', background:'#0070f3',
        color:'white', borderRadius:4, textDecoration:'none'
      }}>← Volver al panel principal</Link>

      {showForm && (
        <div style={{
          position:'absolute',top:60,left:60,width:360,
          background:'#fff',padding:20,border:'1px solid #ccc',
          borderRadius:4,zIndex:1000
        }}>
          <h3>{editMode ? 'Editar Evento' : 'Crear Evento'}</h3>
          <form onSubmit={editMode ? handleUpdate : handleCreate}>

            {/* Autocomplete Staff */}
            <label>Staff:</label><br/>
            <input
              list="staff-dl"
              required
              placeholder="Buscar staff..."
              style={{ width:'100%', padding:6, marginBottom:12 }}
              value={formData.instructor}
              onChange={e => setFormData(fd => ({ ...fd, instructor: e.target.value }))}
              onKeyDown={ev => ev.key==='Enter' && ev.preventDefault()}
            />
            <datalist id="staff-dl">
              {staff.map(name => <option key={name} value={name}/>)}
            </datalist>

            {/* Autocomplete Clientes */}
            <label>Clientes (CRM):</label><br/>
            <div style={{ display:'flex', marginBottom:8 }}>
              <input
                list="clients-dl"
                type="text"
                placeholder="Buscar cliente..."
                style={{ flex:1, padding:6 }}
                value={formData.clientInput}
                onChange={e => setFormData(fd => ({ ...fd, clientInput: e.target.value }))}
                onKeyDown={ev => ev.key==='Enter' && (ev.preventDefault(), addClient())}
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
              {formData.clientsList.map((c,i) => (
                <span key={i} style={{
                  display:'inline-block', padding:'2px 6px', margin:2,
                  background:'#eef', borderRadius:4
                }}>
                  {c}
                  <button type="button" onClick={()=>removeClient(i)}
                          style={{
                            marginLeft:4, background:'transparent',
                            border:'none', cursor:'pointer', fontWeight:'bold'
                          }}>×</button>
                </span>
              ))}
            </div>

            {/* Resto del formulario */}
            <label>Actividad:</label><br/>
            <input
              type="text" required
              style={{ width:'100%', padding:6, marginBottom:12 }}
              value={formData.activity}
              onChange={e=>setFormData(fd=>({...fd,activity:e.target.value}))}
            /><br/>

            <label>Fecha y Hora:</label><br/>
            <input
              type="datetime-local" required
              style={{ width:'100%', padding:6, marginBottom:12 }}
              value={formData.datetime}
              onChange={e=>setFormData(fd=>({...fd,datetime:e.target.value}))}
            /><br/>

            <label>Color:</label><br/>
            <div style={{ display:'flex', flexWrap:'wrap', marginBottom:12 }}>
              {COLORS.map(c=>(
                <div key={c}
                     onClick={()=>setFormData(fd=>({...fd,color:c}))}
                     style={{
                       width:24, height:24, backgroundColor:c, margin:4,
                       border: formData.color===c?'2px solid #000':'1px solid #ccc',
                       cursor:'pointer'
                     }}/>
              ))}
            </div>

            <button type="submit" style={{ padding:'6px 12px', marginRight:8 }}>
              {editMode ? 'Guardar' : 'Crear'}
            </button>
            <button type="button" onClick={handleCancel}
                    style={{ padding:'6px 12px' }}>
              Cancelar
            </button>
            {editMode && (
              <button type="button" onClick={handleDelete}
                      style={{ padding:'6px 12px', marginLeft:8, color:'red' }}>
                Borrar
              </button>
            )}
          </form>
        </div>
      )}

      <div style={{ height:'80vh', filter: showForm?'blur(2px)':'' }}>
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="week"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={evt=>({ style:{
            backgroundColor:evt.color,
            borderRadius:'4px',
            border:'1px solid #444'
          }})}
          style={{ height:'100%' }}
        />
      </div>
    </div>
  );
}

