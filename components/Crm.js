import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseclientes'; // Cambia la ruta si está en otro sitio

// ========== Helper para CSV ===================
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const [header, ...rows] = lines;
  const keys = header.split(',').map(h => h.trim().toLowerCase());
  return rows.map(line => {
    const cols = line.split(',').map(c => c.trim());
    const obj = {};
    keys.forEach((k,i) => obj[k] = cols[i] || '');
    return {
      name:          obj.name || obj.nombre || '',
      location:      obj.location || obj.población || '',
      email:         obj.email || obj['correo electrónico'] || '',
      phone:         obj.phone || obj['teléfono de contacto'] || '',
      dni:           obj.dni || obj['d.n.i'] || '',
      experience:    obj.experience || obj['nivel de experiencia en buceo'] || '',
      howHeard:      obj.howheard || obj['cómo nos has conocido?'] || '',
      dob:           obj.dob || obj['fecha de nacimiento'] || '',
      nickname:      obj.nickname || obj['tu apodo o nick'] || '',
      diveCount:     obj.divecount || obj['número de inmersiones realizadas'] || '',
      lastDive:      obj.lastdive || obj['hace cuanto que no buceas?'] || '',
      interests:     obj.interests ? obj.interests.split('|') : [],
      keywords:      obj.keywords ? obj.keywords.split('|') : [],
      concerns:      obj.concerns || obj['preocupaciones'] || '',
      specialNeeds:  obj.specialneeds || obj['necesidad especial'] || '',
      contactPref:   obj.contactpref || obj['preferencia de comunicación'] || '',
      notes:         obj.notes || obj['algo más'] || '',
      registered:    obj.registered || obj['registrado'] || new Date().toISOString(),
      cursos:        obj.cursos ? JSON.parse(obj.cursos) : []
    };
  });
}

// ========== CRM PRINCIPAL ===============
export default function Crm() {
  const center = typeof window !== 'undefined' && localStorage.getItem('active_center');
  if (!center) return null;

  const [clients, setClients]       = useState([]);
  const [mode, setMode]             = useState('manual'); // manual|import|google
  const [file, setFile]             = useState(null);
  const [sheetUrl, setSheetUrl]     = useState('');
  const [error, setError]           = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({
    name:'', location:'', email:'', phone:'', dni:'',
    experience:'', howHeard:'', dob:'', nickname:'',
    diveCount:'', lastDive:'', interests:[],
    keywords:[], concerns:'', specialNeeds:'',
    contactPref:'', notes:'', cursos:[]
  });
  const [editing, setEditing]       = useState(null);
  const [detail, setDetail]         = useState(null);

  // 1. Cargar clientes al montar
  useEffect(() => {
    if (!center) return;
    setError('');
    (async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('center', center)
        .order('registered', { ascending: false });
      if (error) setError('Error cargando clientes');
      else setClients(data || []);
    })();
  }, [center]);

  // 2. Importar CSV y subir a Supabase
  useEffect(() => {
    if (mode === 'import' && file) {
      const r = new FileReader();
      r.onload = async e => {
        const parsed = parseCSV(e.target.result);
        const dataToInsert = parsed.map(c => ({ ...c, center }));
        // Limpiamos clientes previos:
        await supabase.from('clientes').delete().eq('center', center);
        // Insertamos todos:
        const { error } = await supabase.from('clientes').insert(dataToInsert);
        if (error) setError('Error importando CSV');
        // Recargamos lista:
        const { data } = await supabase.from('clientes').select('*').eq('center', center).order('registered', { ascending: false });
        setClients(data || []);
      };
      r.readAsText(file);
    }
  }, [mode, file, center]);

  // 3. Google Sheet temporal (sólo en memoria)
  useEffect(() => {
    if (mode==='google' && sheetUrl) {
      setError('');
      const m = sheetUrl.match(/\/d\/([^/]+)/);
      if (!m) return setError('URL de Google Sheet no válida');
      const sheetId = m[1];
      const gidMatch = sheetUrl.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      fetch(url)
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(txt => setClients(parseCSV(txt)))
        .catch(() => setError('No se pudo cargar el Sheet'));
    }
  }, [mode, sheetUrl]);

  // 4. Filtro y orden
  const sorted = useMemo(() =>
    [...clients].sort((a,b)=> new Date(b.registered)-new Date(a.registered)),
  [clients]);

  const filtered = useMemo(() => {
    if (!searchTerm) return sorted;
    const t = searchTerm.toLowerCase();
    return sorted.filter(c =>
      c.name?.toLowerCase().includes(t) ||
      c.email?.toLowerCase().includes(t) ||
      c.phone?.toLowerCase().includes(t) ||
      c.location?.toLowerCase().includes(t)
    );
  }, [searchTerm, sorted]);

  // 5. Guardar (crear/editar)
  const handleSave = async (data) => {
    setError('');
    if (editing) {
      // EDITAR:
      const { error } = await supabase
        .from('clientes')
        .update({ ...data })
        .eq('id', editing.id);
      if (error) setError('Error guardando cambios');
    } else {
      // NUEVO:
      const { error } = await supabase
        .from('clientes')
        .insert([{ ...data, center }]);
      if (error) setError('Error guardando cliente');
    }
    // Recargar:
    const { data: newList } = await supabase
      .from('clientes')
      .select('*')
      .eq('center', center)
      .order('registered', { ascending: false });
    setClients(newList || []);
    setShowForm(false);
    setEditing(null);
    setForm({
      name:'', location:'', email:'', phone:'', dni:'',
      experience:'', howHeard:'', dob:'', nickname:'',
      diveCount:'', lastDive:'', interests:[],
      keywords:[], concerns:'', specialNeeds:'',
      contactPref:'', notes:'', cursos:[]
    });
  };

  // 6. Borrar cliente
  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que quieres borrar este cliente?")) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) setError('Error borrando cliente');
    // Recargar:
    const { data: newList } = await supabase
      .from('clientes')
      .select('*')
      .eq('center', center)
      .order('registered', { ascending: false });
    setClients(newList || []);
  };

  // 7. Borrar todos
  const handleDeleteAll = async () => {
    if (!window.confirm("¿Borrar TODOS los clientes?")) return;
    const { error } = await supabase.from('clientes').delete().eq('center', center);
    if (error) setError('Error borrando todos los clientes');
    else setClients([]);
  };

  // ========== RENDER ==========================
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>
          TPV<span style={styles.logoD}>D</span>ive CRM
        </h1>
      </header>
      <main style={styles.main}>
        {error && <div style={{ color: 'red', margin: '12px 0' }}>{error}</div>}
        {/* top bar */}
        <div style={styles.topBar}>
          <button onClick={()=>setSearchTerm('')} style={styles.link}>← Panel</button>
          <button onClick={handleDeleteAll} style={styles.dangerBtn}>Borrar todos</button>
        </div>
        {/* modos */}
        <div style={styles.modeBar}>
          {['manual','import','google'].map(m=>(
            <label key={m} style={styles.radioLabel}>
              <input type="radio" value={m}
                checked={mode===m}
                onChange={()=>{ setMode(m); setError(''); }}
              />{' '}
              { m==='manual' ? 'Manual' : m==='import' ? 'Importar CSV' : 'Google Sheet' }
            </label>
          ))}
        </div>
        {/* importaciones */}
        {mode==='import' &&
          <input type="file" accept=".csv"
            onChange={e=>setFile(e.target.files[0])}
            style={styles.fileInput}
          />
        }
        {mode==='google' &&
          <div style={{ marginBottom:16 }}>
            <input type="text" placeholder="URL Google Sheet"
              value={sheetUrl}
              onChange={e=>setSheetUrl(e.target.value)}
              style={styles.textInput}
            />
            {error && <p style={styles.error}>{error}</p>}
          </div>
        }
        {/* alta manual */}
        {mode==='manual' &&
          (showForm
            ? <ClientForm
                data={form}
                onChange={v=>setForm(v)}
                onCancel={()=>{ setShowForm(false); setEditing(null); }}
                onSave={handleSave}
              />
            : <button style={styles.primaryBtn} onClick={()=>{
                setShowForm(true);
                if (editing) setForm(editing);
              }}>
                + {editing?'Editar':'Añadir'} Cliente
              </button>
          )
        }
        {/* búsqueda */}
        <input
          placeholder="Buscar..."
          value={searchTerm}
          onChange={e=>setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        {/* tabla */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Nombre','Población','Email','Teléfono','Acciones'].map(h=>(
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.location}</td>
                  <td style={styles.td}>{c.email}</td>
                  <td style={styles.td}>{c.phone}</td>
                  <td style={styles.td}>
                    <button style={styles.smallBtn} onClick={()=>{ setDetail(c); }}>Ver</button>{' '}
                    <button style={styles.smallBtn} onClick={()=>{ setEditing(c); setForm(c); setShowForm(true); }}>✏️</button>{' '}
                    <button style={styles.smallDangerBtn} onClick={()=>handleDelete(c.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* modal detalle */}
        {detail && (
          <div style={styles.modalOverlay} onClick={()=>setDetail(null)}>
            <div style={styles.modal} onClick={e=>e.stopPropagation()}>
              <h3>{detail.name}</h3>
              <p><strong>Población:</strong> {detail.location}</p>
              <p><strong>Email:</strong> {detail.email}</p>
              <p><strong>Teléfono:</strong> {detail.phone}</p>
              <p><strong>D.N.I.:</strong> {detail.dni}</p>
              <p><strong>Experiencia:</strong> {detail.experience}</p>
              <p><strong>¿Cómo nos conoció?</strong> {detail.howHeard}</p>
              <p><strong>Fecha Nac:</strong> {detail.dob}</p>
              <p><strong>Apodo:</strong> {detail.nickname}</p>
              <p><strong>Inmersiones:</strong> {detail.diveCount}</p>
              <p><strong>Última inmersión:</strong> {detail.lastDive}</p>
              <p><strong>Intereses:</strong> {detail.interests?.join(', ')}</p>
              <p><strong>Palabras clave:</strong> {detail.keywords?.join(', ')}</p>
              <p><strong>Preocupaciones:</strong> {detail.concerns}</p>
              <p><strong>Necesidades:</strong> {detail.specialNeeds}</p>
              <p><strong>Contacto pre:</strong> {detail.contactPref}</p>
              <p><strong>Notas:</strong> {detail.notes}</p>
              {detail.cursos && detail.cursos.length > 0 && (
                <div style={{marginTop:16}}>
                  <h4>Cursos completados</h4>
                  <ul>
                    {detail.cursos.map((c, i) => (
                      <li key={i}>
                        {c.curso} <span style={{color:'#888'}}>({c.fecha})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button style={styles.smallBtn} onClick={()=>setDetail(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ========== FORMULARIO REUTILIZABLE ===============
function ClientForm({ data, onChange, onCancel, onSave }) {
  const fld = [
    {k:'name', label:'Nombre completo', type:'text'},
    {k:'location',label:'Población', type:'text'},
    {k:'email',label:'Correo electrónico', type:'email'},
    {k:'phone',label:'Teléfono de contacto', type:'tel'},
    {k:'dni', label:'D.N.I.', type:'text'},
    {k:'experience',label:'Nivel de experiencia',type:'text'},
    {k:'howHeard',label:'¿Cómo nos has conocido?',type:'text'},
    {k:'dob', label:'Fecha de nacimiento', type:'date'},
    {k:'nickname',label:'Apodo/Nick', type:'text'},
    {k:'diveCount',label:'Nº inmersiones',type:'number'},
    {k:'lastDive',label:'Hace cuánto no buceas',type:'text'},
  ];
  const interestsOpt = ['Corales','Barcos hundidos','Vida marina','Fotografía'];
  const keywordsOpt  = ['Aventura','Relajación','Aprendizaje','Social'];
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 style={{marginTop:0}}>Datos del Cliente</h3>
        <form onSubmit={e=>{e.preventDefault(); onSave(data);}}>
          {fld.map(f=>(
            <div key={f.k} style={{marginBottom:12}}>
              <label style={styles.label}>{f.label}</label><br/>
              <input
                type={f.type} required
                value={data[f.k]}
                onChange={e=>onChange({...data, [f.k]:e.target.value})}
                style={styles.textInput}
              />
            </div>
          ))}
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Intereses especiales</label><br/>
            {interestsOpt.map(o=>(
              <label key={o} style={styles.checkboxLabel}>
                <input type="checkbox"
                  checked={data.interests.includes(o)}
                  onChange={()=>{
                    const arr = data.interests.includes(o)
                      ? data.interests.filter(x=>x!==o)
                      : [...data.interests,o];
                    onChange({...data, interests:arr});
                  }}
                /> {o}
              </label>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Palabras clave</label><br/>
            {keywordsOpt.map(o=>(
              <label key={o} style={styles.checkboxLabel}>
                <input type="checkbox"
                  checked={data.keywords.includes(o)}
                  onChange={()=>{
                    const arr = data.keywords.includes(o)
                      ? data.keywords.filter(x=>x!==o)
                      : [...data.keywords,o];
                    onChange({...data, keywords:arr});
                  }}
                /> {o}
              </label>
            ))}
          </div>
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Preocupaciones</label><br/>
            <textarea value={data.concerns}
              onChange={e=>onChange({...data,concerns:e.target.value})}
              style={{...styles.textInput, height:60}}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Necesidades especiales</label><br/>
            <textarea value={data.specialNeeds}
              onChange={e=>onChange({...data,specialNeeds:e.target.value})}
              style={{...styles.textInput, height:60}}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Pref. comunicación</label><br/>
            <input type="text" value={data.contactPref}
              onChange={e=>onChange({...data,contactPref:e.target.value})}
              style={styles.textInput}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={styles.label}>Algo más</label><br/>
            <textarea value={data.notes}
              onChange={e=>onChange({...data,notes:e.target.value})}
              style={{...styles.textInput, height:80}}/>
          </div>
          <div style={{textAlign:'right'}}>
            <button style={styles.smallBtn} type="submit">Guardar</button>{' '}
            <button style={styles.smallDangerBtn} onClick={onCancel}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== ESTILOS IGUAL ==========
const styles = {
  page: { background: '#eef7fc', minHeight:'100vh', fontFamily:'sans-serif' },
  header: { background:'#fff', padding:16, borderBottom:'1px solid #ccc' },
  logo: { margin:0, fontFamily:'Georgia, serif', fontSize:24, color:'#000' },
  logoD: { color:'red' },
  main: { maxWidth:960, margin:'24px auto', padding:16 },
  topBar: { display:'flex', justifyContent:'space-between', marginBottom:16 },
  link: { background:'none', border:'none', color:'#0070f3', cursor:'pointer' },
  dangerBtn:{ background:'#d24', color:'#fff', border:'none', padding:'6px 12px', borderRadius:4, cursor:'pointer' },
  primaryBtn:{ background:'#0070f3', color:'#fff', border:'none', padding:'10px 20px', borderRadius:4, cursor:'pointer', fontSize:16, marginBottom:18 },
  modeBar: { marginBottom:16, display:'flex', gap:12 },
  radioLabel:{ fontSize:14 },
  fileInput:{ marginBottom:16 },
  textInput:{ width:'100%', padding:8, border:'1px solid #ccc', borderRadius:4 },
  searchInput:{ width:'100%', padding:8, margin:'12px 0', border:'1px solid #ccc', borderRadius:4 },
  tableWrapper:{ overflowX:'auto', marginBottom:16 },
  table:{ width:'100%', borderCollapse:'collapse' },
  th:{ textAlign:'left', padding:8, borderBottom:'2px solid #ccc', background:'#f5faff' },
  tr:{ background:'#fff' },
  td:{ padding:8, borderBottom:'1px solid #eee' },
  smallBtn:{ background:'#0070f3', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:12 },
  smallDangerBtn:{ background:'#d24', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontSize:12 },
  checkboxLabel:{ marginRight:12, fontSize:14 },
  error:{ color:'red', marginTop:4 },
  modalOverlay:{ position:'fixed', top:0,left:0,right:0,bottom:0, background:'rgba(0,0,0,0.3)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:{ background:'#fff', borderRadius:8, padding:24, width:'90%', maxWidth:500, boxShadow:'0 4px 12px rgba(0,0,0,0.2)' },
  label:{ fontWeight:500, marginBottom:4, display:'block' }
};

