// components/Families.js
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Families() {
  // 1) Estado para saber cuándo ya estamos en cliente
  const [mounted, setMounted] = useState(false);
  // 2) Centro activo (se lee de localStorage solo en cliente)
  const [center, setCenter] = useState(null);

  useEffect(() => {
    // Este useEffect solo corre en el cliente
    if (typeof window !== 'undefined') {
      const c = localStorage.getItem('active_center');
      setCenter(c || '');
      setMounted(true);
    }
  }, []);

  // 3) Mientras no estemos montados en cliente, mostramos "Cargando"
  if (!mounted) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Cargando Familias…</p>
      </div>
    );
  }

  // 4) Si ya estamos montados pero no hay centro seleccionado
  if (!center) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>Gestión de Familias</h2>
        <p style={styles.errorText}>Debes seleccionar un centro activo primero.</p>
        <Link href="/" style={styles.link}>
          ← Volver al panel principal
        </Link>
      </div>
    );
  }

  // 5) Clave dinámica en localStorage para este centro
  const STORAGE_KEY = `dive_manager_families_${center}`;

  // 6) Estados: lista de familias, input, índice de edición
  const [families, setFamilies] = useState([]);
  const [input, setInput] = useState('');
  const [editIdx, setEditIdx] = useState(-1);

  // 7) Carga inicial de familias cuando cambie STORAGE_KEY
  useEffect(() => {
    // Solo si existe un center válido (cadena no vacía)
    if (center) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            setFamilies(arr);
          }
        } catch {
          console.error('Error parseando familias desde localStorage');
        }
      }
    }
    // Nota: no incluimos "families" en la dependencia para no caer en bucle
  }, [STORAGE_KEY, center]);

  // 8) Persiste cambios en localStorage cada vez que families cambie
  useEffect(() => {
    if (center) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(families));
    }
  }, [families, STORAGE_KEY, center]);

  // 9) Handlers
  const handleSubmit = (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;

    if (editIdx >= 0) {
      // Actualizamos la familia existente
      setFamilies((prev) =>
        prev.map((x, i) => (i === editIdx ? val : x))
      );
    } else {
      // Añadimos nueva familia al final
      if (!families.includes(val)) {
        setFamilies((prev) => [...prev, val]);
      } else {
        alert('Esa familia ya existe.');
      }
    }

    setInput('');
    setEditIdx(-1);
  };

  const handleEdit = (i) => {
    setInput(families[i]);
    setEditIdx(i);
  };

  const handleDelete = (i) => {
    if (
      confirm(
        `¿Seguro que quieres borrar la familia “${families[i]}”?\nEsto no tiene vuelta atrás.`
      )
    ) {
      setFamilies((prev) => prev.filter((_, idx) => idx !== i));
      if (editIdx === i) {
        setInput('');
        setEditIdx(-1);
      }
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Gestión de Familias — Centro: {center}</h2>
      <Link href="/" style={styles.link}>
        ← Volver al panel principal
      </Link>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Nombre de familia"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" style={styles.addBtn}>
          {editIdx >= 0 ? 'Actualizar' : 'Añadir'}
        </button>
        {editIdx >= 0 && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              setEditIdx(-1);
            }}
            style={styles.cancelBtn}
          >
            Cancelar
          </button>
        )}
      </form>

      {families.length === 0 ? (
        <p style={styles.noDataText}>No hay familias registradas aún.</p>
      ) : (
        <ul style={styles.list}>
          {families.map((f, i) => (
            <li key={i} style={styles.listItem}>
              <span style={styles.familyName}>{f}</span>
              <div>
                <button
                  onClick={() => handleEdit(i)}
                  style={styles.editBtn}
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(i)}
                  style={styles.deleteBtn}
                  title="Borrar"
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 10) Estilos en línea (puedes reemplazarlos por tu CSS o Tailwind si gustas)
const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
    background: '#f7f9fb',
    borderRadius: '8px',
    marginTop: '40px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    marginBottom: '12px',
    fontSize: '22px',
    color: '#003566',
    textAlign: 'center',
  },
  link: {
    display: 'inline-block',
    marginBottom: '16px',
    color: '#0070f3',
    textDecoration: 'none',
  },
  loadingText: {
    fontSize: '18px',
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: '12px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    gap: '8px',
    margin: '20px 0',
  },
  input: {
    flex: 1,
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
  },
  addBtn: {
    padding: '8px 12px',
    background: '#17bf6e',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  cancelBtn: {
    padding: '8px 12px',
    background: '#888',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '8px',
    fontSize: '14px',
  },
  noDataText: {
    color: '#666',
    fontStyle: 'italic',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  familyName: {
    fontSize: '16px',
    color: '#003566',
  },
  editBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    marginRight: '8px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    color: '#f5576c',
  },
};

