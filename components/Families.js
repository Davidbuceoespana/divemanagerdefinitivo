// components/Families.js
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Families() {
  // 1) Saber cuándo estamos ya en cliente y cuál es el centro activo
  const [mounted, setMounted] = useState(false);
  const [center, setCenter] = useState("");

  // 2) Estados para gestionar familias y formulario (input + edición)
  const [families, setFamilies] = useState([]);
  const [input, setInput] = useState("");
  const [editIdx, setEditIdx] = useState(-1);

  // 3) Al montarse en el cliente, leemos 'active_center' y marcamos 'mounted'
  useEffect(() => {
    if (typeof window !== "undefined") {
      const c = localStorage.getItem("active_center") || "";
      setCenter(c);
      setMounted(true);
    }
  }, []);

  // 4) Key dinámica para localStorage según el centro
  const STORAGE_KEY = `dive_manager_families_${center}`;

  // 5) Cargar familias guardadas *solo* cuando ya estamos montados y existe un center no vacío
  useEffect(() => {
    if (!mounted || !center) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setFamilies(arr);
        }
      } catch {
        console.error("No se pudo parsear la lista de familias en localStorage");
      }
    }
  }, [mounted, center, STORAGE_KEY]);

  // 6) Cada vez que cambie `families` (y exista un center), persistimos en localStorage
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(families));
  }, [families, center, STORAGE_KEY]);

  // 7) Early returns: mostrar mensajes antes de renderizar la UI
  if (!mounted) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Cargando Familias…</p>
      </div>
    );
  }
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

  // 8) Handlers de añadir/editar/borrar
  const handleSubmit = (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;

    // Si estamos editando, sustituir en la posición correspondiente
    if (editIdx >= 0) {
      setFamilies((prev) =>
        prev.map((x, i) => (i === editIdx ? val : x))
      );
    } else {
      // Si la familia no existe aún, añadirla
      if (!families.includes(val)) {
        setFamilies((prev) => [...prev, val]);
      } else {
        alert("Esa familia ya existe.");
      }
    }

    setInput("");
    setEditIdx(-1);
  };

  const handleEdit = (i) => {
    setInput(families[i]);
    setEditIdx(i);
  };

  const handleDelete = (i) => {
    if (
      confirm(
        `¿Seguro que quieres borrar la familia “${families[i]}”?\nEsta acción no se puede deshacer.`
      )
    ) {
      setFamilies((prev) => prev.filter((_, idx) => idx !== i));
      if (editIdx === i) {
        setInput("");
        setEditIdx(-1);
      }
    }
  };

  // 9) Render UI principal
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
          {editIdx >= 0 ? "Actualizar" : "Añadir"}
        </button>
        {editIdx >= 0 && (
          <button
            type="button"
            onClick={() => {
              setInput("");
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

// 10) Estilos en línea
const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    maxWidth: "600px",
    margin: "0 auto",
    background: "#f7f9fb",
    borderRadius: "8px",
    marginTop: "40px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
  },
  title: {
    margin: 0,
    marginBottom: "12px",
    fontSize: "22px",
    color: "#003566",
    textAlign: "center"
  },
  link: {
    display: "inline-block",
    marginBottom: "16px",
    color: "#0070f3",
    textDecoration: "none"
  },
  loadingText: {
    fontSize: "18px",
    color: "#666",
    textAlign: "center"
  },
  errorText: {
    color: "red",
    marginBottom: "12px",
    textAlign: "center"
  },
  form: {
    display: "flex",
    gap: "8px",
    margin: "20px 0"
  },
  input: {
    flex: 1,
    padding: "8px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #ccc"
  },
  addBtn: {
    padding: "8px 12px",
    background: "#17bf6e",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: 600
  },
  cancelBtn: {
    padding: "8px 12px",
    background: "#888",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginLeft: "8px",
    fontSize: "14px"
  },
  noDataText: {
    color: "#666",
    fontStyle: "italic"
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0
  },
  listItem: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "6px",
    padding: "10px 12px",
    marginBottom: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  familyName: {
    fontSize: "16px",
    color: "#003566"
  },
  editBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    marginRight: "8px"
  },
  deleteBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    color: "#f5576c"
  }
};
