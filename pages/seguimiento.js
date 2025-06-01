import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, startOfWeek, addDays, isSameDay, isAfter } from 'date-fns';

const frases = [
  "¡A romper récord de cierres hoy! 🚀",
  "Cada llamada, una historia. Cada WhatsApp, una sonrisa. 📱",
  "Los campeones no paran hasta vender. ¡Vamos equipo! 💪",
  "Quien sigue, consigue. ¡Hoy cae otra venta! 🏆",
];

export default function SeguimientoPage() {
  if (typeof window === 'undefined') return null;
  const [center, setCenter] = useState(null);
useEffect(() => {
  if (typeof window !== 'undefined') {
    setCenter(localStorage.getItem('active_center'));
  }
}, []);

  const STORAGE_KEY = `dive_manager_tracking_${center}`;
  const CLIENTS_KEY = `dive_manager_clients_${center}`;

  // Estados
  const [items, setItems] = useState([]);
  const [type, setType] = useState('call');
  const [client, setClient] = useState('');
  const [desc, setDesc] = useState('');
  const [totalDives, setTotalDives] = useState(0);
  const [doneDives, setDoneDives] = useState(0);
  const [filter, setFilter] = useState('all');
  const [comment, setComment] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [calendarWeek, setCalendarWeek] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  // Carga inicial
  useEffect(() => {
    setItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    setClients(JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]'));
  }, [center]);

  // Persistir
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, center]);

  // Añadir nuevo ítem
  const handleAdd = e => {
    e.preventDefault();
    if (!client.trim()) return alert('Pon el nombre del cliente');
    const base = {
      id: Date.now(),
      type,
      client: client.trim(),
      date: new Date().toISOString(),
      done: false,
      comment,
      nextAction,
      nextDate: nextDate || null,
    };
    let newItem;
    if (type === 'course') {
      if (totalDives < 1) return alert('Pon total de inmersiones');
      newItem = { ...base, totalDives: Number(totalDives), doneDives: Number(doneDives) };
    } else {
      if (!desc.trim()) return alert('Pon descripción');
      newItem = { ...base, desc: desc.trim() };
    }
    setItems([newItem, ...items]);
    setClient(''); setDesc(''); setTotalDives(0); setDoneDives(0);
    setComment(''); setNextAction(''); setNextDate('');
  };

  // Marcar completado
  const toggleDone = id => {
    setItems(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  // Borrar
  const handleDelete = id => {
    if (confirm('¿Borrar este registro?')) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  // Añadir comentario, próxima acción y fecha a tarea ya creada
  const updateItem = (id, comment, nextAction, nextDate) => {
    setItems(items.map(i =>
      i.id === id ? { ...i, comment, nextAction, nextDate } : i
    ));
  };

  // Reagendar tarea (copia la tarea con nueva fecha, no la borra)
  const handleReagendar = (item, days = 3) => {
    const newDate = addDays(new Date(), days);
    const newItem = {
      ...item,
      id: Date.now(),
      date: newDate.toISOString(),
      done: false,
      comment: item.comment || '',
      nextAction: item.nextAction || '',
      nextDate: format(newDate, 'yyyy-MM-dd'),
    };
    setItems([newItem, ...items]);
  };

  // Acciones rápidas
  const getClient = name => clients.find(c => c.name === name) || {};
  const handleWhatsApp = (client) => {
    if (!client.phone) return alert("No hay teléfono");
    const msg = encodeURIComponent(`¡Hola ${client.name || ''}! ¿Cómo va el buceo? Desde Buceo España te recordamos tu seguimiento 🤿`);
    window.open(`https://wa.me/${client.phone}?text=${msg}`, '_blank');
  };
  const handleCall = (client) => {
    if (!client.phone) return alert("No hay teléfono");
    window.open(`tel:${client.phone}`);
  };
  const handleEmail = (client) => {
    if (!client.email) return alert("No hay email");
    window.open(`mailto:${client.email}?subject=Seguimiento Buceo España`);
  };

  // Exportar a CSV
  const handleExport = () => {
    const fields = ['type','client','desc','date','done','comment','nextAction','nextDate'];
    const csv = [
      fields.join(';'),
      ...items.map(i => fields.map(f => (i[f] || '').toString().replace(/;/g,',')).join(';'))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    const a = document.createElement('a');
    a.href = url; a.download = 'seguimientos_buceoespana.csv';
    a.click();
  };

  // Imprimir
  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write('<html><body><h2>Seguimientos Buceo España</h2><table border="1" cellpadding="6"><tr><th>Tipo</th><th>Cliente</th><th>Detalle</th><th>Fecha</th><th>Completado</th></tr>');
    items.forEach(i=>{
      win.document.write(`<tr>
        <td>${i.type}</td>
        <td>${i.client}</td>
        <td>${i.type==='course'?`Inmersiones: ${i.doneDives}/${i.totalDives}`:i.desc}</td>
        <td>${format(new Date(i.date), 'Pp')}</td>
        <td>${i.done?'✅':'❌'}</td>
      </tr>`);
    });
    win.document.write('</table></body></html>');
    win.print();
    win.close();
  };

  // Filtros y métricas pro
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const isToday = (d) => format(new Date(d), 'yyyy-MM-dd') === todayStr;
  const tareasHoy = items.filter(i=>isToday(i.date));
  const hechasHoy = tareasHoy.filter(i=>i.done);
  const porcentaje = tareasHoy.length === 0 ? 0 : Math.round((hechasHoy.length / tareasHoy.length) * 100);

  // Búsqueda y filtros
  let displayed = items;
  if (search) {
    displayed = displayed.filter(i => i.client.toLowerCase().includes(search.toLowerCase()));
  }
  if (filter !== 'all') {
    displayed = displayed.filter(i => i.type === filter);
  }

  // Filtro por fecha próxima acción (por defecto muestra todas)
  const pendientesHoy = displayed.filter(i => i.nextDate === todayStr && !i.done);

  // CALENDARIO SEMANAL
  const weekStart = startOfWeek(calendarWeek, { weekStartsOn: 1 });
  const daysOfWeek = Array.from({length:7}, (_,i)=>addDays(weekStart, i));
  const tareasByDay = d => items.filter(i=>isSameDay(new Date(i.date), d));

  // ICONOS visuales
  const iconType = t => t==='call'?'📞': t==='whatsapp'?'💬':'📘';
  const colorType = t => t==='call'?'#21a7e7': t==='whatsapp'?'#25D366':'#fdc500';

  // --- VISUALS ---
  return (
    <div style={{ padding:20, fontFamily:'Poppins,sans-serif', maxWidth:1200, margin:'0 auto', background:'#f7fff9', borderRadius:15 }}>
      {/* Volver */}
      <button onClick={() => window.history.back()}
        style={{ marginBottom:20, padding:'9px 20px', background:'#1cb98b', color:'#fff', border:'none', borderRadius:7, fontWeight:800, fontSize:18 }}>
        ← Volver
      </button>
      {/* Frase motivacional */}
      <h1 style={{ color:'#1cb98b', fontWeight:900, fontSize:36, marginBottom:8 }}>
        Seguimiento — Centro: {center}
      </h1>
      <div style={{ fontSize:22, fontWeight:700, color:'#fdc500', margin:'6px 0 16px 0' }}>
        {frases[Math.floor(Math.random()*frases.length)]}
      </div>
      {/* RESUMEN SUPERIOR */}
      <div style={{ display:'flex', alignItems:'center', gap:40, margin:'18px 0 32px 0', flexWrap:'wrap' }}>
        <div style={{
          flex:'1 1 180px',
          background:'#fff', color:'#222', borderRadius:12, padding:20, boxShadow:'0 2px 16px #1cb98b22',
          display:'flex', flexDirection:'column', alignItems:'center', minWidth:180
        }}>
          <div style={{fontSize:20, fontWeight:700}}>Tareas HOY</div>
          <div style={{fontSize:36, fontWeight:900, color:'#1cb98b'}}>{tareasHoy.length}</div>
          <div style={{ width:130, height:14, background:'#e9f9f2', borderRadius:6, margin:'12px 0', overflow:'hidden' }}>
            <div style={{
              width:`${porcentaje}%`, height:'100%',
              background: porcentaje>70?'#21e772': porcentaje>30?'#fdc500':'#f82d2d',
              transition:'width 0.3s'
            }}/>
          </div>
          <div style={{ fontSize:15, color:'#222', fontWeight:600 }}>
            Progreso hoy: <span style={{fontWeight:900}}>{porcentaje}%</span>
          </div>
          {porcentaje===100 && <div style={{marginTop:6, fontWeight:700, color:'#21e772', fontSize:18}}>¡Día completado! 🎉</div>}
        </div>
        <Metric label="Llamadas pendientes" value={items.filter(i => i.type==='call' && !i.done).length} icon="📞" />
        <Metric label="WhatsApps sin contestar" value={items.filter(i => i.type==='whatsapp' && !i.done).length} icon="💬" />
        <Metric label="Cursos abiertos" value={items.filter(i => i.type==='course' && i.doneDives < i.totalDives).length} icon="📘" />
        <button onClick={handleExport} style={{ background:'#21a7e7', color:'#fff', border:'none', borderRadius:8, padding:'12px 22px', fontWeight:900, fontSize:18, cursor:'pointer', marginLeft:15 }}>Exportar CSV</button>
        <button onClick={handlePrint} style={{ background:'#fdc500', color:'#222', border:'none', borderRadius:8, padding:'12px 22px', fontWeight:900, fontSize:18, cursor:'pointer' }}>Imprimir</button>
        <button onClick={()=>setShowCalendar(v=>!v)} style={{ background:'#fff', color:'#1cb98b', border:'2px solid #1cb98b', borderRadius:8, padding:'12px 22px', fontWeight:900, fontSize:18, cursor:'pointer', marginLeft:15 }}>Vista Calendario</button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleAdd} style={{ border:'2px dashed #1cb98b80', padding:20, borderRadius:10, marginBottom:32, background:'#fff', boxShadow:'0 2px 8px #1cb98b13' }}>
        <h2 style={{ color:'#1cb98b', fontWeight:800 }}>Nuevo seguimiento</h2>
        <div style={{ marginBottom:12, display:'flex', gap:15, alignItems:'center' }}>
          <label>Tipo: </label>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ padding:8, borderRadius:5 }}>
            <option value="call">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="course">Curso</option>
          </select>
          <label>Cliente: </label>
          <input value={client} onChange={e=>setClient(e.target.value)}
            style={{ padding:8, borderRadius:5, width:190 }} list="clientes-datalist" />
          <datalist id="clientes-datalist">
            {clients.map((c,i)=><option key={i} value={c.name}/>)}
          </datalist>
        </div>

        {type === 'course' ? (
          <div style={{ display:'flex', gap:18, marginBottom:8 }}>
            <div>
              <label>Total inmersiones:</label><br/>
              <input type="number" min="1" value={totalDives}
                onChange={e=>setTotalDives(e.target.value)} style={{ padding:8, borderRadius:5, width:100 }} />
            </div>
            <div>
              <label>Hechas:</label><br/>
              <input type="number" min="0" max={totalDives} value={doneDives}
                onChange={e=>setDoneDives(e.target.value)} style={{ padding:8, borderRadius:5, width:70 }} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom:8 }}>
            <label>Descripción:</label><br/>
            <input value={desc} onChange={e=>setDesc(e.target.value)} style={{ padding:8, borderRadius:5, width:'99%' }} />
          </div>
        )}
        <div style={{ marginBottom:8, display:'flex', gap:18 }}>
          <div>
            <label>Notas / Comentarios:</label><br/>
            <input value={comment} onChange={e=>setComment(e.target.value)} style={{ padding:8, borderRadius:5, width:220 }} />
          </div>
          <div>
            <label>Próxima acción:</label><br/>
            <input value={nextAction} onChange={e=>setNextAction(e.target.value)} style={{ padding:8, borderRadius:5, width:170 }} placeholder="Ej. Llamar, enviar info..." />
          </div>
          <div>
            <label>Fecha próxima acción:</label><br/>
            <input type="date" value={nextDate} onChange={e=>setNextDate(e.target.value)} style={{ padding:8, borderRadius:5 }} />
          </div>
        </div>
        <button type="submit" style={{ padding:'11px 36px', fontWeight:900, fontSize:18, background:'#1cb98b', color:'#fff', border:'none', borderRadius:7, marginTop:10 }}>Añadir</button>
      </form>

      {/* Filtros y buscador */}
      <div style={{ display:'flex', gap:15, alignItems:'center', margin:'0 0 16px 0' }}>
        <label>Filtrar por tipo:</label>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ padding:8, borderRadius:5 }}>
          <option value="all">Todos</option>
          <option value="call">Llamadas</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="course">Cursos</option>
        </select>
        <label>Búsqueda cliente:</label>
        <input value={search} onChange={e=>setSearch(e.target.value)} style={{ padding:8, borderRadius:5, width:180 }} placeholder="Escribe nombre..." />
        <label>Próximas acciones hoy:</label>
        <span style={{ fontWeight:700, color:'#fdc500' }}>{pendientesHoy.length}</span>
      </div>

      {/* CALENDARIO SEMANAL */}
      {showCalendar && (
        <div style={{marginBottom:28, border:'2px solid #fdc500', borderRadius:10, background:'#fff', padding:18}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7}}>
            <button onClick={()=>setCalendarWeek(addDays(calendarWeek, -7))} style={calendarBtn}>&larr; Semana anterior</button>
            <h3 style={{fontWeight:800, color:'#fdc500', fontSize:24}}>Calendario semanal</h3>
            <button onClick={()=>setCalendarWeek(addDays(calendarWeek, 7))} style={calendarBtn}>Semana siguiente &rarr;</button>
          </div>
          <div style={{display:'flex', gap:8}}>
            {daysOfWeek.map(day=>(
              <div key={day} style={{
                flex:'1 1 0', background:'#f6fff9', borderRadius:7, border:'1px solid #eee', padding:12,
                minWidth:140, boxShadow:'0 2px 7px #1cb98b08'
              }}>
                <div style={{fontWeight:700, color:'#1cb98b'}}>{format(day,'EEEE dd/MM')}</div>
                <ul style={{marginTop:7, paddingLeft:12}}>
                  {tareasByDay(day).map(t=>(
                    <li key={t.id} style={{
                      color:colorType(t.type), fontWeight:t.done?400:700, textDecoration:t.done?'line-through':'none'
                    }}>
                      {iconType(t.type)} {t.client}: {t.type==='course'?`Inms: ${t.doneDives}/${t.totalDives}`:t.desc}
                      <span style={{marginLeft:4}}>{t.done?'✅':'⌛'}</span>
                    </li>
                  ))}
                  {tareasByDay(day).length===0 && <li style={{color:'#aaa'}}>Sin tareas</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listado */}
      <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 8px #1cb98b08' }}>
        <thead>
          <tr>
            <th style={th}>Tipo</th>
            <th style={th}>Cliente</th>
            <th style={th}>Detalle</th>
            <th style={th}>Fecha</th>
            <th style={th}>Estado</th>
            <th style={th}>Notas</th>
            <th style={th}>Acción Próxima</th>
            <th style={th}>Fecha Acción</th>
            <th style={th}>Pro</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(item => {
            const cli = getClient(item.client);
            return (
              <tr key={item.id} style={{ borderBottom:'1px solid #eee', background: item.done?'#e7fff0':'#fff' }}>
                <td style={{...td, color:colorType(item.type), fontWeight:900}}>{iconType(item.type)} {item.type}</td>
                <td style={td}>
                  <span style={{fontWeight:700}}>{item.client}</span>
                  {cli.phone && (
                    <button title="WhatsApp" onClick={()=>handleWhatsApp(cli)} style={actBtn}>💬</button>
                  )}
                  {cli.phone && (
                    <button title="Llamar" onClick={()=>handleCall(cli)} style={actBtn}>📞</button>
                  )}
                  {cli.email && (
                    <button title="Email" onClick={()=>handleEmail(cli)} style={actBtn}>✉️</button>
                  )}
                  <Link href={`/clientes/${item.client}`}><button style={actBtn} title="Ver ficha cliente">🧑‍💻</button></Link>
                </td>
                <td style={td}>
                  {item.type==='course'
                    ? <span>Inms: {item.doneDives}/{item.totalDives}</span>
                    : item.desc}
                </td>
                <td style={td}>{format(new Date(item.date), 'Pp')}</td>
                <td style={td}>
                  <button onClick={()=>toggleDone(item.id)} style={{fontSize:18, background:'none', border:'none', cursor:'pointer'}}>
                    {item.done ? '✅' : '⌛'}
                  </button>
                </td>
                <td style={td}>
                  <EditableField
                    value={item.comment || ''}
                    onSave={val=>updateItem(item.id, val, item.nextAction, item.nextDate)}
                  />
                </td>
                <td style={td}>
                  <EditableField
                    value={item.nextAction || ''}
                    onSave={val=>updateItem(item.id, item.comment, val, item.nextDate)}
                  />
                </td>
                <td style={td}>
                  <EditableField
                    type="date"
                    value={item.nextDate || ''}
                    onSave={val=>updateItem(item.id, item.comment, item.nextAction, val)}
                  />
                </td>
                <td style={td}>
                  <button onClick={()=>handleReagendar(item)} title="Reagendar en 3 días" style={{
                    background:'#fdc500', color:'#222', border:'none', borderRadius:6, padding:'4px 9px', fontWeight:700, cursor:'pointer'
                  }}>🔄</button>
                </td>
                <td style={td}>
                  <button onClick={()=>handleDelete(item.id)} style={{ color:'red', fontSize:20, background:'none', border:'none', cursor:'pointer' }}>🗑️</button>
                </td>
              </tr>
            )
          })}
          {displayed.length===0 && (
            <tr><td colSpan={10} style={{ padding:16, textAlign:'center', color:'#888' }}>Sin registros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Métrica personalizada
const Metric = ({ label, value, icon }) => (
  <div style={{
    flex:'1 1 160px',
    background:'#1cb98b', color:'#fff',
    padding:18, borderRadius:10, textAlign:'center', minWidth:140, boxShadow:'0 2px 9px #1cb98b16'
  }}>
    <div style={{fontSize:30, marginBottom:4}}>{icon}</div>
    <small style={{ opacity:0.95, fontSize:16, fontWeight:600 }}>{label}</small>
    <div style={{ fontSize:28, marginTop:4, fontWeight:900 }}>{value}</div>
  </div>
);

// Editable inline field para notas, acción, fecha
function EditableField({ value, onSave, type="text" }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(()=>setVal(value), [value]);
  return editing ? (
    <span>
      <input
        type={type}
        value={val}
        onChange={e=>setVal(e.target.value)}
        style={{padding:5, borderRadius:4, width:type==='date'?120:140, marginRight:5}}
      />
      <button onClick={()=>{onSave(val); setEditing(false);}} style={{fontSize:15, marginLeft:2, color:'#1cb98b', background:'none', border:'none', fontWeight:700, cursor:'pointer'}}>💾</button>
      <button onClick={()=>setEditing(false)} style={{fontSize:15, marginLeft:2, color:'#f82d2d', background:'none', border:'none', fontWeight:700, cursor:'pointer'}}>✖️</button>
    </span>
  ) : (
    <span onClick={()=>setEditing(true)} style={{
      cursor:'pointer', color:!value?'#aaa':'#333', minWidth:60, display:'inline-block'
    }}>
      {value || <span style={{fontStyle:'italic', color:'#aaa'}}>Editar...</span>}
    </span>
  );
}

const th = { textAlign:'left', padding:8, background:'#e8f8f4', color:'#1cb98b', fontWeight:900, fontSize:15 };
const td = { padding:8, fontSize:15 };
const actBtn = {
  marginLeft:5, background:'#fff', border:'1px solid #1cb98b55', borderRadius:4,
  padding:'2px 5px', fontWeight:700, cursor:'pointer', fontSize:15
};
const calendarBtn = {
  background:'#fff', color:'#fdc500', border:'2px solid #fdc500',
  fontWeight:900, fontSize:15, borderRadius:6, padding:'7px 12px', cursor:'pointer'
};
