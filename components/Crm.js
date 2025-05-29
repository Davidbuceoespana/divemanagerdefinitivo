import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useState, useEffect } from "react";

export default function MiComponente() {
  const [center, setCenter] = useState(null);

  useEffect(() => {
    // Esto solo corre en el navegador
    const c = localStorage.getItem("active_center");
    setCenter(c);
  }, []);

  if (!center) return <div>Cargando...</div>;

  // ...tu render/JSX normal usando center...
}

// pages/crm.js  (solo reemplaza la función parseCSV)
function parseCSV(csvText) {
  // 1) Partimos líneas
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // 2) Detectar delimitador: si hay más ';' que ',', usamos ';'
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount  = (headerLine.match(/;/g) || []).length;
  const delimiter  = semiCount > commaCount ? ';' : ',';

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
    if (h.includes('nombre completo'))      return 'name';
    if (h.includes('poblacion'))            return 'city';
    if (h.includes('correo electronico'))   return 'email';
    if (h.includes('telefono de contacto') || h.includes('telefono')) return 'phone';
    if (h.includes('d.n.i') || h.includes('dni')) return 'dni';
    if (h.includes('nivel de experiencia')) return 'experience';
    if (h.includes('como nos has conocido'))return 'referredBy';
    if (h.includes('fecha de nacimiento'))  return 'dob';
    if (h.includes('apodo') || h.includes('nick')) return 'nickname';
    if (h.includes('inmersiones'))          return 'divesCount';
    if (h.includes('hace cuanto que no buceas')) return 'lastDive';
    if (h.includes('intereses especiales')) return 'interests';
    if (h.includes('palabras clave'))       return 'keywords';
    if (h.includes('preocupaciones'))       return 'concerns';
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
      registered: new Date().toISOString()
    };
  });
}

export default function CrmPage() {
  const center = typeof window !== 'undefined'
    ? localStorage.getItem('active_center')
    : null;
  if (!center) return null;

  const STORAGE_KEY = `dive_manager_clients_${center}`;

  const [clients,    setClients]    = useState([]);
  const [mode,       setMode]       = useState('manual'); // manual | import | google
  const [file,       setFile]       = useState(null);
  const [sheetUrl,   setSheetUrl]   = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('sheetUrl') || ''
      : ''
  );
  const [error,      setError]      = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

  // Persistir sheetUrl en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sheetUrl', sheetUrl);
    }
  }, [sheetUrl]);

  const initialForm = {
    name:'', city:'', email:'', phone:'', dni:'',
    experience:'', referredBy:'', dob:'', nickname:'',
    divesCount:'', lastDive:'', interests:[],
    keywords:[], concerns:'', needs:'', commPref:'', comments:'',
    address:'', postal:''
  };
  const [form, setForm] = useState(initialForm);

  // Función para cargar Google Sheets + polling cada 30s
  const fetchSheet = () => {
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
  };

  // Carga inicial de clientes desde localStorage
  useEffect(() => {
    const st = localStorage.getItem(STORAGE_KEY);
    if (st) setClients(JSON.parse(st));
  }, [center]);

  // Guardar cambios en clientes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients, center]);

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

  // Google mode: carga inicial + polling
 useEffect(() => {
  if (mode === 'google') {
    fetchSheet();
    const id = setInterval(fetchSheet, 30000);
    return () => clearInterval(id);
  }
}, [mode, sheetUrl]);

 // ── Filtrado + Ordenado según el modo ──
const filtered = useMemo(() => {
  const base = mode === 'google'
    ? [...clients].reverse()
    : [...clients].sort((a, b) =>
        new Date(b.registered) - new Date(a.registered)
      );
  if (!searchTerm) return base;
  const t = searchTerm.toLowerCase();
  return base.filter(c =>
    c.name.toLowerCase().includes(t) ||
    c.email.toLowerCase().includes(t) ||
    c.phone.toLowerCase().includes(t) ||
    c.city.toLowerCase().includes(t)
  );
}, [clients, mode, searchTerm]);


  // Auto-abre detalle si hay un solo resultado
  useEffect(() => {
    if (filtered.length === 1) {
      setEditing(filtered[0]);
      setForm(filtered[0]);
      setShowForm(true);
    }
  }, [filtered]);

  // CRUD Actions
  const startEdit = c => {
    setEditing(c);
    setForm(c);
    setShowForm(true);
  };
  const handleAdd = e => {
    e.preventDefault();
    setClients(c => [{ id: Date.now(), ...form, registered: new Date().toISOString() }, ...c]);
    setForm(initialForm);
    setShowForm(false);
  };
  const handleSave = e => {
    e.preventDefault();
    setClients(c => c.map(cu => cu.id===editing.id ? { ...editing, ...form } : cu));
    setEditing(null);
    setForm(initialForm);
    setShowForm(false);
  };
  const handleDeleteAll = () => {
    if (confirm('Borrar TODOS los clientes?')) setClients([]);
  };
  const handleDelete = id => {
    if (confirm('Borrar este cliente?')) setClients(c => c.filter(cu=>cu.id!==id));
  };
// — NUEVO — Compras filtradas por año y total
const purchasesYear = (form.purchases||[]).filter(p => new Date(p.date).getFullYear() === yearFilter);
const totalYear     = purchasesYear.reduce((sum, p) => sum + p.amount, 0);
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

        <div style={styles.controls}>
          <input
            list="lst"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={e=>setSearchTerm(e.target.value)}
            style={styles.input}
          />
          <datalist id="lst">
            {filtered.map((c,i)=><option key={i} value={c.name}/>)}
          </datalist>

          {['manual','import','google'].map(m=>(
            <button
              key={m}
              onClick={()=>{setMode(m); setError(''); setShowForm(false)}}
              style={mode===m ? styles.activeBtn : styles.tabBtn}
            >
              {m==='manual'?'+ Manual': m==='import'?'Importar CSV':'Google Sheet'}
            </button>
          ))}
        </div>

        {mode==='import' && (
          <input
            type="file"
            accept=".csv"
            onChange={e=>setFile(e.target.files[0])}
            style={styles.fileInput}
          />
        )}
        {mode==='google' && (
          <div style={{ marginBottom:16 }}>
            <input
              type="text"
              placeholder="URL Google Sheet"
              value={sheetUrl}
              onChange={e=>setSheetUrl(e.target.value)}
              style={styles.input}
            />
            {error && <p style={styles.error}>{error}</p>}
          </div>
        )}

        {mode==='manual' && !showForm && (
          <button style={styles.primaryBtn} onClick={()=>{
            setForm(initialForm);
            setEditing(null);
            setShowForm(true);
          }}>
            + Añadir Cliente
          </button>
        )}

        {/* Tabla de clientes */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Nombre','Ciudad','Email','Teléfono','D.N.I.','Experiencia','Acciones']
                  .map(h=> <th key={h} style={styles.th}>{h}</th>)}
              </tr>  
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.city}</td>
                  <td style={styles.td}>{c.email}</td>
                  <td style={styles.td}>{c.phone}</td>
                  <td style={styles.td}>{c.dni}</td>
                  <td style={styles.td}>{c.experience}</td>
                  <td style={styles.td}>
                    <button style={styles.smallBtn} onClick={()=>startEdit(c)}>Editar</button>{' '}
                    <button style={styles.smallDangerBtn} onClick={()=>handleDelete(c.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formulario manual / edición */}
        {showForm && (
          <form onSubmit={editing ? handleSave : handleAdd} style={styles.form}>
            {/* Botón interno “Editar” */}
            {editing && (
              <button type="button" style={styles.smallBtn} onClick={()=>startEdit(editing)}>
                Editar
              </button>
            )}
            <div style={styles.formRow}>
              <div style={styles.formCol}>
                <label style={styles.label}>Nombre completo 📝</label>
                <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Población 🌎</label>
                <input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Correo electrónico 📧</label>
                <input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Teléfono de contacto 📱</label>
                <input type="tel" required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} style={styles.input}/>
                <label style={styles.label}>D.N.I. 📄</label>
                <input value={form.dni} onChange={e=>setForm({...form,dni:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Dirección completa</label>
                <input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Código postal</label>
                <input value={form.postal} onChange={e=>setForm({...form,postal:e.target.value})} style={styles.input}/>
              </div>
              
              <div style={styles.formCol}>
                <label style={styles.label}>Nivel de experiencia</label>
                <input value={form.experience} onChange={e=>setForm({...form,experience:e.target.value})} style={styles.input}/>
                <label style={styles.label}>¿Cómo nos has conocido? 🤗</label>
                <input value={form.referredBy} onChange={e=>setForm({...form,referredBy:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Fecha de nacimiento 🔍</label>
                <input type="date" value={form.dob} onChange={e=>setForm({...form,dob:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Apodo/Nick 🔥</label>
                <input value={form.nickname} onChange={e=>setForm({...form,nickname:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Nº de inmersiones realizadas</label>
                <input type="number" value={form.divesCount} onChange={e=>setForm({...form,divesCount:e.target.value})} style={styles.input}/>
                <label style={styles.label}>¿Hace cuánto que no buceas? 🔔</label>
                <input placeholder="p.ej. 3 meses" value={form.lastDive} onChange={e=>setForm({...form,lastDive:e.target.value})} style={styles.input}/>
              </div>
              <div style={styles.formCol}>
                <label style={styles.label}>Intereses especiales</label>
                <select multiple value={form.interests} onChange={e=>setForm({...form,interests:[...e.target.selectedOptions].map(o=>o.value)})} style={styles.selectMulti}>
                  <option>Fotografía submarina</option>
                  <option>Cueva</option>
                  <option>Mantarrayas</option>
                  <option>Arrecifes</option>
                </select>
                <label style={styles.label}>Palabras clave</label>
                <select multiple value={form.keywords} onChange={e=>setForm({...form,keywords:[...e.target.selectedOptions].map(o=>o.value)})} style={styles.selectMulti}>
                  <option>Aventura</option>
                  <option>Relajación</option>
                  <option>Aprendizaje</option>
                </select>
                <label style={styles.label}>Preocupaciones 👋</label>
                <textarea value={form.concerns} onChange={e=>setForm({...form,concerns:e.target.value})} style={styles.textarea}/>
                <label style={styles.label}>Necesidades especiales 🍹</label>
                <textarea value={form.needs} onChange={e=>setForm({...form,needs:e.target.value})} style={styles.textarea}/>
                <label style={styles.label}>Preferencia de comunicación</label>
                <input value={form.commPref} onChange={e=>setForm({...form,commPref:e.target.value})} style={styles.input}/>
                <label style={styles.label}>Comentarios adicionales 💡</label>
                <textarea value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})} style={styles.textarea}/>
              </div>
            </div>
           {/* — NUEVO — sección de Compras filtradas por año */}
           <div style={{ marginTop: 24 }}>
              <h3>
                Compras de {yearFilter}{' '}
                <button type="button" onClick={() => setYearFilter(y => y - 1)}>&lt;</button>{' '}
                <button type="button" onClick={() => setYearFilter(y => Math.min(y + 1, new Date().getFullYear()))}>&gt;</button>
              </h3>
              <ul>
                {purchasesYear.map((p,i)=>(
                  <li key={i}>
                    {p.date.slice(0,10)} – {p.product}: {p.amount.toFixed(2)}€
                  </li>
                ))}
              </ul>
              <p><strong>Total en {yearFilter}:</strong> {totalYear.toFixed(2)}€</p>
            </div>

            <div style={styles.formActions}>
              <button type="submit" style={styles.primaryBtn}>
                {editing ? 'Guardar' : 'Añadir Cliente'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                  setForm(initialForm)
                }}
                style={styles.smallDangerBtn}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
const styles = {
  page: { backgroundColor:'#afcda', minHeight:'100vh' },
  header: {
    background:'#fff', padding:'12px 24px',
    boxShadow:'0 2px 4px rgba(0,0,0,0.1)'
  },
  logo: {
    margin:0, fontFamily:'Georgia, serif',
    fontSize:24, color:'#222'
  },
  logoD: { color:'red' },
  main: {
    maxWidth:960, margin:'24px auto',
    background:'#fff', borderRadius:8,
    boxShadow:'0 4px 8px rgba(0,0,0,0.1)',
    padding:24
  },
  topBar: {
    display:'flex', justifyContent:'space-between',
    alignItems:'center', marginBottom:16
  },
  link: { textDecoration:'none', color:'#0070f3', fontWeight:500 },
  controls: {
    display:'flex', gap:8, alignItems:'center', marginBottom:16,
    flexWrap:'wrap'
  },
  input: {
    padding:8, borderRadius:4,
    border:'1px solid #ccc', flex:'1 1 200px',
    fontSize:14
  },
  tabBtn: {
    background:'#e0f0ff', border:'none',
    padding:'6px 12px', borderRadius:4,
    cursor:'pointer'
  },
  activeBtn: {
    background:'#0070f3', color:'#fff', border:'none',
    padding:'6px 12px', borderRadius:4,
    cursor:'pointer'
  },
  primaryBtn: {
    background:'#0070f3', color:'#fff', border:'none',
    padding:'8px 16px', borderRadius:4, cursor:'pointer'
  },
  dangerBtn: {
    background:'#d9534f', color:'#fff', border:'none',
    padding:'6px 12px', borderRadius:4, cursor:'pointer'
  },
  smallBtn: {
    background:'#28a745', color:'#fff', border:'none',
    padding:'4px 8px', borderRadius:4, cursor:'pointer',
    fontSize:12
  },
  smallDangerBtn: {
    background:'#dc3545', color:'#fff', border:'none',
    padding:'4px 8px', borderRadius:4, cursor:'pointer',
    fontSize:12
  },  
  fileInput: { marginBottom:16 },
  error: { color:'red', marginTop:4 },
  tableWrapper: {
    maxHeight:300, overflowY:'auto',
    border:'1px solid #ddd', borderRadius:4, marginBottom:16
  },
  table: { width:'100%', borderCollapse:'collapse' },
  th: {
    position:'sticky', top:0, background:'#f5f5f5',
    borderBottom:'2px solid #ddd', padding:8, textAlign:'left'
  },
  tr: { background:'#fff' },
  td: { borderBottom:'1px solid #eee', padding:8 },
  form: {
    border:'1px solid #ddd', borderRadius:4,
    padding:16, marginTop:16, overflowX:'auto'
  },
  formRow: { display:'flex', gap:16 },
  formCol: { flex:'1 1 300px' },
  label: { display:'block', marginBottom:4, fontWeight:500 },
  textarea: {
    width:'100%', padding:8, borderRadius:4,
    border:'1px solid #ccc', fontSize:14, resize:'vertical'
  },
  selectMulti: {
    width:'100%', height:80, padding:8,
    border:'1px solid #ccc', borderRadius:4,
    fontSize:14
  },
  formActions: {
    marginTop:16, textAlign:'right'
  }
}