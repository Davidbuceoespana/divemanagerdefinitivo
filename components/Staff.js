// components/Staff.js
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dive_manager_staff';

export default function Staff() {
  // ————— Estado centro activo —————
  const [center, setCenter] = useState('');

  // ————— Estado de staff y formulario —————
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ id: null, name: '', dob: '', email: '', phone: '' });
  const [editId, setEditId] = useState(null);

  // ————— 0) Leer centro activo al montar —————
  useEffect(() => {
    const c = localStorage.getItem('active_center');
    if (c) setCenter(c);
  }, []);

  // ————— 1) Construir clave dinámica según centro —————
  // Si no hay centro, caemos en la clave por defecto STORAGE_KEY
  const baseName = center.toLowerCase().replace(/\s+/g, '');
  const storageKey = center
    ? `${STORAGE_KEY}_${baseName}`
    : STORAGE_KEY;

  // ————— 2) Carga inicial de staff según la clave dinámica —————
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setStaff(JSON.parse(stored));
  }, [storageKey]);

  // ————— 3) Persistencia de staff en localStorage —————
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(staff));
  }, [staff, storageKey]);

  // ————— Handlers existentes (sin modificar) —————
  const handleSubmit = e => {
    e.preventDefault();
    if (editId) {
      setStaff(prev => prev.map(s => s.id === editId ? { ...form, id: editId } : s));
      setEditId(null);
    } else {
      setStaff(prev => [...prev, { ...form, id: Date.now() }]);
    }
    setForm({ id: null, name: '', dob: '', email: '', phone: '' });
  };

  const handleEdit = s => {
    setForm({ id: s.id, name: s.name, dob: s.dob, email: s.email, phone: s.phone });
    setEditId(s.id);
  };

  const handleDelete = id => {
    setStaff(prev => prev.filter(s => s.id !== id));
    if (editId === id) {
      setEditId(null);
      setForm({ id: null, name: '', dob: '', email: '', phone: '' });
    }
  };

  // ————— Renderizado —————
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h2>Gestión de Staff</h2>
      {/* Mostrar centro activo, si existe */}
      {center && (
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>
          Centro: {center}
        </h3>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Nombre"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          type="date"
          placeholder="Fecha de nacimiento"
          value={form.dob}
          onChange={e => setForm({ ...form, dob: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          type="tel"
          placeholder="Teléfono"
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          required
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <button type="submit" style={{ marginRight: 8 }}>
          {editId ? 'Actualizar' : 'Añadir'}
        </button>
        {editId && (
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setForm({ id: null, name: '', dob: '', email: '', phone: '' });
            }}
          >
            Cancelar
          </button>
        )}
      </form>

      <ul>
        {staff.map(s => (
          <li key={s.id} style={{ marginBottom: 6 }}>
            <strong>{s.name}</strong> | Nac: {s.dob} | {s.email} | {s.phone}
            <button onClick={() => handleEdit(s)} style={{ marginLeft: 8 }}>✏️</button>
            <button onClick={() => handleDelete(s.id)} style={{ marginLeft: 4 }}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
