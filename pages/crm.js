import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

// =============================================================
// CRM SUPREMO + QR REGISTRO
// - 7 campos por cliente: name, dob, email, phone, address, dni, certification
// - Import CSV / Google Sheet / Export CSV / Lista emails
// - Grid de tarjetas + Modal "Ver" con EDICIÓN inline
// - Filtro por Titulación + búsqueda dentro del filtro
// - Modal para AÑADIR cliente (limpio y guiado)
// - Botón QR de REGISTRO ONLINE (descargable + copiar link)
// - Sin dependencias nuevas: QR generado por servicio de imagen (CORS OK)
// =============================================================

// =================== CSV PARSER ===============================
function parseCSV(csvText) {
  const lines = (csvText || '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detectar delimitador por primera línea
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  // Normalizador de texto de cabecera
  const norm = (s) => (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // Cabeceras crudas y normalizadas
  const rawHeaders = headerLine.split(delimiter).map(h => h.trim());
  const headers = rawHeaders.map(norm);

  // Func para localizar índices de campos (admite variantes)
  const idx = (predicates) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (predicates.some(p => p(h))) return i;
    }
    return -1;
  };

  // Nombre: puede venir en una columna o separadas
  const nameIdx = idx([
    h => h.includes('nombre y apellidos'),
    h => h === 'nombre completo',
    h => h === 'name',
    h => h.includes('full name'),
  ]);
  const firstNameIdx = nameIdx === -1 ? idx([h => h === 'nombre', h => h.includes('first')]) : -1;
  const lastNameIdx  = nameIdx === -1 ? idx([h => h.includes('apellidos'), h => h.includes('last')]) : -1;

  const dobIdx = idx([
    h => h.includes('fecha de nacimiento'),
    h => h.includes('fecha nacimiento'),
    h => h === 'nacimiento',
    h => h === 'dob',
  ]);

  const emailIdx = idx([h => h.includes('correo electronico'), h => h === 'email', h => h.includes('correo')]);
  const phoneIdx = idx([h => h.includes('telefono'), h => h.includes('movil'), h => h.includes('celular'), h => h.includes('phone')]);

  const addressIdx = idx([
    h => h.includes('direccion completa'),
    h => h === 'direccion',
    h => h === 'direccion postal',
    h => h.includes('address'),
  ]);

  const dniIdx = idx([h => h === 'dni', h => h.includes('d n i'), h => h === 'nie', h => h.includes('documento'), h => h === 'id']);

  const certIdx = idx([
    h => h.includes('titulacion de buceo'),
    h => h === 'titulacion',
    h => h.includes('certificacion'),
    h => h.includes('certification'),
    h => h.includes('nivel de buceo'),
    h => h === 'nivel',
    h => h.includes('qualification'),
  ]);

  return lines.slice(1).map(line => {
    const cols = line.split(delimiter).map(c => c.trim());

    let name = '';
    if (nameIdx !== -1) {
      name = cols[nameIdx] || '';
    } else if (firstNameIdx !== -1 || lastNameIdx !== -1) {
      const fn = firstNameIdx !== -1 ? (cols[firstNameIdx] || '') : '';
      const ln = lastNameIdx  !== -1 ? (cols[lastNameIdx]  || '') : '';
      name = `${fn} ${ln}`.trim();
    }

    const obj = {
      id: Date.now() + Math.random(),
      name,
      dob:        dobIdx     !== -1 ? (cols[dobIdx]    || '') : '',
      email:      emailIdx   !== -1 ? (cols[emailIdx]  || '') : '',
      phone:      phoneIdx   !== -1 ? (cols[phoneIdx]  || '') : '',
      address:    addressIdx !== -1 ? (cols[addressIdx]|| '') : '',
      dni:        dniIdx     !== -1 ? (cols[dniIdx]    || '') : '',
      certification: certIdx !== -1 ? (cols[certIdx]   || '') : '',
      purchases:  [],
      points:     0,
      registered: new Date().toISOString(),
    };

    // Limpieza ligera
    obj.phone = (obj.phone || '').replace(/\s+/g, ' ').trim();
    obj.email = (obj.email || '').trim();
    obj.dni   = (obj.dni   || '').trim().toUpperCase();

    return obj;
  });
}

export default function CrmPage() {
  const [center, setCenter] = useState(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCenter(localStorage.getItem('active_center'));
      setOrigin(window.location.origin);
    }
  }, []);

  const STORAGE_KEY = center ? `dive_manager_clients_${center}` : null;
  const currentYear = new Date().getFullYear();

  const [clients, setClients] = useState([]);
  const [mode, setMode] = useState('manual'); // manual | import | google
  const [file, setFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState(typeof window !== 'undefined' ? localStorage.getItem('sheetUrl') || '' : '');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [emailList, setEmailList] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedEdit, setSelectedEdit] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [certFilter, setCertFilter] = useState('');
  const [validationErr, setValidationErr] = useState('');

  // QR modal state
  const [showQR, setShowQR] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [qrImgUrl, setQrImgUrl] = useState('');
  const [qrBlobUrl, setQrBlobUrl] = useState('');

  // Persistir sheetUrl
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('sheetUrl', sheetUrl); }, [sheetUrl]);

  // ======= Modelo de cliente (7 campos + meta) =======
  const initialForm = {
    name: '', dob: '', email: '', phone: '', address: '', dni: '', certification: '', purchases: [], points: 0,
  };
  const [form, setForm] = useState(initialForm);

  // ======= Carga inicial & migración suave =======
  useEffect(() => {
    if (!center) return;
    const st = localStorage.getItem(STORAGE_KEY);
    if (!st) return;
    const arr = JSON.parse(st);

    const normalized = arr.map((c) => {
      const name = c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
      return {
        id: c.id || Date.now() + Math.random(),
        name: name || '',
        dob: c.dob || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || c.direccion || c.city || '',
        dni: c.dni || c.nie || '',
        certification: c.certification || c.titulacion || c.experience || '',
        purchases: Array.isArray(c.purchases) ? c.purchases : [],
        points: typeof c.points === 'number' ? c.points : 0,
        registered: c.registered || new Date().toISOString(),
      };
    });

    normalized.sort((a, b) => new Date(b.registered) - new Date(a.registered));
    setClients(normalized);
  }, [center, STORAGE_KEY]);

  // Guardar cambios en clientes
  useEffect(() => { if (!center) return; localStorage.setItem(STORAGE_KEY, JSON.stringify(clients)); }, [clients, center, STORAGE_KEY]);

  // Importar CSV
  useEffect(() => {
    if (mode === 'import' && file) {
      const reader = new FileReader();
      reader.onload = (e) => { const parsed = parseCSV(e.target.result); setClients(parsed.reverse()); };
      reader.readAsText(file);
    }
  }, [mode, file]);

  // Google Sheet polling
  useEffect(() => {
    if (mode !== 'google') return;
    fetchSheet();
    const id = setInterval(fetchSheet, 30000);
    return () => clearInterval(id);
  }, [mode, sheetUrl]);

  function fetchSheet() {
    if (!sheetUrl) return;
    setError('');
    let csvUrl;
    if (sheetUrl.includes('output=csv')) csvUrl = sheetUrl; else {
      const m = sheetUrl.match(/\/d\/([^/]+)/);
      if (!m) { setError('URL de Google Sheet no válida'); return; }
      const sheetId = m[1];
      const gidMatch = sheetUrl.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
    fetch(csvUrl)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
      .then(txt => { const parsed = parseCSV(txt); setClients(parsed.reverse()); })
      .catch(err => setError(`No se pudo cargar Google Sheet: ${err.message}`));
  }

  // ======== Helpers ========
  const ageFromDob = (dob) => {
    if (!dob) return '';
    const d = new Date(dob); if (Number.isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const age = new Date(diff).getUTCFullYear() - 1970;
    return age >= 0 ? `${age}` : '';
  };

  const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlight = (text, query) => {
    if (!query) return text;
    const parts = String(text || '').split(new RegExp(`(${escapeReg(query)})`, 'ig'));
    return parts.map((p, i) => p.toLowerCase() === query.toLowerCase() ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>);
  };

  const buildRegistrationLink = () => {
    const base = process.env.NEXT_PUBLIC_REG_URL || `${origin}/registro`;
    const params = new URLSearchParams();
    if (center) params.set('center', center);
    params.set('source', 'crm');
    return `${base}?${params.toString()}`;
  };

  const openQR = async () => {
    const link = buildRegistrationLink();
    setQrLink(link);
    const img = `https://quickchart.io/qr?text=${encodeURIComponent(link)}&margin=2&size=600`;
    setQrImgUrl(img);
    try {
      const res = await fetch(img);
      const blob = await res.blob();
      const objURL = URL.createObjectURL(blob);
      setQrBlobUrl(objURL);
    } catch (e) {
      setQrBlobUrl('');
    }
    setShowQR(true);
  };

  // ======== Filtrado + Orden ========
  const filtered = useMemo(() => {
    let base = [...clients].sort((a, b) => new Date(b.registered) - new Date(a.registered));

    if (certFilter) base = base.filter(c => (c.certification || '').toLowerCase().includes(certFilter.toLowerCase()));

    if (!searchTerm) return base;
    const t = searchTerm.toLowerCase().trim();
    return base.filter(c => (
      (c.name || '').toLowerCase().includes(t) ||
      (c.email || '').toLowerCase().includes(t) ||
      (String(c.phone || '')).toLowerCase().includes(t) ||
      (c.address || '').toLowerCase().includes(t) ||
      (c.dni || '').toLowerCase().includes(t)
    ));
  }, [clients, searchTerm, certFilter]);

  // Auto mostrar modal si solo hay 1 resultado y hay búsqueda
  useEffect(() => {
    if (filtered.length === 1 && searchTerm) { setSelectedClient(filtered[0]); setSelectedEdit(false); setSelectedForm(null); }
  }, [filtered, searchTerm]);

  // ======== CRUD ========
  const startEdit = (c) => { setEditing(c); setForm({ ...initialForm, ...c }); setShowForm(true); };

  const handleAdd = (e) => {
    e.preventDefault();
    const msg = validateClient(form); if (msg) { setValidationErr(msg); return; }
    const nuevo = { ...form, id: Date.now(), registered: new Date().toISOString() };
    setClients(c => [nuevo, ...c]); setForm(initialForm); setShowForm(false); setSearchTerm(''); setValidationErr('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    const msg = validateClient(form); if (msg) { setValidationErr(msg); return; }
    setClients(c => c.map(cu => cu.id === editing.id ? { ...editing, ...form } : cu));
    setEditing(null); setForm(initialForm); setShowForm(false); setSearchTerm(''); setValidationErr('');
  };

  const handleDeleteAll = () => { if (confirm('¿Borrar TODOS los clientes?')) setClients([]); };
  const handleDelete = (id) => { if (confirm('¿Borrar este cliente?')) setClients(c => c.filter(cu => cu.id !== id)); };

  // ======== Exportar & Emails ========
  const exportToCSV = () => {
    const headers = ['Nombre y Apellidos','Fecha Nacimiento','Email','Telefono','Direccion','DNI','Titulacion','Puntos',`Gastado ${currentYear}`];
    const rows = filtered.map(c => {
      const gasto = (c.purchases || []).filter(pu => new Date(pu.date).getFullYear() === currentYear).reduce((s, pu) => s + (pu.amount || 0), 0);
      return [c.name||'', c.dob||'', c.email||'', c.phone||'', c.address||'', c.dni||'', c.certification||'', c.points||0, gasto.toFixed(2)].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const generateEmailList = () => { const list = filtered.map(c => c.email).filter(Boolean).join('; '); setEmailList(list); };

  // ======== Validación simple ========
  const validateClient = (c) => {
    if (!c.name?.trim()) return 'El nombre es obligatorio';
    if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return 'Email no válido';
    if (c.phone && !/^\+?[0-9()\-\s]{6,}$/.test(c.phone)) return 'Teléfono no válido';
    return '';
  };

  if (center === null) return <p>Cargando CRM...</p>;

  // ======== Métricas rápidas ========
  const totalClients = clients.length;
  const withEmail = clients.filter(c => !!c.email).length;
  const withPhone = clients.filter(c => !!c.phone).length;

  const uniqueCerts = [...new Set(clients.map(c => c.certification).filter(Boolean))];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>CRM <span style={styles.logoD}>Buceo</span> España</h1>
      </header>

      <main style={styles.main}>
        <div style={styles.topBar}>
          <Link href="/" style={styles.link}>← Panel principal</Link>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button style={styles.secondaryBtn} onClick={openQR}>QR Registro</button>
            <button style={styles.tabBtn} onClick={generateEmailList}>Obtener Correos</button>
            <button style={styles.tabBtn} onClick={exportToCSV}>Exportar Excel</button>
            <button style={styles.dangerBtn} onClick={handleDeleteAll}>Borrar todos</button>
          </div>
        </div>

        {/* Métricas */}
        <div style={styles.metricsGrid}>
          <div style={{...styles.metricCard, background:'#0d47a1'}}>
            <small style={styles.metricLabel}>Total clientes</small>
            <div style={styles.metricValue}>{totalClients}</div>
          </div>
          <div style={{...styles.metricCard, background:'#1565c0'}}>
            <small style={styles.metricLabel}>Con email</small>
            <div style={styles.metricValue}>{withEmail}</div>
          </div>
          <div style={{...styles.metricCard, background:'#1976d2'}}>
            <small style={styles.metricLabel}>Con teléfono</small>
            <div style={styles.metricValue}>{withPhone}</div>
          </div>
        </div>

        {/* Controles */}
        <div style={styles.controls}>
          <input
            list="lst"
            placeholder={certFilter ? `Buscar dentro de "${certFilter}"...` : 'Buscar por nombre, email, teléfono, dirección o DNI...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={styles.input}
          />
          <datalist id="lst">
            {filtered.map((c, i) => <option key={i} value={c.name} />)}
          </datalist>

          <select
            value={certFilter}
            onChange={e => setCertFilter(e.target.value)}
            style={styles.inputSmall}
          >
            <option value="">— Filtrar por titulación —</option>
            {uniqueCerts.map((v, i) => <option key={i} value={v}>{v}</option>)}
          </select>

          {certFilter && (
            <button onClick={() => setCertFilter('')} style={styles.tabBtn}>Quitar filtro</button>
          )}

          {['manual', 'import', 'google'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setShowForm(false); }}
              style={mode === m ? styles.activeBtn : styles.tabBtn}
            >
              {m === 'manual' ? '+ Manual' : m === 'import' ? 'Importar CSV' : 'Google Sheet'}
            </button>
          ))}
        </div>

        {mode === 'import' && (
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} style={styles.fileInput} />
        )}
        {mode === 'google' && (
          <div style={{ marginBottom: 16, width: '100%' }}>
            <input type="text" placeholder="URL Google Sheet" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} style={styles.input} />
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {mode === 'manual' && (
          <button style={styles.primaryBtn} onClick={() => { setForm(initialForm); setEditing(null); setShowForm(true); }}>+ Añadir Cliente</button>
        )}

        {/* GRID de tarjetas de clientes */}
        <div style={styles.cardsGrid}>
          {filtered.length === 0 && (
            <div style={styles.empty}>No hay resultados. Prueba quitar el filtro o cambia la búsqueda.</div>
          )}
          {filtered.map(c => {
            const gasto = (c.purchases || []).filter(pu => new Date(pu.date).getFullYear() === currentYear).reduce((s, pu) => s + (pu.amount || 0), 0);
            const age = ageFromDob(c.dob);
            const phoneDigits = (c.phone || '').replace(/\D/g, '');
            return (
              <div key={c.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={styles.avatar}>{(c.name || '?').slice(0,1).toUpperCase()}</div>
                    <div>
                      <div style={styles.cardName}>{highlight(c.name || 'Sin nombre', searchTerm)}</div>
                      {c.certification && (
                        <div style={styles.badge}>{highlight(c.certification, searchTerm)}</div>
                      )}
                    </div>
                  </div>
                  {c.phone && (
                    <a
                      href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hola ${c.name || ''}, te escribimos desde Buceo España`)}`}
                      target="_blank" rel="noopener noreferrer" style={styles.whatsappIcon} title="Enviar WhatsApp"
                    >📲</a>
                  )}
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.row}><span style={styles.label}>Email</span><span>{highlight(c.email || '—', searchTerm)}</span></div>
                  <div style={styles.row}><span style={styles.label}>Teléfono</span><span>{highlight(c.phone || '—', searchTerm)}</span></div>
                  <div style={styles.row}><span style={styles.label}>DNI</span><span>{highlight(c.dni || '—', searchTerm)}</span></div>
                  <div style={styles.row}><span style={styles.label}>Dirección</span><span>{highlight(c.address || '—', searchTerm)}</span></div>
                  <div style={styles.row}><span style={styles.label}>Fecha nac.</span><span>{c.dob || '—'} {age && `( ${age} años )`}</span></div>
                </div>

                <div style={styles.cardFooter}>
                  <div style={styles.kpi}><small>Puntos</small><strong>{c.points || 0}</strong></div>
                  <div style={styles.kpi}><small>Gastado {currentYear}</small><strong>{gasto.toFixed(2)}€</strong></div>
                </div>

                <div style={styles.cardActions}>
                  <button style={styles.smallBtn} onClick={() => { setSelectedClient(c); setSelectedEdit(false); setSelectedForm(null); }}>Ver</button>
                  <button style={styles.smallBtn} onClick={() => startEdit(c)}>Editar</button>
                  <button style={styles.smallDangerBtn} onClick={() => handleDelete(c.id)}>Borrar</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal AÑADIR / EDITAR (formulario limpio) */}
      {showForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <h2 style={{margin:0}}>{editing ? 'Editar cliente' : 'Añadir nuevo cliente'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); setForm(initialForm); setValidationErr(''); }} style={styles.modalCloseBtn}>Cerrar</button>
            </div>
            <p style={{marginTop:0, color:'#556'}}>Rellena los datos principales del buceador. Podrás completarlos más tarde desde su ficha.</p>
            <form onSubmit={editing ? handleSave : handleAdd}>
              <div style={styles.formRow}>
                <div style={styles.formCol}>
                  <label style={styles.label}>Nombre y apellidos</label>
                  <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Ana Pérez Gómez" style={styles.input} />

                  <label style={styles.label}>Fecha de nacimiento</label>
                  <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} style={styles.input} />

                  <label style={styles.label}>Correo electrónico</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" style={styles.input} />
                </div>

                <div style={styles.formCol}>
                  <label style={styles.label}>Teléfono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+34 612 345 678" style={styles.input} />

                  <label style={styles.label}>Dirección completa</label>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Calle, número, ciudad, país" style={styles.input} />

                  <label style={styles.label}>DNI / NIE</label>
                  <input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value.toUpperCase() })} placeholder="00000000X" style={styles.input} />
                </div>

                <div style={styles.formCol}>
                  <label style={styles.label}>Titulación de buceo</label>
                  <input value={form.certification} onChange={e => setForm({ ...form, certification: e.target.value })} placeholder="Open Water / Advanced /..." style={styles.input} />

                  <div style={{ marginTop: 16, padding: 12, background:'#f7faff', border:'1px solid #e2ecff', borderRadius:8 }}>
                    <div style={{fontWeight:600, marginBottom:8}}>Resumen</div>
                    <div style={{display:'flex', gap:16}}>
                      <div style={styles.kpi}><small>Puntos</small><strong>{form.points || 0}</strong></div>
                      <div style={styles.kpi}><small>Gastado {currentYear}</small><strong>{((form.purchases || []).filter(p => new Date(p.date).getFullYear() === currentYear).reduce((s,p) => s + (p.amount || 0), 0)).toFixed(2)}€</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {validationErr && <p style={{color:'#d9534f', marginTop:8}}>{validationErr}</p>}

              <div style={{marginTop:12, textAlign:'right'}}>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(initialForm); setValidationErr(''); }} style={{...styles.smallDangerBtn, marginRight:8}}>Cancelar</button>
                <button type="submit" style={styles.primaryBtn}>{editing ? 'Guardar cambios' : 'Añadir Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal con lista de correos */}
      {emailList && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2>Lista de Correos</h2>
            <textarea readOnly value={emailList} style={styles.emailListBox} />
            <button onClick={() => setEmailList('')} style={styles.modalCloseBtn}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Modal ver/editar cliente seleccionado */}
      {selectedClient && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <h2 style={{margin:0}}>{selectedEdit ? 'Editar cliente' : selectedClient.name}</h2>
              <div style={{display:'flex', gap:8}}>
                {!selectedEdit && (
                  <button style={styles.smallBtn} onClick={() => { setSelectedEdit(true); setSelectedForm({ ...initialForm, ...selectedClient }); setValidationErr(''); }}>Editar aquí</button>
                )}
                <button onClick={() => { setSelectedClient(null); setSelectedEdit(false); setSelectedForm(null); setSearchTerm(''); }} style={styles.modalCloseBtn}>Cerrar</button>
              </div>
            </div>

            {!selectedEdit ? (
              <div>
                <p><strong>Email:</strong> {selectedClient.email || '—'}</p>
                <p><strong>Teléfono:</strong> {selectedClient.phone || '—'}</p>
                <p><strong>DNI:</strong> {selectedClient.dni || '—'}</p>
                <p><strong>Dirección:</strong> {selectedClient.address || '—'}</p>
                <p><strong>Fecha Nac.:</strong> {selectedClient.dob || '—'}</p>
                <p><strong>Titulación:</strong> {selectedClient.certification || '—'}</p>
                <p><strong>Puntos:</strong> {selectedClient.points || 0}</p>
                <p><strong>Gastado {currentYear}:</strong> {((selectedClient.purchases || []).filter(pu => new Date(pu.date).getFullYear() === currentYear).reduce((s, pu) => s + (pu.amount || 0), 0)).toFixed(2)}€</p>
              </div>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                const msg = validateClient(selectedForm); if (msg) { setValidationErr(msg); return; }
                setClients(c => c.map(cu => cu.id === selectedClient.id ? { ...cu, ...selectedForm } : cu));
                setSelectedClient(prev => ({ ...prev, ...selectedForm }));
                setSelectedEdit(false); setSelectedForm(null); setValidationErr('');
              }}>
                <div style={styles.formRow}>
                  <div style={styles.formCol}>
                    <label style={styles.label}>Nombre y apellidos</label>
                    <input value={selectedForm?.name || ''} onChange={e => setSelectedForm({ ...selectedForm, name: e.target.value })} style={styles.input} />

                    <label style={styles.label}>Fecha de nacimiento</label>
                    <input type="date" value={selectedForm?.dob || ''} onChange={e => setSelectedForm({ ...selectedForm, dob: e.target.value })} style={styles.input} />

                    <label style={styles.label}>Correo electrónico</label>
                    <input type="email" value={selectedForm?.email || ''} onChange={e => setSelectedForm({ ...selectedForm, email: e.target.value })} style={styles.input} />
                  </div>

                  <div style={styles.formCol}>
                    <label style={styles.label}>Teléfono</label>
                    <input type="tel" value={selectedForm?.phone || ''} onChange={e => setSelectedForm({ ...selectedForm, phone: e.target.value })} style={styles.input} />

                    <label style={styles.label}>Dirección completa</label>
                    <input value={selectedForm?.address || ''} onChange={e => setSelectedForm({ ...selectedForm, address: e.target.value })} style={styles.input} />

                    <label style={styles.label}>DNI / NIE</label>
                    <input value={selectedForm?.dni || ''} onChange={e => setSelectedForm({ ...selectedForm, dni: e.target.value.toUpperCase() })} style={styles.input} />
                  </div>

                  <div style={styles.formCol}>
                    <label style={styles.label}>Titulación de buceo</label>
                    <input value={selectedForm?.certification || ''} onChange={e => setSelectedForm({ ...selectedForm, certification: e.target.value })} style={styles.input} />

                    <div style={{ marginTop: 16, padding: 12, background:'#f7faff', border:'1px solid #e2ecff', borderRadius:8 }}>
                      <div style={{fontWeight:600, marginBottom:8}}>Resumen</div>
                      <div style={{display:'flex', gap:16}}>
                        <div style={styles.kpi}><small>Puntos</small><strong>{selectedClient.points || 0}</strong></div>
                        <div style={styles.kpi}><small>Gastado {currentYear}</small><strong>{((selectedClient.purchases || []).filter(p => new Date(p.date).getFullYear() === currentYear).reduce((s,p) => s + (p.amount || 0), 0)).toFixed(2)}€</strong></div>
                      </div>
                    </div>
                  </div>
                </div>

                {validationErr && <p style={{color:'#d9534f', marginTop:8}}>{validationErr}</p>}

                <div style={{marginTop:12, textAlign:'right'}}>
                  <button type="button" onClick={() => { setSelectedEdit(false); setSelectedForm(null); setValidationErr(''); }} style={{...styles.smallDangerBtn, marginRight:8}}>Cancelar</button>
                  <button type="submit" style={styles.primaryBtn}>Guardar cambios</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal QR REGISTRO */}
      {showQR && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{marginTop:0}}>Registro online</h2>
            <p style={{marginTop:0, color:'#556'}}>Escanea para completar el formulario de registro. También puedes descargar el QR para imprimirlo y ponerlo en recepción.</p>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:12}}>
              {qrImgUrl ? (
                <img src={qrImgUrl} alt="QR de registro" style={{width:260, height:260}} />
              ) : (
                <div style={{width:260, height:260, display:'grid', placeItems:'center', background:'#f3f6ff', border:'1px dashed #cbd5e1'}}>Generando QR…</div>
              )}
              <small style={{wordBreak:'break-all', color:'#334155'}}>{qrLink}</small>
            </div>
            <div style={{marginTop:16, display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={() => { navigator.clipboard?.writeText(qrLink); }} style={styles.secondaryBtn}>Copiar enlace</button>
              {qrBlobUrl ? (
                <a href={qrBlobUrl} download={`qr-registro-${center || 'centro'}.png`} style={{...styles.primaryBtn, textDecoration:'none', display:'inline-block'}}>Descargar PNG</a>
              ) : null}
              <button onClick={() => setShowQR(false)} style={styles.modalCloseBtn}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== ESTILOS =====================
const styles = {
  page: { backgroundColor: '#eef3fb', minHeight: '100vh' },
  header: { background:'#fff', padding:'12px 24px', boxShadow:'0 2px 4px rgba(0,0,0,0.08)', marginBottom:16 },
  logo: { margin:0, fontFamily:'system-ui, -apple-system, Segoe UI, Roboto', fontSize:22, color:'#222' },
  logoD: { color: '#e53935', fontWeight:700 },
  main: { width:'100%', maxWidth:1200, margin:'0 auto', background:'#fff', borderRadius:14, boxShadow:'0 10px 24px rgba(0,0,0,0.06)', padding:24, minHeight:'80vh' },
  topBar: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 },
  link: { textDecoration:'none', color:'#0070f3', fontWeight:500 },
  dangerBtn: { background:'#d9534f', color:'#fff', border:'none', padding:'8px 12px', borderRadius:10, cursor:'pointer' },
  secondaryBtn: { background:'#f1f5ff', color:'#0b6bcb', border:'1px solid #cfe1ff', padding:'8px 12px', borderRadius:10, cursor:'pointer' },

  metricsGrid: { display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, marginBottom:20 },
  metricCard: { color:'#fff', padding:16, borderRadius:12, textAlign:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' },
  metricLabel: { opacity:0.9, fontSize:13 },
  metricValue: { fontSize:24, marginTop:4, fontWeight:700 },

  controls: { display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' },
  input: { padding:10, borderRadius:10, border:'1px solid #d5dbe7', flex:'1 1 260px', fontSize:14, outline:'none' },
  inputSmall: { padding:10, borderRadius:10, border:'1px solid #d5dbe7', flex:'0 1 220px', fontSize:14 },
  tabBtn: { background:'#e7f2ff', border:'1px solid #cfe1ff', padding:'8px 14px', borderRadius:10, cursor:'pointer' },
  activeBtn: { background:'#0b6bcb', color:'#fff', border:'none', padding:'8px 14px', borderRadius:10, cursor:'pointer' },
  fileInput: { marginBottom:16 },
  error: { color: 'red', marginTop: 4 },
  primaryBtn: { background:'#0b6bcb', color:'#fff', border:'none', padding:'10px 16px', borderRadius:12, cursor:'pointer' },

  // GRID de tarjetas
  cardsGrid: { display:'grid', gridTemplateColumns:'repeat( auto-fill, minmax(280px, 1fr) )', gap:16 },
  empty: { padding:24, textAlign:'center', color:'#666', gridColumn:'1/-1' },
  card: { background:'#ffffff', border:'1px solid #ebeff7', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 2px 10px rgba(0,0,0,0.04)' },
  cardHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, borderBottom:'1px solid #f0f3fa' },
  avatar: { width:40, height:40, borderRadius:999, background:'#e3f2fd', color:'#0d47a1', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 },
  cardName: { fontWeight:700 },
  badge: { display:'inline-block', marginTop:4, fontSize:12, background:'#f0f7ff', color:'#0b6bcb', padding:'2px 8px', borderRadius:999 },
  whatsappIcon: { fontSize:22, textDecoration:'none' },
  cardBody: { padding:16, display:'grid', gap:6 },
  row: { display:'flex', justifyContent:'space-between', gap:8, fontSize:14 },
  label: { color:'#57607a', fontWeight:500 },
  cardFooter: { display:'flex', gap:16, padding:'12px 16px', borderTop:'1px solid #f0f3fa', background:'#fafcff' },
  kpi: { display:'flex', flexDirection:'column', gap:2 },
  cardActions: { display:'flex', gap:8, padding:12, justifyContent:'flex-end' },

  // Formulario modal y modal base
  formRow: { display:'flex', gap:16, flexWrap:'wrap' },
  formCol: { flex:'1 1 320px', minWidth:260 },
  smallBtn: { background:'#28a745', color:'#fff', border:'none', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 },
  smallDangerBtn: { background:'#dc3545', color:'#fff', border:'none', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 },

  modalOverlay: { position:'fixed', left:0, top:0, width:'100vw', height:'100vh', background:'rgba(0,0,0,0.35)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:3000, padding:12 },
  modalContent: { background:'#fff', borderRadius:14, padding:24, width:'100%', maxWidth:720, boxShadow:'0 16px 48px rgba(0,0,0,0.18)' },
  emailListBox: { width:'100%', height:200, padding:8, fontSize:14, borderRadius:10, border:'1px solid #d5dbe7', marginBottom:16, resize:'none' },
  modalCloseBtn: { background:'#64748b', color:'#fff', border:'none', borderRadius:10, padding:'10px 16px', fontSize:14, cursor:'pointer' },
};
