import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Bonos() {
  const router = useRouter();
  const [center, setCenter]       = useState(undefined);
  const [clients, setClients]     = useState([]);
  const [vouchers, setVouchers]   = useState([]); // { id, client, name, items: [{id, type, name, total, used}], history: [] }

  // Filters
  const [selectedClient, setSelectedClient] = useState('');
  const [searchTerm, setSearchTerm]         = useState('');

  // Form / Edit state
  const [editVoucher, setEditVoucher] = useState(null);
  const [name, setName]               = useState('');
  const [newItems, setNewItems]       = useState([]); // items for create/edit
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
  }, [vouchers, center]);

  // Añadir o actualizar voucher
  const handleSubmit = e => {
    e.preventDefault();
    if (!selectedClient || !name || newItems.length === 0) {
      return alert('Rellena cliente, nombre y al menos un ítem.');
    }
    const now = new Date().toISOString();
    if (editVoucher) {
      // update
      setVouchers(vs => vs.map(v => v.id === editVoucher.id
        ? { ...v,
            client: selectedClient,
            name,
            items: newItems,
          }
        : v
      ));
      setEditVoucher(null);
    } else {
      // new
      const v = {
        id: Date.now(),
        client: selectedClient,
        name,
        items: newItems.map(it => ({ ...it, used:0 })),
        history: []
      };
      setVouchers(vs => [...vs, v]);
    }
    // reset form
    setName(''); setNewItems([]);
  };

  // Dinámico: añadir un item al form
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
    setNewItems(v.items.map(it => ({ ...it })));  // shallow copy
  };
  const handleCancelEdit = () => {
    setEditVoucher(null);
    setName(''); setNewItems([]);
  };

  // Borrar voucher
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

  if (center === undefined) return <p>Cargando…</p>;

  // Filtrar lista
  const filtered = vouchers
    .filter(v => (!selectedClient || v.client === selectedClient))
    .filter(v => {
      const term = searchTerm.toLowerCase();
      return v.name.toLowerCase().includes(term)
        || v.client.toLowerCase().includes(term)
        || v.items.some(it => it.name.toLowerCase().includes(term));
    });

  return (
    <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:900, margin:'0 auto' }}>
      <h2>Bonos — Centro: {center}</h2>
      <button onClick={() => router.push('/')}>&larr; Volver</button>

      {/* Filtros */}
      <div style={{ margin:'20px 0' }}>
        <label>Cliente: </label>
        <select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}>
          <option value="">— Todos —</option>
          {clients.map((c,i)=><option key={i} value={c.name}>{c.name}</option>)}
        </select>
        <input
          placeholder="Buscar bonos..."
          style={{ marginLeft:12, padding:6 }}
          value={searchTerm}
          onChange={e=>setSearchTerm(e.target.value)}
        />
      </div>

      {/* Formulario dinámico + editar */}
      <form onSubmit={handleSubmit} style={{ marginBottom:30, border:'1px solid #ccc', padding:16, borderRadius:6 }}>
        <h3>{editVoucher ? 'Editar bono' : 'Crear nuevo bono'}</h3>
        <div style={{ marginBottom:12 }}>
          <label>Cliente: </label>
          <select
            required
            value={selectedClient}
            onChange={e=>setSelectedClient(e.target.value)}
          >
            <option value="">— Elige cliente —</option>
            {clients.map((c,i)=><option key={i} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom:12 }}>
          <label>Nombre: </label>
          <input
            required
            placeholder="Nombre del bono"
            value={name}
            onChange={e=>setName(e.target.value)}
            style={{ padding:6, width:'60%' }}
          />
        </div>
        {/* Gestión dinámica de ítems */}
        <div style={{ marginBottom:12 }}>
          <h4>Ítems incluidos</h4>
          {newItems.map(it=>(
            <div key={it.id} style={{ display:'flex', alignItems:'center', marginBottom:4 }}>
              <span>{it.type === 'dive' ? 'Inmersiones' : 'Curso'}: {it.name} ({it.used}/{it.total})</span>
              <button type="button" onClick={()=>handleRemoveItem(it.id)} style={{ marginLeft:8 }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <select value={itemType} onChange={e=>setItemType(e.target.value)}>
              <option value="dive">Inmersiones</option>
              <option value="course">Curso</option>
            </select>
            <input
              placeholder="Nombre ítem"
              value={itemName}
              onChange={e=>setItemName(e.target.value)}
              style={{ padding:6 }}
            />
            <input
              type="number" min="1"
              value={itemTotal}
              onChange={e=>setItemTotal(e.target.value)}
              style={{ width:80, padding:6 }}
            />
            <button type="button" onClick={handleAddItem}>Añadir ítem</button>
          </div>
        </div>
        <button type="submit" style={{ marginRight:8 }}>
          {editVoucher ? 'Guardar cambios' : 'Añadir bono'}
        </button>
        {editVoucher && <button type="button" onClick={handleCancelEdit}>Cancelar</button>}
      </form>

      {/* Tabla de bonos */}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={{ borderBottom:'1px solid #ddd', padding:8 }}>Cliente</th>
            <th style={{ borderBottom:'1px solid #ddd', padding:8 }}>Bono</th>
            <th style={{ borderBottom:'1px solid #ddd', padding:8 }}>Ítems</th>
            <th style={{ borderBottom:'1px solid #ddd', padding:8 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => (
            <>
              <tr key={v.id} style={{ borderBottom:'1px solid #eee' }}>
                <td style={{ padding:8 }}>{v.client}</td>
                <td style={{ padding:8 }}>{v.name}</td>
                <td style={{ padding:8 }}>
                  {v.items.map(it=> (
                    <div key={it.id} style={{ marginBottom:4 }}>
                      <strong>{it.name}</strong> ({it.used}/{it.total})
                      <button
                        onClick={() => handleUse(v.id, it.id)}
                        disabled={it.used >= it.total}
                        style={{ marginLeft:4 }}
                      >+1</button>
                    </div>
                  ))}
                </td>
                <td style={{ padding:8 }}>
                  <button onClick={()=>handleEdit(v)}>✏️</button>
                  <button onClick={()=>handleDelete(v.id)} style={{ marginLeft:8 }}>🗑️</button>
                </td>
              </tr>
              <tr key={v.id+"-hist"}>
                <td colSpan={4} style={{ padding:8 }}>
                  <details>
                    <summary>Historial de usos ({v.history.length})</summary>
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
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4} style={{ padding:8 }}>No hay bonos.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
