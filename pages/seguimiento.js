// pages/seguimiento.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function SeguimientoPage() {
  // Evitar SSR
  if (typeof window === 'undefined') return null;

  // Centro activo
  const center = localStorage.getItem('active_center');
  if (!center) return <p>Elige un centro</p>;

  const STORAGE_KEY = `dive_manager_tracking_${center}`;

  // Estados
  const [items, setItems] = useState([]);
  const [type, setType] = useState('call'); // 'call' | 'whatsapp' | 'course'
  const [client, setClient] = useState('');
  const [desc, setDesc] = useState('');
  const [totalDives, setTotalDives] = useState(0);
  const [doneDives, setDoneDives] = useState(0);
  const [filter, setFilter] = useState('all');

  // Carga inicial
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    setItems(JSON.parse(raw));
  }, [center]);

  // Persistir
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, center]);

  // Añadir nuevo ítem
  const handleAdd = e => {
    e.preventDefault();
    if (!client.trim()) return alert('Pon el nombre del cliente');
    const base = { id: Date.now(), type, client: client.trim(), date: new Date().toISOString(), done: false };
    let newItem;
    if (type === 'course') {
      if (totalDives < 1) return alert('Pon total de inmersiones');
      newItem = { ...base, totalDives: Number(totalDives), doneDives: Number(doneDives) };
    } else {
      if (!desc.trim()) return alert('Pon descripción');
      newItem = { ...base, desc: desc.trim() };
    }
    setItems([newItem, ...items]);
    // reset form
    setClient(''); setDesc(''); setTotalDives(0); setDoneDives(0);
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

  // Métricas
  const calls = items.filter(i => i.type === 'call' && !i.done).length;
  const whats = items.filter(i => i.type === 'whatsapp' && !i.done).length;
  const coursesOpen = items.filter(i => i.type === 'course' && i.doneDives < i.totalDives).length;

  // Listado filtrado
  const displayed = items.filter(i => filter === 'all' || i.type === filter);

  return (
    <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:800, margin:'0 auto' }}>
      <button onClick={() => window.history.back()}
        style={{ marginBottom:20, padding:'6px 12px', background:'#0070f3', color:'#fff', border:'none', borderRadius:4 }}>
        ← Volver
      </button>
      <h1>Seguimiento — Centro: {center}</h1>

      {/* Métricas */}
      <div style={{ display:'flex', gap:16, margin:'20px 0', flexWrap:'wrap' }}>
        <Metric label="Llamadas pendientes" value={calls} />
        <Metric label="WhatsApps sin contestar" value={whats} />
        <Metric label="Cursos abiertos" value={coursesOpen} />
      </div>

      {/* Formulario */}
      <form onSubmit={handleAdd} style={{ border:'1px solid #ddd', padding:16, borderRadius:4, marginBottom:24 }}>
        <h2>Nuevo registro</h2>
        <div style={{ marginBottom:8 }}>
          <label>Tipo: </label>
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="call">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="course">Curso</option>
          </select>
        </div>

        <div style={{ marginBottom:8 }}>
          <label>Cliente: </label>
          <input value={client} onChange={e=>setClient(e.target.value)}
            style={{ padding:6, width:'60%' }} />
        </div>

        {type === 'course' ? (
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <div>
              <label>Total inmersiones:</label><br/>
              <input type="number" min="1" value={totalDives}
                onChange={e=>setTotalDives(e.target.value)} style={{ padding:6, width:120 }} />
            </div>
            <div>
              <label>Hechas:</label><br/>
              <input type="number" min="0" max={totalDives} value={doneDives}
                onChange={e=>setDoneDives(e.target.value)} style={{ padding:6, width:80 }} />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom:8 }}>
            <label>Descripción:</label><br/>
            <input value={desc} onChange={e=>setDesc(e.target.value)} style={{ padding:6, width:'100%' }} />
          </div>
        )}

        <button type="submit" style={{ padding:'6px 12px' }}>Añadir</button>
      </form>

      {/* Filtro */}
      <div style={{ marginBottom:12 }}>
        <label>Filtrar: </label>
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">Todos</option>
          <option value="call">Llamadas</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="course">Cursos</option>
        </select>
      </div>

      {/* Listado */}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Tipo</th>
            <th style={th}>Cliente</th>
            <th style={th}>Detalle</th>
            <th style={th}>Fecha</th>
            <th style={th}>Estado</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {displayed.map(item => (
            <tr key={item.id} style={{ borderBottom:'1px solid #eee' }}>
              <td style={td}>{item.type}</td>
              <td style={td}>{item.client}</td>
              <td style={td}>
                {item.type==='course'
                  ? `Inmersiones: ${item.doneDives}/${item.totalDives}`
                  : item.desc}
              </td>
              <td style={td}>{format(new Date(item.date), 'Pp')}</td>
              <td style={td}>
                <button onClick={()=>toggleDone(item.id)}>
                  {item.done ? '✅' : '⌛'}
                </button>
              </td>
              <td style={td}>
                <button onClick={()=>handleDelete(item.id)} style={{ color:'red' }}>🗑️</button>
              </td>
            </tr>
          ))}
          {displayed.length===0 && (
            <tr><td colSpan={6} style={{ padding:12, textAlign:'center' }}>Sin registros.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Componentes auxiliares
const Metric = ({ label, value }) => (
  <div style={{
    flex:'1 1 150px',
    background:'#222',
    color:'#fff',
    padding:16,
    borderRadius:8,
    textAlign:'center',
    minWidth:150
  }}>
    <small style={{ opacity:0.8 }}>{label}</small>
    <div style={{ fontSize:24, marginTop:4 }}>{value}</div>
  </div>
);

const th = { textAlign:'left', padding:8, background:'#f5f5f5' };
const td = { padding:8 };
