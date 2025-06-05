// pages/crm.js
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

//
// Reemplaza solamente la función parseCSV; todo lo demás está intacto.
//
function parseCSV(csvText) {
  // 1) Partimos líneas
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // 2) Detectar delimitador: si hay más ';' que ',', usamos ';'
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  // 3) Cabeceras crudas y normalizadas
  const rawHeaders = headerLine.split(delimiter).map(h => h.trim());
  const normalized = rawHeaders.map(h =>
    h
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita tildes
      .replace(/[^a-zA-Z0-9 ]/g, '')      // quita emojis y signos
      .toLowerCase()
  );

  console.log('CSV Headers:', rawHeaders);
  console.log('Normalized:', normalized, 'Delimiter:', JSON.stringify(delimiter));

  // 4) Mapeamos cada encabezado a tu campo
  const keyMap = normalized.map(h => {
    if (h.includes('nombre completo'))       return 'name';
    if (h.includes('poblacion'))             return 'city';
    if (h.includes('correo electronico'))    return 'email';
    if (h.includes('telefono de contacto') || h.includes('telefono')) return 'phone';
    if (h.includes('d.n.i') || h.includes('dni'))   return 'dni';
    if (h.includes('nivel de experiencia'))  return 'experience';
    if (h.includes('como nos has conocido')) return 'referredBy';
    if (h.includes('fecha de nacimiento'))   return 'dob';
    if (h.includes('apodo') || h.includes('nick'))       return 'nickname';
    if (h.includes('inmersiones'))           return 'divesCount';
    if (h.includes('hace cuanto que no buceas')) return 'lastDive';
    if (h.includes('intereses especiales'))  return 'interests';
    if (h.includes('palabras clave'))        return 'keywords';
    if (h.includes('preocupaciones'))        return 'concerns';
    if (h.includes('necesidades especiales')) return 'needs';
    if (h.includes('preferencia de comunicacion')) return 'commPref';
    if (h.includes('comentarios adicionales'))     return 'comments';
    return null;
  });

  // 5) Convertimos filas a objetos
  return lines.slice(1).map(line => {
    const cols = line.split(delimiter).map(c => c.trim());
    const obj = {};

    keyMap.forEach((field, i) => {
      if (!field) return;
      const raw = cols[i] || '';
      if (field === 'interests' || field === 'keywords') {
        obj[field] = raw
          .split(';')
          .map(x => x.trim())
          .filter(x => x);
      } else {
        obj[field] = raw;
      }
    });

    return {
      id: Date.now() + Math.random(),
      name:       obj.name       || '',
      city:       obj.city       || '',
      email:      obj.email      || '',
      phone:      obj.phone      || '',
      dni:        obj.dni        || '',
      experience: obj.experience || '',
      referredBy: obj.referredBy || '',
      dob:        obj.dob        || '',
      nickname:   obj.nickname   || '',
      divesCount: obj.divesCount || '',
      lastDive:   obj.lastDive   || '',
      interests:  obj.interests  || [],
      keywords:   obj.keywords   || [],
      concerns:   obj.concerns   || '',
      needs:      obj.needs      || '',
      commPref:   obj.commPref   || '',
      comments:   obj.comments   || '',
      // 💡 Inicializamos purchases y points en 0 si no vienen
      purchases:  [],
      points:     0,
      registered: new Date().toISOString()
    };
  });
}

export default function CrmPage() {
  const [center, setCenter] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCenter(localStorage.getItem('active_center'));
    }
  }, []);

  const STORAGE_KEY = center ? `dive_manager_clients_${center}` : null;
  const currentYear = new Date().getFullYear();

  const [clients, setClients] = useState([]);
  const [mode, setMode] = useState('manual');
  const [file, setFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState(
    typeof window !== 'undefined'
      ? localStorage.getItem('sheetUrl') || ''
      : ''
  );
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [yearFilter, setYearFilter] = useState(currentYear);
  const [experienceFilter, setExperienceFilter] = useState('');
  const [emailList, setEmailList] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  // Persistir sheetUrl en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sheetUrl', sheetUrl);
    }
  }, [sheetUrl]);

  const initialForm = {
    name:       '', city:       '', email:      '', phone:      '', dni:        '',
    experience: '', referredBy: '', dob:        '', nickname:   '',
    divesCount: '', lastDive:   '', interests:  [], keywords:   [], concerns:   '',
    needs:      '', commPref:   '', comments:   '', address:    '', postal:    '',
    // Campos para fidelización y compras
    purchases:  [], // [{ date, product, amount }]
    points:     0   // puntos acumulados
  };
  const [form, setForm] = useState(initialForm);

  // Carga inicial de clientes desde localStorage
  useEffect(() => {
    if (!center) return;
    const st = localStorage.getItem(STORAGE_KEY);
    if (st) {
      const arr = JSON.parse(st);
      // Asegurarnos de que cada cliente tenga purchases y points
      const normalized = arr.map(c => ({
        ...initialForm,
        ...c,
        purchases: Array.isArray(c.purchases) ? c.purchases : [],
        points:    typeof c.points === 'number' ? c.points : 0
      }));
      // Ordenar por fecha de registro descendente
      normalized.sort((a, b) => new Date(b.registered) - new Date(a.registered));
      setClients(normalized);
    }
  }, [center, STORAGE_KEY]);

  // Guardar cambios en clientes
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients, center, STORAGE_KEY]);

  // Importar CSV (con orden invertido)
  useEffect(() => {
    if (mode === 'import' && file) {
      const reader = new FileReader();
      reader.onload = e => {
        const parsed = parseCSV(e.target.result);
        setClients(parsed.reverse());
      };
      reader.readAsText(file);
    }
  }, [mode, file]);

  // Google mode: carga inicial + polling
  useEffect(() => {
    if (mode === 'google') {
      fetchSheet();
      const id = setInterval(fetchSheet, 30000);
      return () => clearInterval(id);
    }
  }, [mode, sheetUrl]);

  // --- Función para cargar Google Sheets ---
  function fetchSheet() {
    if (!sheetUrl) return;
    setError('');
    let csvUrl;
    if (sheetUrl.includes('output=csv')) {
      csvUrl = sheetUrl;
    } else {
      const m = sheetUrl.match(/\/d\/([^/]+)/);
      if (!m) {
        setError('URL de Google Sheet no válida');
        return;
      }
      const sheetId = m[1];
      const gidMatch = sheetUrl.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
    fetch(csvUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(txt => {
        const parsed = parseCSV(txt);
        setClients(parsed.reverse());
      })
      .catch(err => setError(`No se pudo cargar Google Sheet: ${err.message}`));
  }

  // Filtrado + Ordenado según el modo
  const filtered = useMemo(() => {
    // 1) Primeramente ordenamos (por fecha de registro descendente si no es “google”)
    let base = mode === 'google'
      ? [...clients].reverse()
      : [...clients].sort((a, b) =>
          new Date(b.registered) - new Date(a.registered)
        );

    // 2) Filtrar por experiencia si se ha seleccionado algo
    if (experienceFilter) {
      base = base.filter(c =>
        c.experience.toLowerCase().includes(experienceFilter.toLowerCase())
      );
    }

    // 3) Si no hay término de búsqueda, devolvemos todo
    if (!searchTerm) return base;

    // 4) Si hay texto en el input de búsqueda, filtramos por nombre, email, teléfono o ciudad
    const t = searchTerm.toLowerCase().trim();
    return base.filter(c => {
      const nameMatch  = c.name.toLowerCase().includes(t);
      const emailMatch = c.email?.toLowerCase().includes(t);
      const phoneMatch = String(c.phone || '').toLowerCase().includes(t);
      const cityMatch  = c.city?.toLowerCase().includes(t);
      return nameMatch || emailMatch || phoneMatch || cityMatch;
    });
  }, [clients, mode, searchTerm, experienceFilter]);

  // Auto-abre detalle si solo hay un resultado y se está buscando
  useEffect(() => {
    if (filtered.length === 1 && searchTerm) {
      setSelectedClient(filtered[0]);
    }
  }, [filtered, searchTerm]);

  // CRUD Actions
  const startEdit = c => {
    setEditing(c);
    setForm(c);
    setShowForm(true);
  };
  const handleAdd = e => {
    e.preventDefault();
    const nuevo = {
      ...form,
      id: Date.now(),
      registered: new Date().toISOString()
    };
    setClients(c => [nuevo, ...c]);
    setForm(initialForm);
    setShowForm(false);
    setSearchTerm('');
  };
  const handleSave = e => {
    e.preventDefault();
    setClients(c => c.map(cu => (cu.id === editing.id ? { ...editing, ...form } : cu)));
    setEditing(null);
    setForm(initialForm);
    setShowForm(false);
    setSearchTerm('');
  };
  const handleDeleteAll = () => {
    if (confirm('¿Borrar TODOS los clientes?')) setClients([]);
  };
  const handleDelete = id => {
    if (confirm('¿Borrar este cliente?')) setClients(c => c.filter(cu => cu.id !== id));
  };

  // Generar CSV y descargar (botón “Exportar Excel”)
  const exportToCSV = () => {
    const headers = ['Nombre','Ciudad','Email','Teléfono','DNI','Experiencia','Fecha Nac.','Puntos','Gastado Año'];
    const rows = filtered.map(c => {
      // Calcular gasto de año actual
      const gasto = (c.purchases || [])
        .filter(pu => new Date(pu.date).getFullYear() === currentYear)
        .reduce((s, pu) => s + pu.amount, 0);
      return [
        c.name,
        c.city,
        c.email,
        c.phone,
        c.dni,
        c.experience,
        c.dob,
        c.points || 0,
        gasto.toFixed(2)
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Recopilar correos por nivel de experiencia
  const generateEmailList = () => {
    const list = filtered
      .map(c => c.email)
      .filter(em => em)
      .join('; ');
    setEmailList(list);
  };

  // --- Para mostrar gasto anual y puntos en el formulario
  const purchasesYear = (form.purchases || []).filter(
    p => new Date(p.date).getFullYear() === yearFilter
  );
  const totalYear = purchasesYear.reduce((sum, p) => sum + p.amount, 0);

  // Obtener estadísticas rápidas en encabezado
  const totalClients = clients.length;
  const totalVIPs = clients.filter(c => (c.tags || []).includes('VIP')).length;

  if (center === null) return <p>Cargando CRM...</p>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>TPV<span style={styles.logoD}>D</span>ive</h1>
      </header>

      <main style={styles.main}>
        <div style={styles.topBar}>
          <Link href="/" style={styles.link}>← Panel principal</Link>
          <button style={styles.dangerBtn} onClick={handleDeleteAll}>Borrar todos</button>
        </div>

        {/* ======== Encabezado con métricas pequeñas ======== */}
        <div style={styles.smallMetrics}>
          <div style={styles.metricCard}>
            <small style={styles.metricLabel}>Total Clientes</small>
            <div style={styles.metricValue}>{totalClients}</div>
          </div>
          <div style={styles.metricCard}>
            <small style={styles.metricLabel}>Clientes VIP</small>
            <div style={styles.metricValue}>{totalVIPs}</div>
          </div>
        </div>

        {/* ======== Controles de búsqueda + modo ======== */}
        <div style={styles.controls}>
          <input
            list="lst"
            placeholder="Buscar por nombre, email, teléfono o ciudad..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={styles.input}
          />
          <datalist id="lst">
            {filtered.map((c, i) => <option key={i} value={c.name} />)}
          </datalist>

          <select
            value={experienceFilter}
            onChange={e => setExperienceFilter(e.target.value)}
            style={styles.inputSmall}
          >
            <option value="">— Filtrar nivel de experiencia —</option>
            {[...new Set(clients.map(c => c.experience).filter(x => x))].map((exp, i) => (
              <option key={i} value={exp}>{exp}</option>
            ))}
          </select>

          <button style={styles.tabBtn} onClick={generateEmailList}>
            Obtener Correos
          </button>
          <button style={styles.tabBtn} onClick={exportToCSV}>
            Exportar Excel
          </button>

          {['manual', 'import', 'google'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setShowForm(false); }}
              style={mode === m ? styles.activeBtn : styles.tabBtn}
            >
              {m === 'manual' ? '+ Manual'
                : m === 'import' ? 'Importar CSV'
                : 'Google Sheet'}
            </button>
          ))}
        </div>

        {mode === 'import' && (
          <input
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files[0])}
            style={styles.fileInput}
          />
        )}
        {mode === 'google' && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="URL Google Sheet"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {mode === 'manual' && !showForm && (
          <button
            style={styles.primaryBtn}
            onClick={() => {
              setForm(initialForm);
              setEditing(null);
              setShowForm(true);
            }}
          >
            + Añadir Cliente
          </button>
        )}

        {/* ======== Tabla de clientes ======== */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  'Nombre',
                  'Email',
                  'Teléfono',
                  'DNI',
                  'Fecha Nac.',
                  'Puntos',
                  `Gastado ${currentYear}`,
                  'Acciones'
                ].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                // Calcular gasto de año actual
                const gasto = (c.purchases || [])
                  .filter(pu => new Date(pu.date).getFullYear() === currentYear)
                  .reduce((s, pu) => s + pu.amount, 0);

                return (
                  <tr key={c.id} style={styles.tr}>
                    <td style={styles.td}>
                      {c.name}{' '}
                      {c.phone && (
                        <a
                          href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(c.name)},%20te%20escribimos%20desde%20Buceo%20España`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.whatsappBtn}
                          title="Enviar WhatsApp"
                        >
                          📲
                        </a>
                      )}
                    </td>
                    <td style={styles.td}>{c.email}</td>
                    <td style={styles.td}>{c.phone}</td>
                    <td style={styles.td}>{c.dni}</td>
                    <td style={styles.td}>{c.dob}</td>
                    <td style={styles.td}>{c.points || 0}</td>
                    <td style={styles.td}>{gasto.toFixed(2)}€</td>
                    <td style={styles.td}>
                      <button
                        style={styles.smallBtn}
                        onClick={() => setSelectedClient(c)}
                      >
                        Ver
                      </button>{' '}
                      <button style={styles.smallBtn} onClick={() => startEdit(c)}>Editar</button>{' '}
                      <button style={styles.smallDangerBtn} onClick={() => handleDelete(c.id)}>Borrar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ======== Formulario manual / edición ======== */}
        {showForm && (
          <form onSubmit={editing ? handleSave : handleAdd} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formCol}>
                <label style={styles.label}>Nombre completo 📝</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>Email 📧</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>Teléfono 📱</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>DNI 📄</label>
                <input
                  value={form.dni}
                  onChange={e => setForm({ ...form, dni: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>Fecha de Nacimiento 🔍</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={e => setForm({ ...form, dob: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formCol}>
                <label style={styles.label}>Nivel de experiencia</label>
                <input
                  value={form.experience}
                  onChange={e => setForm({ ...form, experience: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>¿Cómo nos has conocido? 🤗</label>
                <input
                  value={form.referredBy}
                  onChange={e => setForm({ ...form, referredBy: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>Dirección completa</label>
                <input
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  style={styles.input}
                />
                <label style={styles.label}>Código Postal</label>
                <input
                  value={form.postal}
                  onChange={e => setForm({ ...form, postal: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formCol}>
                <label style={styles.label}>Intereses especiales</label>
                <select
                  multiple
                  value={form.interests}
                  onChange={e => setForm({
                    ...form,
                    interests: [...e.target.selectedOptions].map(o => o.value)
                  })}
                  style={styles.selectMulti}
                >
                  <option>Fotografía submarina</option>
                  <option>Cueva</option>
                  <option>Mantarrayas</option>
                  <option>Arrecifes</option>
                </select>

                <label style={styles.label}>Palabras clave</label>
                <select
                  multiple
                  value={form.keywords}
                  onChange={e => setForm({
                    ...form,
                    keywords: [...e.target.selectedOptions].map(o => o.value)
                  })}
                  style={styles.selectMulti}
                >
                  <option>Aventura</option>
                  <option>Relajación</option>
                  <option>Aprendizaje</option>
                </select>

                <label style={styles.label}>Comentarios adicionales 💡</label>
                <textarea
                  value={form.comments}
                  onChange={e => setForm({ ...form, comments: e.target.value })}
                  style={styles.textarea}
                />
              </div>
            </div>

            {/* — Nuevos — sección de Compras filtradas por año — */}
            <div style={{ marginTop: 24 }}>
              <h3>
                Compras de {yearFilter}{' '}
                <button
                  type="button"
                  onClick={() => setYearFilter(y => Math.max(y - 1, 2000))}
                  style={styles.smallBtn}
                >
                  &lt;
                </button>{' '}
                <button
                  type="button"
                  onClick={() => setYearFilter(y => Math.min(y + 1, currentYear))}
                  style={styles.smallBtn}
                >
                  &gt;
                </button>
              </h3>
              <ul>
                {purchasesYear.map((p, i) => (
                  <li key={i}>
                    {p.date.slice(0, 10)} – {p.product}: {p.amount.toFixed(2)}€
                  </li>
                ))}
              </ul>
              <p>
                <strong>Total en {yearFilter}:</strong> {totalYear.toFixed(2)}€
              </p>
            </div>

            {/* — Nuevo — mostrar puntos actuales — */}
            <div style={{ marginTop: 24 }}>
              <h3>Puntos acumulados: {form.points || 0}</h3>
              {form.points >= 100 && (
                <p style={{ color: '#0070f3', fontWeight: 600 }}>
                  🎉 ¡Este cliente puede canjear 100 puntos por 10% de descuento!
                </p>
              )}
            </div>

            <div style={styles.formActions}>
              <button type="submit" style={styles.primaryBtn}>
                {editing ? 'Guardar' : 'Añadir Cliente'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                  setForm(initialForm);
                  setSearchTerm('');
                }}
                style={styles.smallDangerBtn}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ======== Vista de correos recopilados ======== */}
      {emailList && (
        <div style={styles.emailModalOverlay}>
          <div style={styles.emailModalContent}>
            <h2>Lista de Correos</h2>
            <textarea
              readOnly
              value={emailList}
              style={styles.emailListBox}
            />
            <button
              onClick={() => setEmailList('')}
              style={styles.modalCloseBtn}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ======== Ventana emergente con datos básicos ======== */}
      {selectedClient && (
        <div style={styles.emailModalOverlay}>
          <div style={styles.emailModalContent}>
            <h2>{selectedClient.name}</h2>
            <p><strong>Email:</strong> {selectedClient.email}</p>
            <p><strong>Teléfono:</strong> {selectedClient.phone}</p>
            <p><strong>Ciudad:</strong> {selectedClient.city}</p>
            <p><strong>Fecha Nac.:</strong> {selectedClient.dob}</p>
            <p><strong>Puntos:</strong> {selectedClient.points || 0}</p>
            <p>
              <strong>Gastado {currentYear}:</strong>{' '}
              {(
                (selectedClient.purchases || [])
                  .filter(pu => new Date(pu.date).getFullYear() === currentYear)
                  .reduce((s, pu) => s + pu.amount, 0)
              ).toFixed(2)}€
            </p>
            <button
              onClick={() => { setSelectedClient(null); setSearchTerm(''); }}
              style={styles.modalCloseBtn}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== Estilos en línea actualizados ======
const styles = {
  page: {
    backgroundColor: '#f2f6fc',
    minHeight: '100vh',
    padding: 0           // <— quitar padding a los laterales
  },
  header: {
    background: '#fff',
    padding: '12px 24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '16px',
    borderRadius: '4px'
  },
  logo: {
    margin: 0,
    fontFamily: 'Georgia, serif',
    fontSize: 24,
    color: '#222'
  },
  logoD: { color: 'red' },

  main: {
    width: '100vw',       // Ocupa TODO el ancho de la ventana
    maxWidth: '100vw',    // Nos aseguramos de que no se limite a 960px
    margin: 0,            // Sin márgenes
    background: '#fff',
    borderRadius: 8,      // Puedes quitarlo (0) si quieres bordes cuadrados
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    padding: 24,          // Padding interior para no quedar pegado al borde
    minHeight: '80vh'
  },

  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  link: {
    textDecoration: 'none',
    color: '#0070f3',
    fontWeight: 500
  },
  dangerBtn: {
    background: '#d9534f',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer'
  },

  /* Pequeñas métricas */
  smallMetrics: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  },
  metricCard: {
    flex: '1 1 200px',
    background: '#0d47a1',
    color: '#fff',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  metricLabel: { opacity: 0.8, fontSize: '14px' },
  metricValue: { fontSize: '24px', marginTop: '4px' },

  /* Controles de búsqueda y modo */
  controls: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap'
  },
  input: {
    padding: 8,
    borderRadius: 4,
    border: '1px solid #ccc',
    flex: '1 1 200px',
    fontSize: 14
  },
  inputSmall: {
    padding: 8,
    borderRadius: 4,
    border: '1px solid #ccc',
    flex: '0 1 180px',
    fontSize: 14
  },
  tabBtn: {
    background: '#e0f0ff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer'
  },
  activeBtn: {
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer'
  },
  fileInput: { marginBottom: 16 },
  error: { color: 'red', marginTop: 4 },

  /* Botón principal en modo manual */
  primaryBtn: {
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    marginBottom: '16px'
  },

  /* Tabla de clientes */
  tableWrapper: {
    maxHeight: '70vh',
    overflowY: 'auto',
    border: '1px solid #ddd',
    borderRadius: 4,
    marginBottom: 16
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    position: 'sticky',
    top: 0,
    background: '#f5f5f5',
    borderBottom: '2px solid #ddd',
    padding: 8,
    textAlign: 'left'
  },
  tr: { background: '#fff' },
  td: { borderBottom: '1px solid #eee', padding: 8 },
  smallBtn: {
    background: '#28a745',
    color: '#fff',
    border: 'none',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    marginRight: '4px'
  },
  smallDangerBtn: {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12
  },
  whatsappBtn: {
    marginLeft: '6px',
    fontSize: '18px',
    textDecoration: 'none'
  },

  /* Formulario manual / edición */
  form: {
    border: '1px solid #ddd',
    borderRadius: 4,
    padding: 16,
    marginTop: 16,
    overflowX: 'auto'
  },
  formRow: { display: 'flex', gap: 16, flexWrap: 'wrap' },
  formCol: { flex: '1 1 300px', minWidth: '250px' },
  label: { display: 'block', marginBottom: 4, fontWeight: 500 },
  textarea: {
    width: '100%',
    padding: 8,
    borderRadius: 4,
    border: '1px solid #ccc',
    fontSize: 14,
    resize: 'vertical'
  },
  selectMulti: {
    width: '100%',
    height: 80,
    padding: 8,
    border: '1px solid #ccc',
    borderRadius: 4,
    fontSize: 14,
    marginBottom: '12px'
  },
  formActions: {
    marginTop: 16,
    textAlign: 'right'
  },

  /* Modal de lista de correos */
  emailModalOverlay: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.3)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000
  },
  emailModalContent: {
    background: '#fff',
    borderRadius: 8,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    boxShadow: '0 6px 32px rgba(0,0,0,0.1)'
  },
  emailListBox: {
    width: '100%',
    height: 200,
    padding: 8,
    fontSize: 14,
    borderRadius: 4,
    border: '1px solid #ccc',
    marginBottom: 16,
    resize: 'none'
  },
  modalCloseBtn: {
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '8px 16px',
    fontSize: 14,
    cursor: 'pointer'
  }
};
