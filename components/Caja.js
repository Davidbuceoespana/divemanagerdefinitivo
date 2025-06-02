import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { saveAs } from 'file-saver';  // Para descargar ZIP/JSON/CSV. Instalar con: npm install file-saver

const DEFAULT_METHODS = ['Enlace de pago', 'Efectivo', 'Clip', 'Transferencia', 'Bizum'];

export default function Caja() {
  // —— 1) Hooks principales ——
  const [center, setCenter]                   = useState(undefined);
  const [products, setProducts]               = useState([]);
  const [families, setFamilies]               = useState([]);
  const [clients, setClients]                 = useState([]);      // {name, points, purchases}
  const [clientNames, setClientNames]         = useState([]);     // Solo nombres para datalist
  const [cashiers, setCashiers]               = useState([]);
  const [newCashier, setNewCashier]           = useState('');
  const [cart, setCart]                       = useState([]);
  const [selectedFamily, setSelectedFamily]   = useState('');
  const [selectedClient, setSelectedClient]   = useState('');
  const [selectedCashier, setSelectedCashier] = useState('');
  const [paymentMethod, setPaymentMethod]     = useState('');
  const [methodsList, setMethodsList]         = useState(DEFAULT_METHODS);
  const [newMethod, setNewMethod]             = useState('');
  const [tickets, setTickets]                 = useState([]);      // Tickets abiertos
  const [closures, setClosures]               = useState([]);      // Cierres de caja
  const [viewTickets, setViewTickets]         = useState(false);   // Vista de tickets y devoluciones
  const [viewMethods, setViewMethods]         = useState(false);
  const [viewReturns, setViewReturns]         = useState(false);   // Vista de devoluciones
  const [editingId, setEditingId]             = useState(null);
  const [editMethod, setEditMethod]           = useState('');
  const [manualName, setManualName]           = useState("");
  const [manualPrice, setManualPrice]         = useState("");
  const [manualQty, setManualQty]             = useState(1);

  // —— Para “tarjeta de fidelidad” ——
  const [clientPoints, setClientPoints]       = useState(0);
  const [clientPurchases, setClientPurchases] = useState([]);       // Historial del cliente seleccionado
  const [redeemedPoints, setRedeemedPoints]   = useState(false);

  // —— Para devoluciones / notas de crédito ——
  const [returnTickets, setReturnTickets]     = useState([]);       // Historial de devoluciones
  const [selectedReturnTicket, setSelectedReturnTicket] = useState(null);
  const [returnItems, setReturnItems]         = useState({});       // { itemId: qty }

  // —— Estadísticas y rankings ——
  const [frases] = useState([
    '¡A la caja solo se viene a sumar!',
    'Hoy vendes como si te fuera la vida!',
    'No vendemos equipo, vendemos ganas de bajar.',
    'Que no te cuadre el sueldo, pero sí la caja.',
    'Caja cuadrada, día redondo.',
    'Hoy facturamos para el after dive.',
    'En esta caja solo caben buenas noticias.',
    'Si hay cash, hay buceo.',
    'Cada venta es una historia bajo el agua.',
    'Caja feliz, jefe feliz.',
  ]);

  // —— 2) Centro activo ——
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCenter(localStorage.getItem('active_center'));
  }, []);

  // —— 3) Productos y familias ——
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

  // —— 4) Clientes CRM ——
  useEffect(() => {
    if (!center) return;
    const raw = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    // Aseguramos que cada cliente tenga puntos y purchases
    const normalized = raw.map(c => ({
      name: c.name,
      points: typeof c.points === 'number' ? c.points : (c.points ? Number(c.points) : 0),
      purchases: Array.isArray(c.purchases) ? c.purchases : []
    }));
    setClients(normalized);
    setClientNames(normalized.map(c => c.name));
  }, [center]);

  // —— 5) Cajeros ——
  useEffect(() => {
    if (!center) return;
    const raw = localStorage.getItem(`dive_manager_cashiers_${center}`);
    setCashiers(raw ? JSON.parse(raw) : []);
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_cashiers_${center}`, JSON.stringify(cashiers));
  }, [cashiers, center]);

  // —— 6) Tickets y cierres de caja ——
  useEffect(() => {
    if (!center) return;
    setTickets(JSON.parse(localStorage.getItem(`dive_manager_tickets_${center}`) || '[]'));
    setClosures(JSON.parse(localStorage.getItem(`dive_manager_closures_${center}`) || '[]'));
    setReturnTickets(JSON.parse(localStorage.getItem(`dive_manager_returns_${center}`) || '[]'));
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_tickets_${center}`, JSON.stringify(tickets));
    localStorage.setItem(`dive_manager_closures_${center}`, JSON.stringify(closures));
    localStorage.setItem(`dive_manager_returns_${center}`, JSON.stringify(returnTickets));
  }, [tickets, closures, returnTickets, center]);

  // —— 7) Métodos de pago dinámicos ——
  useEffect(() => {
    if (!center) return;
    const raw = localStorage.getItem(`dive_manager_methods_${center}`);
    setMethodsList(raw ? JSON.parse(raw) : DEFAULT_METHODS);
  }, [center]);
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_methods_${center}`, JSON.stringify(methodsList));
  }, [methodsList, center]);

  // —— 8) Calcular total carrito (con descuento) ——
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + (item.customPrice * item.qty) * (1 - (item.discountPct || 0)/100),
    0
  );
  // Si canjearon puntos, aplicamos 10% de descuento
  const discountFromPoints = redeemedPoints ? cartSubtotal * 0.10 : 0;
  const total = cartSubtotal - discountFromPoints;

  // —— 9) Cargar datos del cliente seleccionado (historial + puntos) ——
  useEffect(() => {
    if (!selectedClient || !center) {
      setClientPoints(0);
      setClientPurchases([]);
      setRedeemedPoints(false);
      return;
    }
    // Buscamos el objeto del cliente
    const rawClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    const clientObj = rawClients.find(c => c.name === selectedClient);
    if (clientObj) {
      setClientPoints(clientObj.points || 0);
      setClientPurchases(clientObj.purchases || []);
    } else {
      setClientPoints(0);
      setClientPurchases([]);
    }
    setRedeemedPoints(false);
  }, [selectedClient, center]);

  // —— Early returns ——
  if (center === undefined) return <p style={{ padding:20, fontFamily:'sans-serif' }}>Cargando…</p>;
  if (!center) return null;
  const currency = '€';

  // —— 10) Handlers carrito con descuento ——
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
  const handleAddManual = () => {
    const name = manualName.trim();
    const price = parseFloat(manualPrice);
    const qty = parseInt(manualQty, 10);
    if (!name) { alert("Introduce un nombre para el producto"); return; }
    if (isNaN(price) || price <= 0) { alert("Introduce un precio válido"); return; }
    if (isNaN(qty) || qty <= 0) { alert("Introduce una cantidad válida"); return; }
    const id = `manual-${Date.now()}`;
    setCart(c => [
      ...c,
      { id, name, price, customPrice: price, qty, discountPct: 0 }
    ]);
    setManualName("");
    setManualPrice("");
    setManualQty(1);
  };
  const handleQtyChange      = (id,qty)   => setCart(c=>c.map(x=>x.id===id?{...x,qty}:x));
  const handlePriceChange    = (id,p)     => setCart(c=>c.map(x=>x.id===id?{...x,customPrice:p}:x));
  const handleRemove         = id         => setCart(c=>c.filter(x=>x.id!==id));
  const handleDiscountChange = (id, discount) =>
    setCart(c => c.map(x => x.id === id ? { ...x, discountPct: discount } : x));
  const handleClear          = ()         => setCart([]);
// — 11) Cobrar → ticket + exportar compras al CRM + actualizar puntos ——
const handleCharge = () => {
  if (!selectedCashier) {
    alert('Debes seleccionar un cajero antes de cobrar.');
    return;
  }
  if (!paymentMethod) {
    alert('Debes seleccionar una forma de pago antes de cobrar.');
    return;
  }
     // 1) El “total” ya incluye el descuento de puntos (si se canjearon)
  const ticketTotal = total;

  // 2) Ahora sí calculamos los puntos ganados (5% del total)
  const earnedPoints = Math.floor(ticketTotal * 0.20);

  // 3) Obtenemos la lista cruda de clientes y la actualizamos:
  const rawClients = JSON.parse(
    localStorage.getItem(`dive_manager_clients_${center}`) || '[]'
  );

  // 4) Si el cliente canjeó puntos, restamos 100; luego sumamos lo ganado:
  const updatedClients = rawClients.map(c => {
    if (c.name === selectedClient) {
      const prevPoints = c.points || 0;
      const newPoints = prevPoints - (redeemedPoints ? 100 : 0) + earnedPoints;
      // Actualizamos sus compras (añadimos cada línea del carrito)
      const prevPurchases = Array.isArray(c.purchases) ? c.purchases : [];
      const now = new Date().toISOString();
      const linePurchases = cart.map(item => ({
        date: now,
        product: item.name,
        amount:
          (item.customPrice * item.qty) *
          (1 - (item.discountPct || 0) / 100),
      }));
      return {
        ...c,
        points: newPoints,
        purchases: [...prevPurchases, ...linePurchases],
      };
    }
    return c;
  });

  // 5) Guardamos la lista actualizada de clientes en localStorage
  localStorage.setItem(
    `dive_manager_clients_${center}`,
    JSON.stringify(updatedClients)
  );

  // 6) Generamos el objeto “ticket” y lo guardamos en estado:
  const now = new Date().toISOString();
  const ticket = {
    id: Date.now(),
    date: now,
    cashier: selectedCashier,
    client: selectedClient,
    paymentMethod,
    items: cart,
    total: ticketTotal,
  };
  setTickets((t) => [...t, ticket]);

  alert(`Cobrado ${ticketTotal.toFixed(2)}${currency}`);

  // 7) Limpiamos el carrito y reseteamos canjeo de puntos:
  setCart([]);
  setRedeemedPoints(false);
};

  // —— 12) Cerrar caja ——
  const handleCloseBox = () => {
    const now = new Date();
    const ticketCount = tickets.length;
    const totalBilled = tickets.reduce((s,t)=>s + (t.total||0), 0);
    const totalCash   = tickets.filter(t=>t.paymentMethod==='Efectivo').reduce((s,t)=>s + (t.total||0), 0);
    const totalOther  = totalBilled - totalCash;
    // Ranking de productos vendidos en este cierre
    const ticketsCopy = JSON.parse(JSON.stringify(tickets));
    const c = {
      id: Date.now(),
      date: now.toISOString(),
      cashier: selectedCashier,
      ticketCount,
      totalBilled,
      totalCash,
      totalOther,
      tickets: ticketsCopy
    };
    setClosures(v=>[...v,c]);
    setTickets([]);
    alert(`Caja cerrada: ${totalBilled.toFixed(2)}${currency}`);
  };

  // —— 13) Guardar edición de forma de pago ——
  const saveEdit = () => {
    setTickets(t => t.map(x => x.id === editingId ? { ...x, paymentMethod: editMethod } : x));
    setEditingId(null);
  };

  // —— 14) Canjear puntos ——
  const handleRedeemPoints = () => {
    if (clientPoints < 100) return;
    // Restar 100 puntos y activar descuento
    const rawClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    const updatedClients = rawClients.map(c => {
      if (c.name === selectedClient) {
        return {
          ...c,
          points: (c.points || 0) - 100
        };
      }
      return c;
    });
    localStorage.setItem(`dive_manager_clients_${center}`, JSON.stringify(updatedClients));
    setClientPoints(prev => prev - 100);
    setRedeemedPoints(true);
  };

  // —— 15) Imprimir ticket (PDF + QR) ——
  // Uso una ventana emergente que carga QRCodeJS desde CDN
  const printTicket = ticket => {
    const w = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Ticket #${ticket.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            .total { text-align: right; font-weight: bold; margin-top: 10px; }
            .qr { text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>Ticket #${ticket.id}</h2>
          <p><strong>Fecha:</strong> ${new Date(ticket.date).toLocaleString()}</p>
          <p><strong>Cajero:</strong> ${ticket.cashier}</p>
          <p><strong>Cliente:</strong> ${ticket.client || '---'}</p>
          <p><strong>Forma de pago:</strong> ${ticket.paymentMethod}</p>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant</th>
                <th>Precio u.</th>
                <th>Descuento %</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${ticket.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.qty}</td>
                  <td>${item.customPrice.toFixed(2)}</td>
                  <td>${item.discountPct || 0}%</td>
                  <td>${(
                    (item.customPrice * item.qty) *
                    (1 - (item.discountPct || 0)/100)
                  ).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">Total: ${ticket.total.toFixed(2)}</p>
          <div class="qr">
            <p>Escanea para verificar tu ticket:</p>
            <div id="qrcode"></div>
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            // Generar QR con JSON mínimo
            new QRCode(document.getElementById("qrcode"), {
              text: JSON.stringify({ id: ${ticket.id}, date: "${ticket.date}", total: ${ticket.total.toFixed(2)} }),
              width: 128,
              height: 128
            });
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 300);
            };
          </script>
        </body>
      </html>
    `;
    w.document.write(html);
    w.document.close();
  };

  // —— 16) Devolución / nota de crédito ——
  const handleOpenReturn = ticket => {
    setSelectedReturnTicket(ticket);
    const initial = {};
    ticket.items.forEach(item => {
      initial[item.id] = 0; // Sin devolver por defecto
    });
    setReturnItems(initial);
    setViewReturns(true);
  };
  const handleProcessReturn = () => {
    if (!selectedReturnTicket) return;
    const linesToReturn = [];
    selectedReturnTicket.items.forEach(item => {
      const qtyToReturn = Number(returnItems[item.id] || 0);
      if (qtyToReturn > 0 && qtyToReturn <= item.qty) {
        linesToReturn.push({
          id: item.id,
          name: item.name,
          qty: qtyToReturn,
          amount: (item.customPrice * qtyToReturn)
        });
      }
    });
    if (!linesToReturn.length) {
      alert('Selecciona al menos 1 ítem para devolver.');
      return;
    }
    // Crear nota de crédito:
    const creditNote = {
      id: Date.now(),
      date: new Date().toISOString(),
      ticketId: selectedReturnTicket.id,
      items: linesToReturn
    };
    setReturnTickets(r => [...r, creditNote]);
    // Ajustar ticket original: restar qty, restar total
    const updatedTickets = tickets.map(t => {
      if (t.id === selectedReturnTicket.id) {
        const remainingItems = t.items.map(it => {
          const ret = linesToReturn.find(r => r.id === it.id);
          if (ret) {
            return { ...it, qty: it.qty - ret.qty };
          }
          return it;
        }).filter(it => it.qty > 0);
        const newTotal = remainingItems.reduce(
          (s, it) => s + (it.customPrice * it.qty) * (1 - (it.discountPct || 0)/100),
          0
        );
        return { ...t, items: remainingItems, total: newTotal };
      }
      return t;
    });
    setTickets(updatedTickets);
    setViewReturns(false);
    alert('Devolución procesada. Se generó nota de crédito.');
  };

  // —— 17) Exportar a CSV/ZIP para backup ——
  const handleExportAll = () => {
    const data = {
      clients,
      products,
      tickets,
      closures,
      returns: returnTickets,
      cashiers,
      methods: methodsList
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `backup_${center}_${new Date().toISOString().slice(0,10)}.json`);
  };

  // —— 18) Estadísticas para el resumen superior (ocultas) ——
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalToday = tickets
    .filter(t => t.date.slice(0, 10) === todayStr)
    .reduce((sum, t) => sum + (t.total || 0), 0);
  const efectivoToday = tickets
    .filter(t => t.date.slice(0, 10) === todayStr && t.paymentMethod === 'Efectivo')
    .reduce((sum, t) => sum + (t.total || 0), 0);
  const restoToday = totalToday - efectivoToday;

  const allTickets = [
    ...tickets,
    ...(closures.flatMap(c => c.tickets || []))
  ];
  const productCounter = {};
  allTickets.flatMap(t => t.items).forEach(item => {
    productCounter[item.name] = (productCounter[item.name] || 0) + item.qty;
  });
  const topProducts = Object.entries(productCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  function getMonthStr(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function getQuarterStr(date) {
    const d = new Date(date);
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  }
  const productSalesMonth = {};
  const productSalesQuarter = {};
  allTickets.forEach(t => {
    const m = getMonthStr(t.date);
    const q = getQuarterStr(t.date);
    productSalesMonth[m] = productSalesMonth[m] || {};
    productSalesQuarter[q] = productSalesQuarter[q] || {};
    t.items.forEach(item => {
      productSalesMonth[m][item.name] = (productSalesMonth[m][item.name] || 0) + item.qty;
      productSalesQuarter[q][item.name] = (productSalesQuarter[q][item.name] || 0) + item.qty;
    });
  });

  // —— VISTA “Tickets y Cierres / Devoluciones” ——
  if (viewTickets || viewReturns) {
    const sortedClosures = [...closures].sort((a, b) => new Date(b.date) - new Date(a.date));
    return (
      <div style={containerStyle}>
        <h2 style={titleStyle}>Tickets y Cierres — {center}</h2>
        <div style={{ textAlign: 'right', marginBottom: 18 }}>
          <button style={btnBlue} onClick={() => { setViewTickets(false); setViewReturns(false); }}>← Volver</button>
          {viewTickets && (
            <button style={{ ...btnBlue, background: '#28a745', marginLeft: 8 }} onClick={handleCloseBox}>
              Cerrar caja
            </button>
          )}
        </div>

        {viewTickets && (
          <>
            {/* Tickets abiertos */}
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Tickets abiertos</h3>
              {tickets.length === 0
                ? <p style={emptyMsgStyle}>No hay tickets.</p>
                : tickets.map(t => (
                  <div key={t.id} style={ticketCardStyle}>
                    <strong style={ticketIdStyle}>#{t.id}</strong>
                    <span style={ticketDateStyle}>{new Date(t.date).toLocaleString()}</span>
                    <br />
                    <span style={ticketLabelStyle}>Cajero:</span> {t.cashier} &nbsp;•&nbsp;
                    <span style={ticketLabelStyle}>Cliente:</span> {t.client || <em style={emptyMsgStyle}>—</em>}
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
                        <span style={ticketLabelStyle}>Forma de pago:</span>{' '}
                        <em style={ticketMethodStyle}>{t.paymentMethod}</em>
                        <button
                          onClick={() => { setEditingId(t.id); setEditMethod(t.paymentMethod); }}
                          style={editIconStyle}
                          title="Editar"
                        >✏️</button>
                      </div>
                    )}

                    <div style={ticketTotalStyle}>
                      Total: {t.total.toFixed(2)} {currency}
                      <button
                        onClick={() => printTicket(t)}
                        style={printBtnStyle}
                        title="Imprimir ticket"
                      >🖨️</button>
                      <button
                        onClick={() => handleOpenReturn(t)}
                        style={returnBtnStyle}
                        title="Devolver"
                      >↩️ Devolver</button>
                    </div>
                  </div>
                ))}
            </section>

            {/* Devoluciones */}
            {viewReturns && selectedReturnTicket && (
              <section style={sectionStyle}>
                <h3 style={sectionTitleStyle}>Devolver Ticket #{selectedReturnTicket.id}</h3>
                <p style={{ marginBottom: 8 }}>Selecciona cuántas unidades de cada ítem devolver:</p>
                <table style={simpleTableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Producto</th>
                      <th style={thStyle}>Cant comprada</th>
                      <th style={thStyle}>Devolver qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReturnTicket.items.map(item => (
                      <tr key={item.id}>
                        <td style={tdTicketStyle}>{item.name}</td>
                        <td style={tdTicketStyle}>{item.qty}</td>
                        <td style={tdTicketStyle}>
                          <input
                            type="number" min={0} max={item.qty}
                            value={returnItems[item.id] || 0}
                            onChange={e => setReturnItems(prev => ({
                              ...prev,
                              [item.id]: Math.min(item.qty, Math.max(0, Number(e.target.value)))
                            }))}
                            style={inputStyle}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button style={btnBlue} onClick={handleProcessReturn}>Procesar devolución</button>
              </section>
            )}

            {/* Histórico de cierres de caja */}
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Histórico de cierres de caja</h3>
              {sortedClosures.length === 0
                ? <p style={emptyMsgStyle}>No hay cierres.</p>
                : sortedClosures.map(c => (
                  <div key={c.id} style={closureCardStyle}>
                    <strong style={ticketIdStyle}>#{c.id}</strong>
                    <span style={ticketDateStyle}>{new Date(c.date).toLocaleString()}</span>
                    <br />
                    <span style={ticketLabelStyle}>Cajero:</span> {c.cashier}
                    <br />
                    <span style={ticketLabelStyle}>Tickets:</span> {c.ticketCount}
                    <br />
                    <span style={ticketLabelStyle}>Facturado:</span> {(c.totalBilled || 0).toFixed(2)} {currency}
                    <br />
                    <span style={ticketLabelStyle}>Efectivo:</span> {(c.totalCash || 0).toFixed(2)} {currency}
                    <span style={{ margin: '0 8px', color: '#aaa' }}>•</span>
                    <span style={ticketLabelStyle}>Otros:</span> {(c.totalOther || 0).toFixed(2)} {currency}
                    <br />
                    {/* Detalle de ventas por producto (oculto) */}
                    {c.tickets && (
                      <details style={{ marginTop: 7 }}>
                        <summary style={detailsSummaryStyle}>Ver ranking de productos en este cierre</summary>
                        <ul style={detailsListStyle}>
                          {(() => {
                            const prodRank = {};
                            (c.tickets || []).flatMap(t => t.items).forEach(item => {
                              prodRank[item.name] = (prodRank[item.name] || 0) + item.qty;
                            });
                            return Object.entries(prodRank).sort((a, b) => b[1] - a[1]).map(([name, qty]) =>
                              <li key={name}>{name}: {qty}</li>
                            );
                          })()}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
            </section>
          </>
        )}

        {/* Botón para exportar todo (JSON backup) */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button style={btnBlue} onClick={handleExportAll}>
            📦 Exportar Backup JSON
          </button>
        </div>
      </div>
    );
  }

  // —— VISTA “Formas de pago” ——
  if (viewMethods) {
    return (
      <div style={formContainerStyle}>
        <h2 style={titleStyle}>Formas de Pago — {center}</h2>
        <button onClick={()=>setViewMethods(false)} style={backBtnStyle}>← Volver</button>
        <form onSubmit={e=>{ e.preventDefault(); const m=newMethod.trim(); if(m&&!methodsList.includes(m)) setMethodsList(v=>[...v,m]); setNewMethod(''); }} style={{ margin:'20px 0' }}>
          <input
            value={newMethod}
            onChange={e=>setNewMethod(e.target.value)}
            placeholder="Nueva forma..."
            style={{ ...inputStyle, width: '70%' }}
          />
          <button type="submit" style={btnBlue}>Añadir</button>
        </form>
        <ul style={{ paddingLeft: 16 }}>
          {methodsList.map((m,i)=><li key={i} style={{ marginBottom:6, display:'flex', justifyContent:'space-between' }}>
            {m}
            <button onClick={()=>setMethodsList(v=>v.filter(x=>x!==m))} style={deleteBtnStyle} title="Eliminar forma">🗑️</button>
          </li>)}
          {!methodsList.length && <p style={emptyMsgStyle}>No hay formas.</p>}
        </ul>
      </div>
    );
  }

  // —— VISTA PRINCIPAL (TPV + Carrito con descuento y estadísticas) ——
  return (
    <div style={containerStyle}>
      <h2 style={titleStyle}>TPV — Caja (Centro: {center})</h2>

      {/* ----- Ocultar estas estadísticas: ----- */}
      {/*
      <div style={statsContainerStyle}>
        <div style={statsBox}>Facturado hoy<br/><strong>{totalToday.toFixed(2)}</strong></div>
        <div style={statsBox}>Efectivo hoy<br/><strong>{efectivoToday.toFixed(2)}</strong></div>
        <div style={statsBox}>Otros métodos<br/><strong>{restoToday.toFixed(2)}</strong></div>
        <div style={statsBox}>
          Top Productos
          <ul style={topListStyle}>
            {topProducts.map(([name, qty])=>(
              <li key={name}>{name} x{qty}</li>
            ))}
            {topProducts.length===0 && <li>—</li>}
          </ul>
        </div>
      </div>
      */}

      {/* Frase motivacional */}
      <div style={phraseStyle}>
        {frases[Math.floor(Math.random()*frases.length)]}
      </div>

      {/* ----- Ocultar estos links: ----- */}
      <div style={navStyle}>
        <Link href="/">← Panel</Link> |{' '}
        <Link href="/familias">Familias</Link> |{' '}
        <Link href="/productos">Productos</Link> |{' '}
        <button style={linkBtnStyle} onClick={() => setViewTickets(true)}>Ver tickets y devoluciones</button> |{' '}
        <button style={linkBtnStyle} onClick={() => setViewMethods(true)}>Formas de pago</button>
      </div>

      {/* Cajeros */}
      <div style={cashierContainerStyle}>
        <input
          type="text"
          placeholder="Nuevo cajero..."
          value={newCashier} onChange={e => setNewCashier(e.target.value)}
          style={{ ...inputStyle, width: '60%' }}
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
      <div style={mainContentStyle}>
        {/* Familias y productos */}
        <div style={familiesStyle}>
          <label style={labelStyle}>Familia</label><br />
          <select value={selectedFamily} onChange={e => setSelectedFamily(e.target.value)} style={inputStyle}>
            <option value="">— Todas —</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <ul style={productListStyle}>
            {products
              .filter(p => !selectedFamily || p.family === selectedFamily)
              .map(p => (
                <li key={p.id}
                  onClick={() => handleAddToCart(p)}
                  style={productItemStyle}
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
          {/* Producto manual compacto */}
          <div style={manualBoxStyle}>
            <h5 style={manualTitleStyle}>+ Producto manual</h5>
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
                style={manualAddBtnStyle}
                title="Añadir producto manual"
              >+</button>
            </div>
          </div>
        </div>

        {/* Carrito principal con descuento */}
        <div style={cartContainerStyle}>
          <label style={labelStyle}>Cliente</label><br />
          <input
            list="clients-dl"
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            style={{ ...inputStyle, width: '100%', marginBottom: 8 }}
          />
          <datalist id="clients-dl">
            {clientNames.map((c, i) => <option key={i} value={c} />)}
          </datalist>
          {/* Historial y puntos del cliente */}
          {selectedClient && (
            <div style={clientBoxStyle}>
              <p><strong>Historial de compras de {selectedClient}:</strong></p>
              {clientPurchases.length ? (
                <ul style={purchaseListStyle}>
                  {clientPurchases.map((p, i) => (
                    <li key={i} style={purchaseItemStyle}>
                      {new Date(p.date).toLocaleDateString()} – {p.product} – {p.amount.toFixed(2)} {currency}
                    </li>
                  ))}
                </ul>
              ) : <p style={emptyMsgStyle}>Sin compras previas.</p>}
              <p style={{ marginTop: 8 }}><strong>Puntos acumulados:</strong> {clientPoints}</p>
              {clientPoints >= 100 && !redeemedPoints && (
                <button
                  onClick={handleRedeemPoints}
                  style={btnBlue}
                  title="Canjear 100 puntos por 10% off"
                >
                  Canjear 100 puntos → 10% descuento
                </button>
              )}
              {redeemedPoints && <p style={infoMsgStyle}>Has canjeado 100 puntos. 10% aplicado.</p>}
            </div>
          )}
          <h3 style={cartTitleStyle}>Carrito</h3>
          <table style={cartTableStyle}>
            <thead>
              <tr style={cartHeaderStyle}>
                <th style={thStyle}>Producto</th>
                <th style={thStyle}>Cant</th>
                <th style={thStyle}>Precio u.</th>
                <th style={thStyle}>Descuento %</th>
                <th style={thStyle}>Subtotal</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.id} style={cartRowStyle}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>
                    <input
                      type="number" min={1}
                      value={item.qty}
                      onChange={e => handleQtyChange(item.id, +e.target.value)}
                      style={{
                        ...inputStyle, width: 34, padding: 4, fontSize: 14
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number" min={0} step="0.01"
                      value={item.customPrice}
                      onChange={e => handlePriceChange(item.id, +e.target.value)}
                      style={{
                        ...inputStyle, width: 60, padding: 4, fontSize: 14
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number" min={0} max={100}
                      value={item.discountPct || 0}
                      onChange={e => handleDiscountChange(item.id, +e.target.value)}
                      style={{
                        ...inputStyle, width: 50, padding: 4, fontSize: 14
                      }}
                      title="Descuento %"
                    />
                  </td>
                  <td style={tdStyle}>
                    <strong>
                      {((item.customPrice * item.qty) * (1 - (item.discountPct || 0)/100)).toFixed(2)}
                    </strong>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => handleRemove(item.id)} style={removeBtnStyle}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {redeemedPoints && (
            <p style={infoMsgStyle}>Descuento 10% aplicado: -{(discountFromPoints).toFixed(2)} {currency}</p>
          )}
          <div style={totalStyle}>
            <strong>
              Total: {total.toFixed(2)} {currency}
            </strong>
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

      {/* —— Informes mensuales y trimestrales (ocultos) —— */}
      <details style={reportDetailsStyle}>
        <summary style={detailsSummaryStyle}>📊 Ver Informes Mensuales y Trimestrales</summary>
        <div style={chartContainerStyle}>
          {/* Aquí podrías integrar tus gráficas con Recharts, Chart.js, etc. */}
          <p style={{ fontStyle: 'italic', color: '#666', textAlign: 'center' }}>Gráficas interactivas aquí…</p>
        </div>
      </details>

      {/* —— Botón exportar todos los datos (CSV) —— */}
      <div style={exportBoxStyle}>
        <button style={btnBlue} onClick={() => downloadCSV()}>
          📄 Exportar CSV completo de tickets
        </button>
        <button style={{ ...btnBlue, background: '#28a745', marginLeft: 12 }} onClick={handleExportAll}>
          📦 Exportar Backup JSON
        </button>
      </div>

      {/* —— Placeholder PWA offline —— */}
      <div style={pwaBoxStyle}>
        <p style={{ color: '#555', fontSize: 14 }}>⚙️ Modo offline habilitado cuando instales como PWA</p>
      </div>
    </div>
  );

  // —— Función para descargar CSV de tickets abiertos y cerrados ——
  function downloadCSV() {
    const headers = ['ID','Fecha','Cajero','Cliente','Método','Total'];
    const rows = tickets.map(t => [
      t.id,
      t.date,
      t.cashier,
      t.client,
      t.paymentMethod,
      t.total.toFixed(2)
    ]);
    const closedRows = closures.flatMap(c => c.tickets || []).map(t => [
      t.id,
      t.date,
      t.cashier,
      t.client,
      t.paymentMethod,
      t.total.toFixed(2)
    ]);
    const allRows = [headers, ...rows, ...closedRows];
    const csv = allRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `tickets_${center}_${new Date().toISOString().slice(0,10)}.csv`);
  }
}

// ——— Estilos ———
const containerStyle = {
  fontFamily: 'Arial, sans-serif',
  maxWidth: 1000,
  margin: '0 auto',
  background: '#fff',
  padding: 20,
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0,80,180,0.07)',
  border: '1px solid #e2e8f0'
};
const titleStyle = {
  textAlign: 'center',
  color: '#004085',
  fontWeight: 700,
  fontSize: 24,
  marginBottom: 12
};
// — Estadísticas ocultas —
// const statsContainerStyle = { … };
// const statsBox = { … };
// const topListStyle = { … };
const phraseStyle = {
  background: '#f0f8ff',
  color: '#0a5578',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 600,
  fontSize: 16,
  textAlign: 'center',
  marginBottom: 20
};
const navStyle = {
  textAlign: 'center',
  marginBottom: 18,
  fontSize: 15,
  color: '#004085'
};
const linkBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#004085',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 15,
  textDecoration: 'underline'
};
const cashierContainerStyle = {
  textAlign: 'center',
  marginBottom: 18
};
const mainContentStyle = {
  display: 'flex',
  gap: 30,
  alignItems: 'flex-start'
};
const familiesStyle = {
  flexBasis: 200,
  minWidth: 180
};
const productListStyle = {
  listStyle: 'none',
  padding: 0,
  maxHeight: 250,
  overflowY: 'auto',
  border: '1px solid #b6d4fe',
  borderRadius: 8,
  background: '#f4faff',
  marginTop: 8
};
const productItemStyle = {
  padding: '6px 10px',
  cursor: 'pointer',
  borderBottom: '1px solid #e3e8ef',
  color: '#111',
  transition: 'background 0.18s',
  fontSize: 15
};
const manualBoxStyle = {
  marginTop: 16,
  padding: 10,
  border: '1px dashed #b6d4fe',
  borderRadius: 8,
  background: '#e8f0fb'
};
const manualTitleStyle = {
  fontSize: 15,
  margin: '2px 0 9px 0',
  fontWeight: 600,
  color: '#004085'
};
const manualAddBtnStyle = {
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
};
const cartContainerStyle = {
  flex: 1,
  background: '#f7fbfe',
  border: '1.5px solid #0070f3',
  borderRadius: 18,
  boxShadow: '0 3px 18px rgba(0,60,200,0.06)',
  padding: 20,
  minWidth: 0
};
const clientBoxStyle = {
  marginBottom: 12,
  fontSize: 14,
  color: '#004085',
  background: '#eefbfd',
  padding: 10,
  borderRadius: 8
};
const purchaseListStyle = {
  maxHeight: 100,
  overflowY: 'auto',
  paddingLeft: 16,
  margin: 0
};
const purchaseItemStyle = {
  marginBottom: 4
};
const emptyMsgStyle = {
  fontStyle: 'italic',
  color: '#888',
  fontSize: 14
};
const infoMsgStyle = {
  color: '#0070f3',
  fontSize: 15,
  marginTop: 6
};
const cartTitleStyle = {
  color: '#0070f3',
  marginTop: 4,
  fontWeight: 700,
  marginBottom: 12,
  fontSize: 22,
  letterSpacing: 0.1
};
const cartTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: 13,
  fontSize: 15
};
const cartHeaderStyle = {
  background: '#ddeffe'
};
const cartRowStyle = {
  borderBottom: '1px solid #b3e0ff'
};
const tdStyle = {
  padding: 6
};
const totalStyle = {
  marginBottom: 15,
  fontSize: 19,
  color: '#004085'
};
const removeBtnStyle = {
  border: 'none',
  background: 'none',
  color: '#0070f3',
  fontWeight: 900,
  fontSize: 18,
  cursor: 'pointer'
};
const reportDetailsStyle = {
  marginTop: 24,
  border: '1px solid #b6d4fe',
  borderRadius: 8,
  background: '#f4faff',
  padding: 12
};
const detailsSummaryStyle = {
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
  color: '#0070f3'
};
const chartContainerStyle = {
  marginTop: 12,
  textAlign: 'center',
  padding: 10
};
const exportBoxStyle = {
  marginTop: 20,
  textAlign: 'center'
};
const pwaBoxStyle = {
  marginTop: 20,
  textAlign: 'center',
  fontSize: 14,
  color: '#555'
};

// —— “Tickets y Cierres” estilos ——
const sectionStyle = {
  marginBottom: 30,
  padding: 20,
  border: '1.5px solid #0070f3',
  borderRadius: 12,
  background: '#f7fbfe',
  boxShadow: '0 3px 18px rgba(0,60,200,0.04)'
};
const sectionTitleStyle = {
  color: '#0070f3',
  marginTop: 0,
  marginBottom: 16,
  fontSize: 18,
  fontWeight: 700
};
const ticketCardStyle = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 8,
  border: '1px solid #b6d4fe',
  background: '#f4faff'
};
const ticketIdStyle = {
  color: '#004085',
  fontSize: 15,
  fontWeight: 700
};
const ticketDateStyle = {
  float: 'right',
  color: '#0070f3',
  fontWeight: 500,
  fontSize: 14
};
const ticketLabelStyle = {
  color: '#004085',
  fontSize: 15
};
const ticketMethodStyle = {
  color: '#0099cc',
  fontWeight: 600
};
const editIconStyle = {
  marginLeft: 8,
  border: 'none',
  background: 'none',
  color: '#0070f3',
  fontSize: 16,
  cursor: 'pointer'
};
const ticketTotalStyle = {
  marginTop: 10,
  fontSize: 17,
  color: '#0070f3',
  fontWeight: 700
};
const printBtnStyle = {
  marginLeft: 10,
  background: '#28a745',
  border: 'none',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 5,
  fontSize: 14,
  cursor: 'pointer'
};
const returnBtnStyle = {
  marginLeft: 8,
  background: '#f5576c',
  border: 'none',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 5,
  fontSize: 14,
  cursor: 'pointer'
};
const simpleTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBottom: 12,
  fontSize: 15
};
const thStyle = {
  fontWeight: 700,
  color: '#003566',
  padding: 6,
  borderBottom: '1px solid #b6d4fe',
  fontSize: 15
};
// — Renombrado de td para “Tickets y Cierres”:
const tdTicketStyle = {
  padding: 6,
  borderBottom: '1px solid #b3e0ff'
};
const closureCardStyle = {
  marginBottom: 15,
  padding: 12,
  borderRadius: 7,
  border: '1px solid #b6d4fe',
  background: '#f7fbfe'
};
const detailsListStyle = {
  marginLeft: 16,
  padding: 0
};
const deleteBtnStyle = {
  marginLeft: 8,
  color: 'red',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16
};
const backBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#004085',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 15,
  textDecoration: 'underline',
  marginBottom: 12
};
const formContainerStyle = {
  padding: 20,
  fontFamily: 'sans-serif',
  maxWidth: 400,
  margin: '0 auto'
};

// —— Añadidos: btnBlue, inputStyle y labelStyle ——
const btnBlue = {
  padding: '7px 15px',
  background: '#0070f3',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 15,
  letterSpacing: 0.2,
  transition: 'background 0.2s'
};
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
const labelStyle = {
  fontWeight: 600,
  fontSize: 15,
  color: '#004085'
};
