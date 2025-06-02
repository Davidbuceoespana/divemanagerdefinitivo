import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const STORAGE_KEY_RES     = 'dive_manager_reservations';
const STORAGE_KEY_CLIENTS = 'dive_manager_clients';
const STATUS = ['Confirmada', 'Pendiente', 'Cancelada'];
const METHODS = ['Enlace de pago','Efectivo','Clip','Transferencia','Bizum'];

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString();
}
function getColor(status) {
  if (status === 'Confirmada') return '#17bf6e';
  if (status === 'Pendiente') return '#ffcc00';
  if (status === 'Cancelada') return '#f5576c';
  return '#ddd';
}
function getStateIcon(status) {
  if (status === 'Confirmada') return '✅';
  if (status === 'Pendiente') return '⌛';
  if (status === 'Cancelada') return '❌';
  return '🔘';
}
function getDaysOfWeek(startDate) {
  const days = [];
  const start = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function Reservations() {
  // ─── 1) Definición de hooks (¡todos al inicio!) ───────────────────────────────
  const [center, setCenter]         = useState(undefined);
  const [mounted, setMounted]       = useState(false);

  const [reservations, setReservations]   = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [showForm, setShowForm]           = useState(false);
  const [editItem, setEditItem]           = useState(null);
  const [tab, setTab]                     = useState('details');
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [dateFilter, setDateFilter]       = useState('');
  const [showCalendar, setShowCalendar]   = useState(false);
  const [csvData, setCsvData]             = useState('');

  // Frase aleatoria y todayStr los setearemos en un useEffect para evitar mismatch
  const [fraseRandom, setFraseRandom] = useState('');
  const [todayStr, setTodayStr]       = useState('');

  const [form, setForm] = useState({
    id: null,
    client: '',
    activity: '',
    date: '',
    status: STATUS[1],
    totalAmount: '',
    depositAmount: '',
    depositMethod: METHODS[0],
    depositDate: '',
    payments: [],
    payDate: '',
    payMethod: METHODS[0],
    payAmount: '',
    note: ''
  });

  const [weekStart, setWeekStart] = useState('');

  // ─── 2) useEffect: Montar, leer 'active_center' y asignar 'mounted' ─────────
  useEffect(() => {
    setMounted(true);
    // Solo en cliente
    if (typeof window !== "undefined") {
      const c = localStorage.getItem('active_center') || "";
      setCenter(c);
    }
    // Establecemos la 'fecha de hoy' en cliente
    const ahora = new Date().toISOString().slice(0, 10);
    setTodayStr(ahora);
    setWeekStart(ahora);

    // Generar la frase aleatoria solo en cliente
    const frases = [
      "Aquí las reservas no se pierden, ¡se convierten en buceos épicos!",
      "Si alguien cancela, que te invite a una caña 🍻",
      "Más reservas, más locuras bajo el agua 🌊",
      "Hoy es día de pleno… ¡A llenar el centro de buzos!"
    ];
    const idx = Math.floor(Math.random() * frases.length);
    setFraseRandom(frases[idx]);
  }, []);

  // ─── 3) Claves dinámicas según centro  ────────────────────────────────────────
  const DYN_RES_KEY     = center ? `${STORAGE_KEY_RES}_${center}` : null;
  const DYN_CLIENTS_KEY = center ? `${STORAGE_KEY_CLIENTS}_${center}` : null;

  // ─── 4) Carga inicial de 'reservations' y 'clientOptions' cuando cambia 'center'
  useEffect(() => {
    if (!center) return;
    // Cargar reservas
    const st = localStorage.getItem(DYN_RES_KEY);
    if (st) {
      try {
        setReservations(JSON.parse(st));
      } catch { /* si no es JSON válido, ignoro */ }
    }
    // Cargar clientes
    const c = localStorage.getItem(DYN_CLIENTS_KEY);
    if (c) {
      try {
        const arr = JSON.parse(c);
        setClientOptions(arr.map(x => x.name).filter(Boolean));
      } catch { }
    }
  }, [center, DYN_RES_KEY, DYN_CLIENTS_KEY]);

  // ─── 5) Persistencia: guardar 'reservations' cuando cambian  ───────────────────
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(DYN_RES_KEY, JSON.stringify(reservations));
  }, [reservations, center, DYN_RES_KEY]);

  // ─── 6) Métricas y estadísticas ────────────────────────────────────────────────
  const total     = reservations.length;
  const upcoming  = useMemo(
    () => reservations.filter(r => r.date >= todayStr).length,
    [reservations, todayStr]
  );
  const confirmed = reservations.filter(r => r.status === 'Confirmada').length;
  const pending   = reservations.filter(r => r.status === 'Pendiente').length;
  const cancelled = reservations.filter(r => r.status === 'Cancelada').length;

  const ranking = useMemo(() => {
    const count = {};
    reservations.forEach(r => {
      if (!r.activity) return;
      count[r.activity] = (count[r.activity] || 0) + 1;
    });
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [reservations]);

  const clientRanking = useMemo(() => {
    const count = {};
    reservations.forEach(r => {
      if (!r.client) return;
      count[r.client] = (count[r.client] || 0) + 1;
    });
    return Object.entries(count).sort((a, b) => b[1] - a[1]);
  }, [reservations]);

  // ─── 7) Helpers pagos y calcular restante ─────────────────────────────────────
  const addPayment = () => {
    if (!form.payAmount) return;
    setForm(f => ({
      ...f,
      payments: [
        ...f.payments,
        { date: f.payDate, method: f.payMethod, amount: f.payAmount }
      ],
      payAmount: ''
    }));
  };
  const removePayment = i => {
    setForm(f => ({
      ...f,
      payments: f.payments.filter((_, j) => j !== i)
    }));
  };
  const calcRemaining = r => {
    const tot  = Number(r.totalAmount) || 0;
    const dep  = Number(r.depositAmount) || 0;
    const paid = (r.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return (tot - dep - paid).toFixed(2);
  };

  // ─── 8) Modal: crear o editar reserva ──────────────────────────────────────────
  const openNew = () => {
    setEditItem(null);
    setTab('details');
    setForm({
      id: null,
      client: '',
      activity: '',
      date: todayStr,
      status: STATUS[1],
      totalAmount: '',
      depositAmount: '',
      depositMethod: METHODS[0],
      depositDate: todayStr,
      payments: [],
      payDate: todayStr,
      payMethod: METHODS[0],
      payAmount: '',
      note: ''
    });
    setShowForm(true);
  };
  const openEdit = r => {
    setEditItem(r);
    setTab('details');
    setForm({
      ...r,
      totalAmount:   r.totalAmount   || '',
      depositAmount: r.depositAmount || '',
      depositMethod: r.depositMethod || METHODS[0],
      depositDate:   r.depositDate   || todayStr,
      payments:      r.payments      || [],
      payDate:       todayStr,
      payMethod:     METHODS[0],
      payAmount:     '',
      note:          r.note          || ''
    });
    setShowForm(true);
  };

  // ─── 9) Guardar o borrar reserva ───────────────────────────────────────────────
  const handleSubmit = e => {
    e.preventDefault();
    const payload = {
      ...form,
      totalAmount:   Number(form.totalAmount)   || 0,
      depositAmount: Number(form.depositAmount) || 0,
      payments: form.payments.map(p => ({
        ...p,
        amount: Number(p.amount) || 0
      }))
    };
    if (editItem) {
      setReservations(rs => rs.map(r => (r.id === form.id ? payload : r)));
    } else {
      setReservations(rs => [{ ...payload, id: Date.now() }, ...rs]);
    }
    setShowForm(false);
  };
  const handleDelete = id => {
    if (!confirm('¿Borrar esta reserva?')) return;
    setReservations(rs => rs.filter(r => r.id !== id));
  };

  // ─── 10) Acciones rápidas: WhatsApp, correo, llamada, cambiar estado ─────────
  const sendWhatsApp = name => {
    if (!name) return;
    window.open(
      `https://wa.me/?text=Hola%20${encodeURIComponent(name)}%2C%20te%20contactamos%20desde%20Buceo%20España%20para%20tu%20reserva%20😉`,
      '_blank'
    );
  };
  const sendMail = name => {
    window.open(
      `mailto:?subject=Reserva Buceo España&body=Hola ${name},%0ATu reserva está registrada.%0A¡Nos vemos bajo el agua!`,
      '_blank'
    );
  };
  const callClient = () =>
    alert('Pon el teléfono del cliente en el CRM para poder llamar directamente 😜');
  const quickStatus = (id, newStatus) => {
    setReservations(rs =>
      rs.map(r => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  // ─── 11) Filtros y búsqueda ───────────────────────────────────────────────────
  const filtered = reservations.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFilter && r.date !== dateFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.client && r.client.toLowerCase().includes(q)) ||
      (r.activity && r.activity.toLowerCase().includes(q)) ||
      (r.note && r.note.toLowerCase().includes(q))
    );
  });

  // ─── 12) Exportar a CSV ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const fields = ['Cliente', 'Actividad', 'Fecha', 'Estado', 'Total', 'Restante', 'Nota'];
    const rows = filtered.map(r => [
      r.client,
      r.activity,
      r.date,
      r.status,
      r.totalAmount,
      calcRemaining(r),
      (r.note || '').replace(/\n/g, ' ')
    ]);
    const csv = [fields, ...rows].map(x => x.join(',')).join('\n');
    setCsvData(csv);
    setTimeout(() => {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reservas.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  };

  // ─── 13) Calendario semanal ───────────────────────────────────────────────────
  const weekDays = getDaysOfWeek(weekStart);
  const weekReservations = reservations.filter(r => weekDays.includes(r.date));

  // ─── 14) Returns tempranos (¡después de declarar todos los hooks!)  ───────────
  if (!mounted) return <p>Cargando datos del centro...</p>;
  if (!center) return <p>Debes seleccionar un centro activo.</p>;

  // ─── 15) Renderizado final ────────────────────────────────────────────────────
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', position: 'relative' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 6 }}>
        Reservas — Centro: {center}
      </h2>
      <p
        style={{
          textAlign: 'center',
          color: '#0070f3',
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 18
        }}
      >
        {fraseRandom}
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: 16,
          color: '#0070f3',
          textDecoration: 'none'
        }}
      >
        ← Volver al panel principal
      </Link>

      {/* RESUMEN TOP */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          marginBottom: 15,
          flexWrap: 'wrap'
        }}
      >
        <BoxResumen color="#17bf6e" label="Confirmadas" icon="✅" value={confirmed} />
        <BoxResumen color="#ffcc00" label="Pendientes" icon="⌛" value={pending} />
        <BoxResumen color="#f5576c" label="Canceladas" icon="❌" value={cancelled} />
        <BoxResumen color="#0070f3" label="Totales" icon="📒" value={total} />
        <BoxResumen color="#003566" label="Próximas" icon="🔜" value={upcoming} />
      </div>

      {/* BARRA DE BÚSQUEDA y FILTROS */}
      <div style={{ margin: '12px 0', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar cliente, actividad o nota"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #b6d4fe', minWidth: 190 }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #b6d4fe' }}
        >
          <option value="all">Todos los estados</option>
          {STATUS.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #b6d4fe' }}
        />
        <button onClick={exportCSV} style={btnSmall}>
          Exportar CSV
        </button>
        <button onClick={() => setShowCalendar(v => !v)} style={btnSmall}>
          {showCalendar ? 'Ver tabla' : 'Vista Calendario'}
        </button>
        <button onClick={openNew} style={btnAdd}>
          + Reserva
        </button>
      </div>

      {/* RANKING Y ESTADÍSTICAS */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div
          style={{
            background: '#f7fbfe',
            padding: 12,
            borderRadius: 10,
            minWidth: 170
          }}
        >
          <b style={{ color: '#003566' }}>Top Actividades</b>
          <ul style={{ marginTop: 7, marginBottom: 0, paddingLeft: 18 }}>
            {ranking.slice(0, 4).map(([a, c]) => (
              <li key={a}>
                {a} <span style={{ color: '#17bf6e' }}>({c})</span>
              </li>
            ))}
            {!ranking.length && <li>No hay datos</li>}
          </ul>
        </div>
        <div
          style={{
            background: '#f7fbfe',
            padding: 12,
            borderRadius: 10,
            minWidth: 170
          }}
        >
          <b style={{ color: '#003566' }}>Top Clientes</b>
          <ul style={{ marginTop: 7, marginBottom: 0, paddingLeft: 18 }}>
            {clientRanking.slice(0, 4).map(([a, c]) => (
              <li key={a}>
                {a} <span style={{ color: '#17bf6e' }}>({c})</span>
              </li>
            ))}
            {!clientRanking.length && <li>No hay datos</li>}
          </ul>
        </div>
      </div>

      {/* CALENDARIO SEMANAL */}
      {showCalendar && (
        <div
          style={{
            margin: '24px 0',
            background: '#e8f4fd',
            borderRadius: 10,
            padding: 18
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14
            }}
          >
            <button
              style={btnSmall}
              onClick={() =>
                setWeekStart(
                  new Date(
                    new Date(weekStart).setDate(new Date(weekStart).getDate() - 7)
                  )
                    .toISOString()
                    .slice(0, 10)
                )
              }
            >
              ⏮️ Semana anterior
            </button>
            <b style={{ fontSize: 17, color: '#0070f3' }}>
              Semana de {formatDate(weekStart)}
            </b>
            <button
              style={btnSmall}
              onClick={() =>
                setWeekStart(
                  new Date(
                    new Date(weekStart).setDate(new Date(weekStart).getDate() + 7)
                  )
                    .toISOString()
                    .slice(0, 10)
                )
              }
            >
              ⏭️ Siguiente semana
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {weekDays.map(d => (
              <div
                key={d}
                style={{
                  flex: 1,
                  background: '#fff',
                  borderRadius: 8,
                  minHeight: 90,
                  padding: 8,
                  border: '1px solid #b6d4fe',
                  marginRight: 4
                }}
              >
                <div
                  style={{ fontWeight: 700, color: '#0070f3', fontSize: 15 }}
                >
                  {formatDate(d)}
                </div>
                <ul style={{ margin: 0, paddingLeft: 14 }}>
                  {weekReservations
                    .filter(r => r.date === d)
                    .map(r => (
                      <li key={r.id} style={{ margin: '6px 0', fontSize: 15 }}>
                        <span style={{ color: getColor(r.status) }}>
                          {getStateIcon(r.status)}
                        </span>{' '}
                        <b> {r.client}</b> — {r.activity}
                        <span style={{ fontSize: 12, color: '#888' }}>
                          {' '}
                          ({r.status})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLA DE RESERVAS */}
      {!showCalendar && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: 20
          }}
        >
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Cliente</th>
              <th style={th}>Actividad</th>
              <th style={th}>Fecha</th>
              <th style={th}>Total</th>
              <th style={th}>Pagado</th>
              <th style={th}>Restante</th>
              <th style={th}>Estado</th>
              <th style={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const rem = calcRemaining(r);
              const pagado = (
                (Number(r.totalAmount) || 0) -
                Number(rem)
              ).toFixed(2);
              const percentPaid = Math.max(
                0,
                Math.min(
                  100,
                  ((pagado / (Number(r.totalAmount) || 1)) * 100)
                )
              );
              return (
                <tr
                  key={r.id}
                  style={{ background: i % 2 ? '#f7fbfe' : '#fff' }}
                >
                  <td style={td}>{i + 1}</td>
                  <td style={td}>
                    {r.client}
                    <button
                      onClick={() => sendWhatsApp(r.client)}
                      title="WhatsApp"
                      style={btnIcon}
                    >
                      🟢
                    </button>
                    <button
                      onClick={() => sendMail(r.client)}
                      title="Email"
                      style={btnIcon}
                    >
                      ✉️
                    </button>
                    <button onClick={callClient} title="Llamar" style={btnIcon}>
                      📞
                    </button>
                  </td>
                  <td style={td}>{r.activity}</td>
                  <td style={td}>{r.date}</td>
                  <td style={td}>{Number(r.totalAmount).toFixed(2)} €</td>
                  <td style={td}>
                    <span style={{ color: '#17bf6e' }}>{pagado} €</span>
                    <div
                      style={{
                        width: '70px',
                        height: '8px',
                        background: '#eee',
                        borderRadius: 3,
                        marginTop: 2
                      }}
                    >
                      <div
                        style={{
                          width: percentPaid + '%',
                          height: '100%',
                          background: '#17bf6e',
                          borderRadius: 3,
                          transition: 'width 0.2s'
                        }}
                      />
                    </div>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        color: rem <= 0 ? '#17bf6e' : '#f5576c',
                        fontWeight: 700
                      }}
                    >
                      {rem} €
                    </span>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        background: getColor(r.status),
                        color: '#fff',
                        padding: '2px 9px',
                        borderRadius: 4,
                        fontSize: 14
                      }}
                    >
                      {r.status}
                    </span>
                    <select
                      value={r.status}
                      onChange={e => quickStatus(r.id, e.target.value)}
                      style={{ marginLeft: 7, padding: '1px 3px', borderRadius: 3 }}
                    >
                      {STATUS.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <button onClick={() => openEdit(r)} style={btn}>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ ...btn, background: '#f5576c' }}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* MODAL FORMULARIO */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200
          }}
        >
          <div style={{ background: 'white', padding: 22, borderRadius: 8, width: 400 }}>
            <h3>{editItem ? 'Editar Reserva' : 'Crear Reserva'}</h3>
            {/* Pestañas */}
            <div style={{ display: 'flex', marginBottom: 12 }}>
              {['details', 'payments', 'summary'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: 8,
                    cursor: 'pointer',
                    background: tab === t ? '#0070f3' : '#f0f0f0',
                    color: tab === t ? 'white' : 'black',
                    border: 'none',
                    borderRadius: tab === t ? '6px 6px 0 0' : '6px'
                  }}
                >
                  {t === 'details'
                    ? 'Detalles'
                    : t === 'payments'
                    ? 'Pagos recibidos'
                    : 'Resumen & Nota'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit}>
              {/* Detalles */}
              {tab === 'details' && (
                <>
                  <label>Cliente</label>
                  <br />
                  <input
                    list="clients-dl"
                    required
                    style={inp}
                    value={form.client}
                    onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  />
                  <datalist id="clients-dl">
                    {clientOptions.map((c, i) => (
                      <option key={i} value={c} />
                    ))}
                  </datalist>
                  <br />

                  <label>Actividad</label>
                  <br />
                  <input
                    required
                    style={inp}
                    value={form.activity}
                    onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
                  />
                  <br />

                  <label>Fecha</label>
                  <br />
                  <input
                    type="date"
                    required
                    style={inp}
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                  <br />

                  <label>Total</label>
                  <br />
                  <input
                    type="number"
                    required
                    style={inp}
                    value={form.totalAmount}
                    onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  />
                  <br />

                  <label>Depósito inicial</label>
                  <br />
                  <input
                    type="number"
                    style={{ ...inp, width: 'calc(50% - 4px)' }}
                    placeholder="Cantidad"
                    value={form.depositAmount}
                    onChange={e =>
                      setForm(f => ({ ...f, depositAmount: e.target.value }))
                    }
                  />
                  <select
                    style={{ ...inp, width: 'calc(50% - 4px)', marginLeft: 8 }}
                    value={form.depositMethod}
                    onChange={e =>
                      setForm(f => ({ ...f, depositMethod: e.target.value }))
                    }
                  >
                    {METHODS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <br />
                  <input
                    type="date"
                    style={inp}
                    value={form.depositDate}
                    onChange={e =>
                      setForm(f => ({ ...f, depositDate: e.target.value }))
                    }
                  />
                  <br />
                </>
              )}

              {/* Pagos recibidos */}
              {tab === 'payments' && (
                <>
                  <label>Agregar pago</label>
                  <br />
                  <input
                    type="date"
                    style={{ ...inp, width: '30%' }}
                    value={form.payDate}
                    onChange={e => setForm(f => ({ ...f, payDate: e.target.value }))}
                  />
                  <select
                    style={{ ...inp, width: '30%', margin: '0 4px' }}
                    value={form.payMethod}
                    onChange={e => setForm(f => ({ ...f, payMethod: e.target.value }))}
                  >
                    {METHODS.map(m => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Cantidad"
                    style={{ ...inp, width: '30%', marginLeft: 4 }}
                    value={form.payAmount}
                    onChange={e =>
                      setForm(f => ({ ...f, payAmount: e.target.value }))
                    }
                  />
                  <br />
                  <button type="button" onClick={addPayment} style={btn}>
                    Añadir pago
                  </button>
                  <ul style={{ marginTop: 12 }}>
                    {form.payments.map((p, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {p.date} — {p.method} — {p.amount} €
                        <button
                          onClick={() => removePayment(i)}
                          style={{
                            marginLeft: 8,
                            color: 'red',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Resumen & Nota */}
              {tab === 'summary' && (
                <>
                  <p>
                    <strong>Restante a pagar:</strong> {calcRemaining(form)} €
                  </p>
                  <label>Nota</label>
                  <br />
                  <textarea
                    style={{ ...inp, height: 80 }}
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  />
                </>
              )}

              <div style={{ marginTop: 12 }}>
                <button type="submit" style={btn}>
                  {editItem ? 'Guardar' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ ...btn, marginLeft: 8, background: '#888' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente BoxResumen ─────────────────────────────────────────────────────
function BoxResumen({ color, label, value, icon }) {
  return (
    <div
      style={{
        flex: '1 1 110px',
        background: color,
        color: '#fff',
        padding: 16,
        borderRadius: 12,
        textAlign: 'center',
        minWidth: 110,
        fontWeight: 700,
        fontSize: 18,
        boxShadow: '0 1px 5px #0002'
      }}
    >
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontSize: 20, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 14, opacity: 0.92 }}>{label}</div>
    </div>
  );
}

// ─── Estilos en línea ──────────────────────────────────────────────────────────
const th = {
  border: '1px solid #ccc',
  padding: 8,
  background: '#f4f4f4'
};
const td = {
  border: '1px solid #ccc',
  padding: 8,
  fontSize: 15
};
const btn = {
  padding: '4px 8px',
  marginTop: 2,
  background: '#0070f3',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600
};
const btnSmall = {
  ...btn,
  fontSize: 14,
  padding: '4px 10px',
  marginTop: 0,
  background: '#003566'
};
const btnAdd = {
  ...btn,
  background: '#17bf6e',
  fontSize: 16,
  padding: '7px 16px',
  marginLeft: 8
};
const btnIcon = {
  border: 'none',
  background: 'none',
  fontSize: 17,
  marginLeft: 4,
  cursor: 'pointer'
};
const inp = {
  width: '100%',
  padding: 7,
  marginBottom: 8,
  boxSizing: 'border-box',
  border: '1px solid #b6d4fe',
  borderRadius: 6,
  fontSize: 15
};
