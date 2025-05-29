// components/Families.js
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Families() {
  // 1) Centro activo
 const [center, setCenter] = useState(null);

useEffect(() => {
  if (typeof window !== "undefined") {
    const c = localStorage.getItem('active_center');
    setCenter(c);
  }
}, []);

if (center === null) return <p>Cargando CRM...</p>;
if (!center) return <p>Debes seleccionar un centro activo.</p>;
  // 2) Clave dinámica
  const STORAGE_KEY = `dive_manager_families_${center}`;

  // 3) Estados
  const [families, setFamilies] = useState([]);
  const [input, setInput]       = useState('');
  const [editIdx, setEditIdx]   = useState(-1);

  // 4) Carga inicial
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setFamilies(JSON.parse(raw));
  }, [center]);

  // 5) Persiste cambios
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(families));
  }, [families, center]);

  // 6) Handlers
  const handleSubmit = e => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    if (editIdx >= 0) {
      setFamilies(f => f.map((x,i) => i === editIdx ? val : x));
    } else {
      setFamilies(f => [...f, val]);
    }
    setInput('');
    setEditIdx(-1);
  };
  const handleEdit   = i => {
    setInput(families[i]);
    setEditIdx(i);
  };
  const handleDelete = i => {
    setFamilies(f => f.filter((_,j) => j !== i));
    if (editIdx === i) {
      setInput('');
      setEditIdx(-1);
    }
  };

  return (
    <div style={{ padding:20, fontFamily:'sans-serif' }}>
      <h2>Gestión de Familias — Centro: {center}</h2>

      {/* ← Volver sin <a> interno */}
      <Link href="/" style={{ color:'#0070f3', textDecoration:'none' }}>
        ← Panel principal
      </Link>

      <form onSubmit={handleSubmit} style={{ margin:'20px 0' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nombre de familia"
          required
          style={{ width:'70%', padding:6, marginRight:8 }}
        />
        <button type="submit">
          {editIdx >= 0 ? 'Actualizar' : 'Añadir'}
        </button>
        {editIdx >= 0 && (
          <button
            type="button"
            onClick={() => { setInput(''); setEditIdx(-1); }}
            style={{ marginLeft:8 }}
          >
            Cancelar
          </button>
        )}
      </form>

      <ul>
        {families.map((f,i) => (
          <li key={i} style={{ marginBottom:6 }}>
            {f}
            <button onClick={() => handleEdit(i)} style={{ marginLeft:8 }}>✏️</button>
            <button onClick={() => handleDelete(i)} style={{ marginLeft:4 }}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
