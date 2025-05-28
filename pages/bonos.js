import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

function getClientData(clients, name) {
  return clients.find(c => c.name === name) || {};
}

// Helper barra de progreso
function ProgressBar({ used, total }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  let color = '#1cb98b'; // verde
  if (pct > 80) color = '#f82d2d'; // rojo cuando queda poco
  else if (pct > 50) color = '#f6b62e'; // naranja
  return (
    <div style={{ background:'#eee', borderRadius:8, overflow:'hidden', margin:'8px 0', width:140 }}>
      <div style={{
        height:16,
        background: color,
        width: `${pct}%`,
        transition: 'width 0.3s'
      }}/>
      <span style={{
        position:'relative', top:-18, left:5, fontSize:12, fontWeight:600, color:'#222'
      }}>{used}/{total}</span>
    </div>
  )
}

export default function Bonos() {
  const router = useRouter();
  const [center, setCenter]       = useState(undefined);
  const [clients, setClients]     = useState([]);
  const [vouchers, setVouchers]   = useState([]);
  
  // Buscador avanzado
  const [searchTerm, setSearchTerm]             = useState('');
  const [selectedClient, setSelectedClient]     = useState('');
  const [showOpenVouchers, setShowOpenVouchers] = useState(false);
  const [autocomplete, setAutocomplete]         = useState([]);

  // Estadísticas
  const [stats, setStats] = useState({});

  // Formulario
  const [editVoucher, setEditVoucher] = useState(null);
  const [name, setName]               = useState('');
  const [newItems, setNewItems]       = useState([]);
  const [itemType, setItemType]       = useState('dive');
  const [itemName, setItemName]       = useState('');
  const [itemTotal, setItemTotal]     = useState(1);

  // 1) Leer centro activo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = localStorage.getItem('active_center');
    if (!c) return router.replace('/login');
    setCenter(c);
  }, [router]);

  // 2) Cargar clientes y bonos
  useEffect(() => {
    if (!center) return;
    const cli = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    setClients(cli);
    const vch = JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || '[]');
    setVouchers(vch);
  }, [center]);

  // 3) Guardar cambios
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_vouchers_${center}`, JSON.stringify(vouchers));
    // Recalcular stats
    let activos = 0, totalBonos = vouchers.length, usos = 0, top = {};
    vouchers.forEach(v=>{
      const abiertos = v.items.reduce((ac,it)=>ac + (it.total-it.used),0);
      if (abiertos > 0) activos++;
      usos += v.items.reduce((ac,it)=>ac+it.used,0);
      top[v.client] = (top[v.client]||0)+v.items.reduce((ac,it)=>ac+it.used,0);
    });
    let topClients = Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,3);
    setStats({ totalBonos, activos, usos, topClients });
  }, [vouchers, center]);

  // Autocompletar clientes en búsqueda
  useEffect(() => {
    if (!searchTerm) setAutocomplete([]);
    else {
      const l = clients.filter(c=>c.name.toLowerCase().includes(searchTerm.toLowerCase()));
      setAutocomplete(l);
    }
  }, [searchTerm, clients]);

  // Añadir/editar voucher
  const handleSubmit = e => {
    e.preventDefault();
    if (!selectedClient || !name || newItems.length === 0) {
      return alert('Rellena cliente, nombre y al menos un ítem.');
    }
    if (editVoucher) {
      setVouchers(vs => vs.map(v => v.id === editVoucher.id
        ? { ...v, client: selectedClient, name, items: newItems }
        : v
      ));
      setEditVoucher(null);
    } else {
      const v = {
        id: Date.now(),
        client: selectedClient,
        name,
        items: newItems.map(it => ({ ...it, used:0 })),
        history: []
      };
      setVouchers(vs => [...vs, v]);
    }
    setName(''); setNewItems([]);
  };

  const handleAddItem = () => {
    if (!itemName || itemTotal < 1) return;
    setNewItems(arr => [...arr, {
      id: Date.now(),
      type: itemType,
      name: itemName,
      total: Number(itemTotal),
      used: 0
    }]);
    setItemName(''); setItemTotal(1);
  };
  const handleRemoveItem = id => {
    setNewItems(arr => arr.filter(it => it.id !== id));
  };

  // Edit inline: cargar valores al form
  const handleEdit = v => {
    setEditVoucher(v);
    setSelectedClient(v.client);
    setName(v.name);
    setNewItems(v.items.map(it => ({ ...it })));
  };
  const handleCancelEdit = () => {
    setEditVoucher(null);
    setName(''); setNewItems([]);
  };
  const handleDelete = id => {
    if (confirm('¿Eliminar bono?')) {
      setVouchers(vs => vs.filter(v => v.id !== id));
    }
  };

  // Uso +1 para un ítem
  const handleUse = (voucherId, itemId) => {
    setVouchers(vs => vs.map(v => {
      if (v.id !== voucherId) return v;
      const items = v.items.map(it => {
        if (it.id !== itemId || it.used >= it.total) return it;
        return { ...it, used: it.used + 1 };
      });
      const usedItem = v.items.find(it => it.id === itemId);
      const historyEntry = {
        date: new Date().toLocaleString(),
        itemName: usedItem.name
      };
      return { ...v, items, history: [...v.history, historyEntry] };
    }));
  };

  // WhatsApp y Email
  const handleWhatsApp = (phone, name, bono) => {
    if (!phone) return alert("El cliente no tiene teléfono guardado.");
    const msg = encodeURIComponent(`¡Hola ${name}! 👋\n\nTe recordamos tu bono: ${bono.name}\n¡Nos vemos pronto bajo el agua! 🌊🐟`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };
  const handleEmail = (email, name, bono) => {
    if (!email) return alert("El cliente no tiene email guardado.");
    const subject = encodeURIComponent(`Info de tu bono de buceo`);
    const body = encodeURIComponent(`Hola ${name},\n\nAquí tienes la info de tu bono: ${bono.name}\n¡A disfrutar bajo el agua!`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };
  const handlePrint = (client, bono) => {
    const win = window.open('', '_blank');
    win.document.write(`<html><body>
      <h2>Bono de Buceo - Buceo España</h2>
      <p><strong>Cliente:</strong> ${client.name}</p>
      <p><strong>Bono:</strong> ${bono.name}</p>
      <ul>
      ${bono.items.map(it=>`<li>${it.name}: ${it.used}/${it.total}</li>`).join('')}
      </ul>
      <p>¡Gracias por confiar en Buceo España!</p>
      </body></html>`);
    win.print();
    win.close();
  };

  if (center === undefined) return <p>Cargando…</p>;

  // Filtrar lista
  let filtered = vouchers;
  // Filtro bono abierto
  if (showOpenVouchers)
    filtered = filtered.filter(v=>v.items.some(it=>it.used < it.total));
  // Filtro cliente exacto
  if (selectedClient)
    filtered = filtered.filter(v => v.client === selectedClient);
  // Filtro búsqueda libre
  if (searchTerm)
    filtered = filtered.filter(v =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase())
      || v.client.toLowerCase().includes(searchTerm.toLowerCase())
      || v.items.some(it => it.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

  // 🎨 Estilo visual
  const mainColor = '#1cb98b', bgColor = '#f6fff9', canallaColor = '#fdc500';
  const titleStyle = { color:mainColor, fontWeight:900, fontSize:30, marginBottom:6 };
  const canallaPhrase = [
    "¡El vicio no se acaba bajo el agua!",
    "No vendemos equipo, vendemos ganas de bajar.",
    "Bonos fresquitos, inmersiones infinitas.",
    "¿Quién dijo que la felicidad no se compra?"
  ];

  return (
    <div style={{ padding:20, fontFamily:'Poppins, Arial, sans-serif', maxWidth:1000, margin:'0 auto', background:bgColor, borderRadius:12 }}>
      {/* Frase y cabecera */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:24, color:canallaColor, fontWeight:800 }}>{canallaPhrase[Math.floor(Math.random()*canallaPhrase.length)]}</span>
          <h2 style={titleStyle}>Bonos — Centro: {center}</h2>
        </div>
        <button onClick={() => router.push('/')} style={{
          background:mainColor, color:'#fff', fontWeight:700, border:'none',
          borderRadius:8, padding:'10px 18px', fontSize:16, boxShadow:'0 2px 10px #0002', cursor:'pointer'
        }}>&larr; Volver</button>
      </div>

      {/* 🔥 Resumen de estadísticas */}
      <div style={{ background:'#fff', borderRadius:10, boxShadow:'0 2px 8px #0001', display:'flex', gap:40, alignItems:'center', padding:'16px 32px', margin:'18px 0 22px 0', fontSize:18 }}>
        <span>🔥 <strong>{stats.activos||0}</strong> bonos activos</span>
        <span>🤿 <strong>{stats.usos||0}</strong> usos registrados</span>
        <span>🏆 Top clientes:&nbsp;
          {stats.topClients && stats.topClients.length === 0 && <em>Aún sin campeones</em>}
          {stats.topClients && stats.topClients.map(([name, count],i)=>
            <span key={name} style={{marginLeft:6}}>
              {i>0?', ':''}<strong>{name}</strong> ({count} usos)
            </span>
          )}
        </span>
      </div>

      {/* 🎯 Filtros y buscador */}
      <div style={{ margin:'16px 0', display:'flex', alignItems:'center', gap:18 }}>
        <div>
          <label style={{fontWeight:700, marginRight:4}}>Cliente:</label>
          <input
            style={{ padding:6, border:'1px solid #aaa', borderRadius:5, minWidth:180 }}
            value={searchTerm}
            placeholder="Busca cliente o bono..."
            onChange={e=>{
              setSearchTerm(e.target.value);
              setSelectedClient('');
            }}
            list="clientes-autocomplete"
          />
          <datalist id="clientes-autocomplete">
            {autocomplete.map(c=><option key={c.name} value={c.name}/>)}
          </datalist>
        </div>
        <div>
          <button
            onClick={()=>setShowOpenVouchers(v=>!v)}
            style={{
              padding:'7px 12px', marginRight:6, borderRadius:5,
              border:'none', background:showOpenVouchers ? mainColor : '#eee', color:showOpenVouchers ? '#fff':'#222',
              fontWeight:700, fontSize:15, boxShadow:'0 1px 4px #0001', cursor:'pointer'
            }}
          >
            {showOpenVouchers ? '🔎 Solo bonos abiertos' : 'Ver todos'}
          </button>
        </div>
      </div>

      {/* 🎫 Formulario */}
      <form onSubmit={handleSubmit} style={{ marginBottom:32, border:'2px dashed #1cb98b50', padding:18, borderRadius:9, background:'#fff', boxShadow:'0 2px 12px #0001' }}>
        <h3 style={{color:mainColor, fontWeight:700, fontSize:22, marginBottom:14}}>
          {editVoucher ? 'Editar bono' : 'Crea un bono y deja que empiece el vicio 🤑'}
        </h3>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontWeight:600 }}>Cliente: </label>
          <select required value={selectedClient} onChange={e=>setSelectedClient(e.target.value)} style={{ padding:6, borderRadius:4, minWidth:180 }}>
            <option value="">— Elige cliente —</option>
            {clients.map((c,i)=><option key={i} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontWeight:600 }}>Nombre bono: </label>
          <input
            required placeholder="Nombre del bono"
            value={name}
            onChange={e=>setName(e.target.value)}
            style={{ padding:6, borderRadius:4, minWidth:210, marginLeft:8 }}
          />
        </div>
        {/* Ítems */}
        <div style={{ marginBottom:10 }}>
          <h4 style={{ fontWeight:700, color:mainColor, margin:'7px 0' }}>Ítems incluidos</h4>
          {newItems.map(it=>(
            <div key={it.id} style={{ display:'flex', alignItems:'center', gap:6, background:'#f7fff9', borderRadius:4, padding:'3px 8px', marginBottom:4 }}>
              <span>{it.type==='dive'?'Inmersiones':'Curso'}: <strong>{it.name}</strong> ({it.used}/{it.total})</span>
              <ProgressBar used={it.used} total={it.total}/>
              <button type="button" onClick={()=>handleRemoveItem(it.id)} style={{ fontWeight:700, color:'#c00', background:'none', border:'none', fontSize:18, marginLeft:6, cursor:'pointer' }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:7 }}>
            <select value={itemType} onChange={e=>setItemType(e.target.value)} style={{ padding:6, borderRadius:4 }}>
              <option value="dive">Inmersiones</option>
              <option value="course">Curso</option>
            </select>
            <input
              placeholder="Nombre ítem"
              value={itemName}
              onChange={e=>setItemName(e.target.value)}
              style={{ padding:6, borderRadius:4 }}
            />
            <input
              type="number" min="1"
              value={itemTotal}
              onChange={e=>setItemTotal(e.target.value)}
              style={{ width:80, padding:6, borderRadius:4 }}
            />
            <button type="button" onClick={handleAddItem} style={{
              background:mainColor, color:'#fff', border:'none', borderRadius:6, padding:'7px 12px', fontWeight:700, cursor:'pointer'
            }}>Añadir ítem</button>
          </div>
        </div>
        <button type="submit" style={{
          marginRight:8, background:mainColor, color:'#fff',
          border:'none', borderRadius:7, padding:'9px 22px', fontWeight:700, fontSize:16, boxShadow:'0 2px 10px #0001'
        }}>
          {editVoucher ? 'Guardar cambios' : 'Añadir bono'}
        </button>
        {editVoucher && <button type="button" onClick={handleCancelEdit} style={{
          background:'#eee', color:'#222', border:'none', borderRadius:7, padding:'9px 18px', fontWeight:700, fontSize:16, marginLeft:7, cursor:'pointer'
        }}>Cancelar</button>}
      </form>

      {/* 🎟️ Tabla de bonos */}
      <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'0 2px 12px #0001' }}>
        <thead>
          <tr style={{ background:mainColor, color:'#fff' }}>
            <th style={{ padding:12 }}>Cliente</th>
            <th style={{ padding:12 }}>Bono</th>
            <th style={{ padding:12 }}>Ítems</th>
            <th style={{ padding:12 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => {
            const client = getClientData(clients, v.client);
            return (
              <>
                <tr key={v.id} style={{ borderBottom:'1px solid #eee', background:'#fff' }}>
                  <td style={{ padding:10, fontWeight:600, fontSize:17, color:mainColor }}>{v.client}</td>
                  <td style={{ padding:10 }}>{v.name}</td>
                  <td style={{ padding:10 }}>
                    {v.items.map(it=>(
                      <div key={it.id} style={{ marginBottom:6, display:'flex', alignItems:'center', gap:10 }}>
                        <span>
                          <strong>{it.name}</strong> ({it.used}/{it.total})
                        </span>
                        <ProgressBar used={it.used} total={it.total}/>
                        <button
                          onClick={() => handleUse(v.id, it.id)}
                          disabled={it.used >= it.total}
                          style={{
                            background:it.used<it.total?mainColor:'#ddd',
                            color:'#fff', border:'none', borderRadius:5, padding:'3px 9px', marginLeft:3, fontWeight:700, cursor: it.used<it.total?'pointer':'not-allowed'
                          }}
                        >+1</button>
                      </div>
                    ))}
                  </td>
                  <td style={{ padding:10 }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      <button onClick={()=>handleEdit(v)} style={{ background:'#fff', border:'1px solid #aaa', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:700 }}>✏️ Editar</button>
                      <button onClick={()=>handleDelete(v.id)} style={{ background:'#fff', border:'1px solid #aaa', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:700, color:'#c00' }}>🗑️ Borrar</button>
                      <button onClick={()=>handleWhatsApp(client.phone, v.client, v)} style={{ background:'#25D366', color:'#fff', border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:700 }}>💬 WhatsApp</button>
                      <button onClick={()=>handleEmail(client.email, v.client, v)} style={{ background:'#0077ee', color:'#fff', border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:700 }}>📧 Email</button>
                      <button onClick={()=>handlePrint(client, v)} style={{ background:'#fdc500', color:'#333', border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:700 }}>🖨️ Imprimir</button>
                    </div>
                  </td>
                </tr>
                <tr key={v.id+"-hist"}>
                  <td colSpan={4} style={{ padding:8, background:'#f9f9f9' }}>
                    <details>
                      <summary style={{ cursor:'pointer', fontWeight:700, color:mainColor }}>Historial de usos ({v.history.length})</summary>
                      <ul>
                        {v.history.map((h,i)=>(
                          <li key={i}>{h.date}: {h.itemName}</li>
                        ))}
                        {v.history.length === 0 && <li>No hay registros.</li>}
                      </ul>
                    </details>
                  </td>
                </tr>
              </>
            )
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ padding:16, color:'#777', fontWeight:600, textAlign:'center' }}>No hay bonos que coincidan.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
