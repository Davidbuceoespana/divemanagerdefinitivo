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
  const [manualName, setManualName]           = useState("");
  const [manualPrice, setManualPrice]         = useState("");
  const [manualQty, setManualQty]             = useState(1);
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
  // ——— Nuevo handler: añadir producto manual al carrito ———
  const handleAddManual = () => {
    const name = manualName.trim();
    const price = parseFloat(manualPrice);
    const qty = parseInt(manualQty, 10);
    if (!name) {
      alert("Introduce un nombre para el producto");
      return;
    }
    if (isNaN(price) || price <= 0) {
      alert("Introduce un precio válido");
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      alert("Introduce una cantidad válida");
      return;
    }
    const id = `manual-${Date.now()}`;
    setCart(c => [
      ...c,
      { id, name, price, customPrice: price, qty, discountPct: 0 }
    ]);
    setManualName("");
    setManualPrice("");
    setManualQty(1);
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
  const sortedClosures = [...closures].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: 950,
      margin: '0 auto',
      background: '#fff',
      padding: 22,
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,80,180,0.07)',
      border: '1px solid #e2e8f0',
      color: '#111'
    }}>
      <h2 style={{
        textAlign: 'center',
        color: '#004085',
        fontWeight: 700,
        fontSize: 24,
        marginBottom: 16
      }}>
        Tickets y Cierres — {center}
      </h2>
      <div style={{ textAlign: 'right', marginBottom: 18 }}>
        <button style={btnBlue} onClick={() => setViewTickets(false)}>← Volver</button>
        <button style={{ ...btnBlue, background: '#28a745', marginLeft: 8 }} onClick={handleCloseBox}>
          Cerrar caja
        </button>
      </div>
      {/* Tickets abiertos */}
      <section style={{
        marginBottom: 36,
        padding: 20,
        border: '1.5px solid #0070f3',
        borderRadius: 14,
        background: '#f7fbfe',
        boxShadow: '0 3px 18px rgba(0,60,200,0.04)'
      }}>
        <h3 style={{
          color: '#0070f3',
          marginTop: 0,
          marginBottom: 18,
          fontSize: 19,
          fontWeight: 700
        }}>
          Tickets abiertos
        </h3>
        {tickets.length === 0
          ? <p style={{ color: '#888', fontSize: 15 }}>No hay tickets.</p>
          : tickets.map(t => (
            <div key={t.id} style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 8,
              border: '1px solid #b6d4fe',
              background: '#f4faff'
            }}>
              <strong style={{ color: '#004085', fontSize: 15 }}>#{t.id}</strong>
              <span style={{ float: 'right', color: '#0070f3', fontWeight: 500, fontSize: 14 }}>
                {new Date(t.date).toLocaleString()}
              </span>
              <br />
              <span style={{ color: '#004085', fontSize: 15 }}>Cajero:</span> {t.cashier} &nbsp;•&nbsp;
              <span style={{ color: '#004085', fontSize: 15 }}>Cliente:</span> {t.client || <em style={{ color: '#888' }}>—</em>}
              <br />
              {editingId === t.id ? (
                <div style={{ marginTop: 7 }}>
                  <select
                    value={editMethod}
                    onChange={e => setEditMethod(e.target.value)}
                    style={inputStyle}
                  >
                    {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button style={btnBlue} onClick={saveEdit}>Guardar</button>
                  <button style={{ ...btnBlue, background: '#aaa', marginLeft: 4 }} onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 7 }}>
                  <span style={{ color: '#004085', fontWeight: 600 }}>Forma de pago:</span>{' '}
                  <em style={{ color: '#0099cc', fontWeight: 600 }}>{t.paymentMethod}</em>
                  <button
                    onClick={() => { setEditingId(t.id); setEditMethod(t.paymentMethod); }}
                    style={{
                      marginLeft: 10,
                      border: 'none',
                      background: 'none',
                      color: '#0070f3',
                      fontSize: 18,
                      cursor: 'pointer'
                    }}
                    title="Editar"
                  >✏️</button>
                </div>
              )}
              <div style={{
                marginTop: 9,
                fontSize: 17,
                color: '#0070f3',
                fontWeight: 700
              }}>
                Total: {t.total.toFixed(2)}
              </div>
            </div>
          ))}
      </section>
      {/* Histórico de cierres de caja */}
      <section style={{
        padding: 20,
        border: '1.5px solid #0070f3',
        borderRadius: 14,
        background: '#f0f8ff',
        boxShadow: '0 3px 18px rgba(0,60,200,0.04)'
      }}>
        <h3 style={{
          color: '#0070f3',
          marginTop: 0,
          marginBottom: 15,
          fontSize: 19,
          fontWeight: 700
        }}>
          Histórico de cierres de caja
        </h3>
        {sortedClosures.length === 0
          ? <p style={{ color: '#888', fontSize: 15 }}>No hay cierres.</p>
          : sortedClosures.map(c => (
            <div key={c.id} style={{
              marginBottom: 15,
              padding: 12,
              borderRadius: 7,
              border: '1px solid #b6d4fe',
              background: '#f7fbfe'
            }}>
              <strong style={{ color: '#004085', fontSize: 15 }}>#{c.id}</strong>
              <span style={{ float: 'right', color: '#0070f3', fontWeight: 500, fontSize: 14 }}>
                {new Date(c.date).toLocaleString()}
              </span>
              <br />
              <span style={{ color: '#004085', fontSize: 15 }}>Cajero:</span> {c.cashier}
              <br />
              <span style={{ color: '#004085', fontSize: 15 }}>Tickets:</span> {c.ticketCount}
              <br />
              <span style={{ color: '#004085', fontSize: 15 }}>Facturado:</span> {(c.totalBilled || 0).toFixed(2)}
              <br />
              <span style={{ color: '#004085', fontSize: 15 }}>Efectivo:</span> {(c.totalCash || 0).toFixed(2)}
              <span style={{ margin: '0 8px', color: '#aaa' }}>•</span>
              <span style={{ color: '#004085', fontSize: 15 }}>Otros:</span> {(c.totalOther || 0).toFixed(2)}
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

   return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      maxWidth: 950,
      margin: '0 auto',
      color: '#111',
      background: '#fff',
      padding: 18,
      borderRadius: 18,
      boxShadow: '0 2px 12px rgba(0,80,180,0.07)',
      border: '1px solid #e2e8f0'
    }}>
      <h2 style={{
        textAlign: 'center',
        color: '#004085',
        letterSpacing: 0.5,
        marginBottom: 12,
        fontWeight: 700,
        fontSize: 24
      }}>
        TPV — Caja (Centro: {center})
      </h2>

      {/* Navegación */}
      <div style={{
        marginBottom: 18,
        textAlign: 'center',
        fontSize: 16,
        color: '#004085'
      }}>
        <Link href="/">← Panel</Link> |{' '}
        <Link href="/familias">Familias</Link> |{' '}
        <Link href="/productos">Productos</Link> |{' '}
        <button style={navBtnStyle} onClick={() => setViewTickets(true)}>Ver tickets y cierres</button> |{' '}
        <button style={navBtnStyle} onClick={() => setViewMethods(true)}>Formas de pago</button>
      </div>

      {/* Cajeros */}
      <div style={{ marginBottom: 18, textAlign: 'center' }}>
        <input
          type="text"
          placeholder="Nuevo cajero..."
          value={newCashier} onChange={e => setNewCashier(e.target.value)}
          style={inputStyle}
        />
        <button style={btnBlue} onClick={() => {
          const n = newCashier.trim();
          if (n && !cashiers.includes(n)) {
            setCashiers(v => [...v, n]);
            setNewCashier('');
          }
        }}>Añadir cajero</button>
        <br /><br />
        <select
          value={selectedCashier}
          onChange={e => setSelectedCashier(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Selecciona cajero —</option>
          {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Familias + Productos + Carrito + Cobro */}
      <div style={{
        display: 'flex',
        gap: 28,
        alignItems: 'flex-start'
      }}>
        {/* Familias y productos */}
        <div style={{
          flexBasis: 180,
          minWidth: 165
        }}>
          <label style={labelStyle}>Familia</label><br />
          <select value={selectedFamily} onChange={e => setSelectedFamily(e.target.value)} style={inputStyle}>
            <option value="">— Todas —</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid #b6d4fe',
            marginTop: 4,
            borderRadius: 8,
            background: '#f4faff'
          }}>
            {products
              .filter(p => !selectedFamily || p.family === selectedFamily)
              .map(p => (
                <li key={p.id}
                  onClick={() => handleAddToCart(p)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e3e8ef',
                    color: '#111',
                    transition: 'background 0.18s',
                    fontSize: 15
                  }}
                  onMouseOver={e => e.currentTarget.style.background = "#cde3ff"}
                  onMouseOut={e => e.currentTarget.style.background = ""}
                >
                  {p.name} — {p.price.toFixed(2)}
                  {Array.isArray(p.specialPrices) && p.specialPrices.some(s => s.client === selectedClient) && (
                    <em style={{ marginLeft: 8, color: '#00a884', fontSize: 13 }}>(Especial)</em>
                  )}
                </li>
              ))
            }
          </ul>
          {/* Producto manual compacto y minimal */}
          <div style={{
            marginTop: 14,
            padding: 10,
            border: '1px dashed #b6d4fe',
            borderRadius: 8,
            background: '#e8f0fb'
          }}>
            <h5 style={{
              fontSize: 15,
              margin: '2px 0 9px 0',
              fontWeight: 600,
              color: '#004085'
            }}>
              + Producto manual
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <input
                type="text"
                placeholder="Nombre"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                style={{ ...inputStyle, fontSize: 14, padding: 5, marginBottom: 0 }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="number" step="0.01"
                  placeholder="Precio"
                  value={manualPrice}
                  onChange={e => setManualPrice(e.target.value)}
                  style={{ ...inputStyle, width: '60%', fontSize: 14, padding: 5 }}
                />
                <input
                  type="number" min="1"
                  placeholder="Cant"
                  value={manualQty}
                  onChange={e => setManualQty(e.target.value)}
                  style={{ ...inputStyle, width: '40%', fontSize: 14, padding: 5 }}
                />
              </div>
              <button
                onClick={handleAddManual}
                style={{
                  marginTop: 6,
                  padding: '7px 0',
                  background: '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  fontWeight: 600,
                  fontSize: 15,
                  letterSpacing: 0.1,
                  cursor: 'pointer'
                }}
                title="Añadir producto manual"
              >+</button>
            </div>
          </div>
        </div>
        {/* Carrito principal */}
        <div style={{
          flex: 1,
          background: '#f7fbfe',
          border: '1.5px solid #0070f3',
          borderRadius: 18,
          boxShadow: '0 3px 18px rgba(0,60,200,0.06)',
          padding: 20,
          minWidth: 0
        }}>
          <label style={labelStyle}>Cliente</label><br />
          <input
            list="clients-dl"
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginBottom: 15 }}
          />
          <datalist id="clients-dl">
            {clients.map((c, i) => <option key={i} value={c} />)}
          </datalist>
          <h3 style={{
            color: '#0070f3',
            marginTop: 4,
            fontWeight: 700,
            marginBottom: 12,
            fontSize: 22,
            letterSpacing: 0.1
          }}>Carrito</h3>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 13,
            fontSize: 15
          }}>
            <thead>
              <tr style={{ background: '#ddeffe' }}>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Cant</th>
                <th style={thStyle}>Precio u.</th>
                <th style={thStyle}>Subtotal</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #b3e0ff' }}>
                  <td style={{ padding: 5 }}>{item.name}</td>
                  <td style={{ padding: 5 }}>
                    <input
                      type="number" min={1}
                      value={item.qty}
                      onChange={e => handleQtyChange(item.id, +e.target.value)}
                      style={{
                        ...inputStyle, width: 34, padding: 4, fontSize: 14
                      }}
                    />
                  </td>
                  <td style={{ padding: 5 }}>
                    <input
                      type="number" min={0} step="0.01"
                      value={item.customPrice}
                      onChange={e => handlePriceChange(item.id, +e.target.value)}
                      style={{
                        ...inputStyle, width: 60, padding: 4, fontSize: 14
                      }}
                    />
                  </td>
                  <td style={{ padding: 5 }}>
                    <strong>{(item.customPrice * item.qty).toFixed(2)}</strong>
                  </td>
                  <td style={{ padding: 5 }}>
                    <button onClick={() => handleRemove(item.id)} style={{
                      border: 'none',
                      background: 'none',
                      color: '#0070f3',
                      fontWeight: 900,
                      fontSize: 18,
                      cursor: 'pointer'
                    }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginBottom: 15, fontSize: 19, color: '#004085' }}>
            <strong>Total: {total.toFixed(2)}</strong>
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={labelStyle}>Forma de pago</label><br />
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            >
              <option value="">— Selecciona forma —</option>
              {methodsList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button
            onClick={handleCharge}
            disabled={!selectedCashier || !paymentMethod}
            style={{
              padding: '13px 0',
              width: '100%',
              background: (!selectedCashier || !paymentMethod) ? '#bcd3ee' : '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 18,
              cursor: (!selectedCashier || !paymentMethod) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
// ——— Estilos base reutilizables (puedes ponerlos arriba si lo prefieres) ———
const inputStyle = {
  border: '1px solid #b6d4fe',
  borderRadius: 6,
  padding: 7,
  fontSize: 15,
  color: '#111',
  background: '#f4faff',
  outline: 'none',
  marginBottom: 6
};

const btnBlue = {
  padding: '7px 15px',
  background: '#0070f3',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontWeight: 600,
  marginLeft: 4,
  cursor: 'pointer',
  fontSize: 15,
  letterSpacing: 0.2,
  transition: 'background 0.2s'
};

const navBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#004085',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 15,
  textDecoration: 'underline'
};

const labelStyle = {
  fontWeight: 600,
  fontSize: 15,
  color: '#004085'
};

const thStyle = {
  fontWeight: 700,
  color: '#003566',
  padding: 6,
  borderBottom: '1px solid #b6d4fe',
  fontSize: 15
};