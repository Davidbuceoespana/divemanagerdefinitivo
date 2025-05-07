// components/Caja.js
import { useState, useEffect } from 'react';
import Link from 'next/link';

const DEFAULT_METHODS = ['Enlace de pago', 'Efectivo', 'Clip', 'Transferencia', 'Bizum'];

export default function Caja() {
  // ——— 1) Todos los hooks al principio ———
  const [center, setCenter]                   = useState(undefined);
  const [products, setProducts]               = useState([]);   // { id, family, name, price, specialPrices? }
  const [families, setFamilies]               = useState([]);
  const [clients, setClients]                 = useState([]);
  const [cashiers, setCashiers]               = useState([]);   // lista de cajeros
  const [newCashier, setNewCashier]           = useState('');
  const [cart, setCart]                       = useState([]);   // { id, name, price, customPrice, qty, discountPct }
  const [selectedFamily, setSelectedFamily]   = useState('');
  const [selectedClient, setSelectedClient]   = useState('');
  const [selectedCashier, setSelectedCashier] = useState('');
  const [paymentMethod, setPaymentMethod]     = useState('');
  const [methodsList, setMethodsList]         = useState(DEFAULT_METHODS);
  const [newMethod, setNewMethod]             = useState('');
  const [tickets, setTickets]                 = useState([]);
  const [closures, setClosures]               = useState([]);
  const [viewTickets, setViewTickets]         = useState(false);
  const [viewMethods, setViewMethods]         = useState(false);
  const [editingId, setEditingId]             = useState(null);
  const [editMethod, setEditMethod]           = useState('');
  const [total, setTotal]                     = useState(0);

  // ——— 2) Centro activo ———
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCenter(localStorage.getItem('active_center'));
  }, []);

  // ——— 3) Productos y familias ———
  useEffect(() => {
    if (!center) return;
    const raw = JSON.parse(localStorage.getItem(`dive_manager_products_${center}`) || '[]');
    const norm = raw.map(p => ({
      ...p,
      price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0
    }));
    setProducts(norm);
    setFamilies([...new Set(norm.map(p => p.family))]);
  }, [center]);

  // ——— 4) Clientes CRM ———
  useEffect(() => {
    if (!center) return;
    const raw = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    setClients(raw.map(c => c.name));
  }, [center]);

  // ——— 5) Cajeros ———
  useEffect(() => {
    if (!center) return;
    const raw = localStorage.getItem(`dive_manager_cashiers_${center}`);
    setCashiers(raw ? JSON.parse(raw) : []);
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_cashiers_${center}`, JSON.stringify(cashiers));
  }, [cashiers, center]);

  // ——— 6) Tickets y cierres de caja ———
  useEffect(() => {
    if (!center) return;
    setTickets(JSON.parse(localStorage.getItem(`dive_manager_tickets_${center}`) || '[]'));
    setClosures(JSON.parse(localStorage.getItem(`dive_manager_closures_${center}`) || '[]'));
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_tickets_${center}`, JSON.stringify(tickets));
    localStorage.setItem(`dive_manager_closures_${center}`, JSON.stringify(closures));
  }, [tickets, closures, center]);

  // ——— 7) Métodos de pago dinámicos ———
  useEffect(() => {
    if (!center) return;
    const raw = localStorage.getItem(`dive_manager_methods_${center}`);
    setMethodsList(raw ? JSON.parse(raw) : DEFAULT_METHODS);
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_methods_${center}`, JSON.stringify(methodsList));
  }, [methodsList, center]);

  // ——— 8) Calcular total carrito ———
  useEffect(() => {
    setTotal(cart.reduce((sum, i) => sum + i.customPrice * i.qty, 0));
  }, [cart]);

  // ——— 9) Early returns ———
  if (center === undefined) return <p style={{ padding:20, fontFamily:'sans-serif' }}>Cargando…</p>;
  if (!center) return null;

  // **Sin símbolo de moneda**
  const currency = '';

  // ——— 10) Handlers de carrito ———
  const handleAddToCart = prod => {
    const basePrice = prod.price;
    let clientPrice = basePrice;
    if (Array.isArray(prod.specialPrices)) {
      const sp = prod.specialPrices.find(s => s.client === selectedClient);
      if (sp) {
        if (sp.price != null) clientPrice = Number(sp.price);
        else if (sp.discount != null) clientPrice = +(basePrice * (1 - sp.discount/100)).toFixed(2);
      }
    }
    setCart(c =>
      c.find(x => x.id === prod.id)
        ? c.map(x => x.id === prod.id ? { ...x, qty: x.qty + 1 } : x)
        : [...c, { id: prod.id, name: prod.name, price: basePrice, customPrice: clientPrice, qty:1, discountPct:0 }]
    );
  };
  const handleQtyChange    = (id,qty)   => setCart(c=>c.map(x=>x.id===id?{...x,qty}:x));
  const handlePriceChange  = (id,p)     => setCart(c=>c.map(x=>x.id===id?{...x,customPrice:p}:x));
  const handleRemove       = id         => setCart(c=>c.filter(x=>x.id!==id));
  const handleClear        = ()         => setCart([]);

  // ——— 11) Cobrar → ticket + exportar compras al CRM ———
  const handleCharge = () => {
    if (!selectedCashier) {
      alert('Debes seleccionar un cajero antes de cobrar.');
      return;
    }
    if (!paymentMethod) {
      alert('Debes seleccionar una forma de pago antes de cobrar.');
      return;
    }
    const now = new Date();
    const ticket = {
      id: Date.now(),
      date: now.toISOString(),
      cashier: selectedCashier,
      client: selectedClient,
      paymentMethod,
      items: cart,
      total
    };

    // 1) Guardamos el ticket
    setTickets(t => [...t, ticket]);

    // 2) Exportamos cada línea de carrito como compra al CRM
    const rawClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    const updatedClients = rawClients.map(c => {
      if (c.name === selectedClient) {
        const prev = Array.isArray(c.purchases) ? c.purchases : [];
        const linePurchases = cart.map(item => ({
          date: now.toISOString(),
          product: item.name,
          amount: item.customPrice * item.qty
        }));
        return { ...c, purchases: [...prev, ...linePurchases] };
      }
      return c;
    });
    localStorage.setItem(`dive_manager_clients_${center}`, JSON.stringify(updatedClients));

    alert(`Cobrado ${total.toFixed(2)}${currency}`);
    handleClear();
  };

  // ——— 12) Cerrar caja → cierre histórico ———
  const handleCloseBox = () => {
    const now = new Date();
    const ticketCount = tickets.length;
    const totalBilled = tickets.reduce((s,t)=>s + (t.total||0), 0);
    const totalCash   = tickets.filter(t=>t.paymentMethod==='Efectivo').reduce((s,t)=>s + (t.total||0), 0);
    const totalOther  = totalBilled - totalCash;
    const c = {
      id: Date.now(),
      date: now.toISOString(),
      cashier: selectedCashier,
      ticketCount,
      totalBilled,
      totalCash,
      totalOther
    };
    setClosures(v=>[...v,c]);
    setTickets([]); // tickets ya cerrados desaparecen
    alert(`Caja cerrada: ${totalBilled.toFixed(2)}${currency}`);
  };

  // ——— 13) Guardar edición de forma de pago ———
  const saveEdit = () => {
    setTickets(t => t.map(x => x.id === editingId ? { ...x, paymentMethod: editMethod } : x));
    setEditingId(null);
  };

  // ——— 14) Vista “Tickets y Cierres” ———
  if (viewTickets) {
    const sortedClosures = [...closures].sort((a,b)=>new Date(b.date)-new Date(a.date));
    return (
      <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:800, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center' }}>Tickets y Cierres — {center}</h2>
        <div style={{ textAlign:'right', marginBottom:12 }}>
          <button onClick={()=>setViewTickets(false)}>← Volver</button>
          <button onClick={handleCloseBox} style={{ marginLeft:8 }}>Cerrar caja</button>
        </div>
        <section style={{ marginBottom:30, padding:16, border:'1px solid #ccc', borderRadius:6, background:'#fafafa' }}>
          <h3>Tickets abiertos</h3>
          {tickets.length===0 ? <p>No hay tickets.</p> : tickets.map(t=>(
            <div key={t.id} style={{ marginBottom:12, padding:8, borderBottom:'1px solid #ddd' }}>
              <strong>#{t.id}</strong> — {new Date(t.date).toLocaleString()}<br/>
              Cajero: {t.cashier} — Cliente: {t.client}<br/>
              {editingId===t.id
                ? <>
                    <select value={editMethod} onChange={e=>setEditMethod(e.target.value)} style={{ marginRight:8 }}>
                      {methodsList.map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={saveEdit}>Guardar</button>
                    <button onClick={()=>setEditingId(null)} style={{ marginLeft:4 }}>Cancelar</button>
                  </>
                : <>
                    Forma de pago: <em>{t.paymentMethod}</em>
                    <button onClick={()=>{ setEditingId(t.id); setEditMethod(t.paymentMethod); }} style={{ marginLeft:8 }}>✏️</button>
                  </>
              }
              <div>Total: {t.total.toFixed(2)}{currency}</div>
            </div>
          ))}
        </section>
        <section style={{ padding:16, border:'1px solid #ccc', borderRadius:6, background:'#f0f0f0' }}>
          <h3>Histórico de cierres de caja</h3>
          {sortedClosures.length===0 ? <p>No hay cierres.</p> : sortedClosures.map(c=>(
            <div key={c.id} style={{ marginBottom:12 }}>
              <strong>#{c.id}</strong> — {new Date(c.date).toLocaleString()}<br/>
              Cajero: {c.cashier}<br/>
              Tickets: {c.ticketCount}<br/>
              Facturado: {(c.totalBilled||0).toFixed(2)}{currency}<br/>
              Efectivo: {(c.totalCash||0).toFixed(2)}{currency} • Otros: {(c.totalOther||0).toFixed(2)}{currency}
            </div>
          ))}
        </section>
      </div>
    );
  }

  // ——— 15) Vista “Formas de pago” ———
  if (viewMethods) {
    return (
      <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:400, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center' }}>Formas de Pago — {center}</h2>
        <button onClick={()=>setViewMethods(false)}>← Volver</button>
        <form onSubmit={e=>{ e.preventDefault(); const m=newMethod.trim(); if(m&&!methodsList.includes(m)) setMethodsList(v=>[...v,m]); setNewMethod(''); }} style={{ margin:'20px 0' }}>
          <input value={newMethod} onChange={e=>setNewMethod(e.target.value)} placeholder="Nueva forma..." style={{ padding:6, marginRight:8 }} />
          <button type="submit">Añadir</button>
        </form>
        <ul>
          {methodsList.map((m,i)=><li key={i} style={{ marginBottom:6 }}>
            {m}
            <button onClick={()=>setMethodsList(v=>v.filter(x=>x!==m))} style={{ marginLeft:8, color:'red' }}>🗑️</button>
          </li>)}
          {!methodsList.length && <p>No hay formas.</p>}
        </ul>
      </div>
    );
  }

  // ——— 16) Render TPV normal ———
  return (
    <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:900, margin:'0 auto' }}>
      <h2 style={{ textAlign:'center' }}>TPV — Caja (Centro: {center})</h2>
      <div style={{ marginBottom:20, textAlign:'center' }}>
        <Link href="/">← Panel</Link> |{' '}
        <Link href="/familias">Familias</Link> |{' '}
        <Link href="/productos">Productos</Link> |{' '}
        <button onClick={()=>setViewTickets(true)}>Ver tickets y cierres</button> |{' '}
        <button onClick={()=>setViewMethods(true)}>Formas de pago</button>
      </div>
      {/* Gestión de cajeros */}
      <div style={{ marginBottom:20, textAlign:'center' }}>
        <input
          type="text" placeholder="Nuevo cajero..."
          value={newCashier} onChange={e=>setNewCashier(e.target.value)}
          style={{ padding:6, marginRight:8 }}
        />
        <button onClick={()=>{
          const n=newCashier.trim();
          if(n&&!cashiers.includes(n)) {
            setCashiers(v=>[...v,n]);
            setNewCashier('');
          }
        }}>Añadir cajero</button>
        <br/><br/>
        <select
          value={selectedCashier}
          onChange={e=>setSelectedCashier(e.target.value)}
          style={{ padding:6 }}
        >
          <option value="">— Selecciona cajero —</option>
          {cashiers.map(c=> <option key={c} value={c}>{c}</option> )}
        </select>
      </div>
      {/* Familias + Productos + Carrito + Cobro */}
      <div style={{ display:'flex', gap:16 }}>
        {/* Familias y productos */}
        <div>
          <label>Familia</label><br/>
          <select value={selectedFamily} onChange={e=>setSelectedFamily(e.target.value)}>
            <option value="">— Todas —</option>
            {families.map(f=> <option key={f} value={f}>{f}</option> )}
          </select>
          <ul style={{
            listStyle:'none', padding:0, maxHeight:200,
            overflowY:'auto', border:'1px solid #ccc', marginTop:4
          }}>
            {products
              .filter(p=>!selectedFamily||p.family===selectedFamily)
              .map(p=>(
                <li key={p.id}
                    onClick={()=>handleAddToCart(p)}
                    style={{
                      padding:'6px 8px', cursor:'pointer',
                      borderBottom:'1px solid #eee'
                    }}
                >
                  {p.name} — {p.price.toFixed(2)}
                  {Array.isArray(p.specialPrices) && p.specialPrices.some(s=>s.client===selectedClient) && (
                    <em style={{ marginLeft:8, color:'green' }}>(Especial)</em>
                  )}
                </li>
              ))
            }
          </ul>
        </div>
        {/* Carrito y Cobro */}
        <div style={{ flex:1 }}>
          <label>Cliente</label><br/>
          <input
            list="clients-dl"
            value={selectedClient}
            onChange={e=>setSelectedClient(e.target.value)}
            style={{ width:'100%', padding:6, marginBottom:12 }}
          />
          <datalist id="clients-dl">
            {clients.map((c,i)=><option key={i} value={c}/>)}
          </datalist>
          <h3>Carrito</h3>
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:12 }}>
            <thead>
              <tr>
                <th>Producto</th><th>Cant</th><th>Precio u.</th><th>Subtotal</th><th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item=>(
                <tr key={item.id} style={{ borderBottom:'1px solid #ddd' }}>
                  <td style={{ padding:4 }}>{item.name}</td>
                  <td style={{ padding:4 }}>
                    <input
                      type="number" min={1}
                      value={item.qty}
                      onChange={e=>handleQtyChange(item.id,+e.target.value)}
                      style={{ width:40 }}
                    />
                  </td>
                  <td style={{ padding:4 }}>
                    <input
                      type="number" min={0} step="0.01"
                      value={item.customPrice}
                      onChange={e=>handlePriceChange(item.id,+e.target.value)}
                      style={{ width:60 }}
                    /> 
                  </td>
                  <td style={{ padding:4 }}>
                    <strong>{(item.customPrice * item.qty).toFixed(2)}</strong>
                  </td>
                  <td style={{ padding:4 }}>
                    <button onClick={()=>handleRemove(item.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginBottom:12 }}>
            <strong>Total: {total.toFixed(2)}</strong>
          </div>
          <div style={{ marginBottom:12 }}>
            <label>Forma de pago</label><br/>
            <select
              value={paymentMethod}
              onChange={e=>setPaymentMethod(e.target.value)}
              style={{ width:'100%', padding:6 }}
            >
              <option value="">— Selecciona forma —</option>
              {methodsList.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button
            onClick={handleCharge}
            disabled={!selectedCashier || !paymentMethod}
            style={{
              padding:'10px 20px',
              background: (!selectedCashier || !paymentMethod) ? '#ccc' : '#28a745',
              color:'white',
              border:'none',
              borderRadius:4,
              cursor: (!selectedCashier || !paymentMethod) ? 'not-allowed' : 'pointer'
            }}
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
