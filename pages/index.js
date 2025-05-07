// pages/index.js 
import { useState, useEffect } from 'react';
import { useRouter }      from 'next/router';
import Link               from 'next/link';
import { parseISO, isSameDay, addDays } from 'date-fns';

export default function Dashboard() {
  const router = useRouter();

  // 1) Centro activo: undefined = comprobando, null = redirigiendo, string = id
  const [center, setCenter] = useState(undefined);

  // 2) Datos dinámicos
  const [reservations, setReservations] = useState([]);
  const [clients,      setClients]      = useState([]);
  const [events,       setEvents]       = useState([]);

  // ---- Leer centro activo y redirigir si no hay ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = localStorage.getItem('active_center');
    if (!c) {
      router.replace('/login');
      setCenter(null);
    } else {
      setCenter(c);
    }
  }, [router]);

  // ---- Función que carga TODO desde localStorage según centro ----
  const loadAll = () => {
    const RES_KEY = `dive_manager_reservations_${center}`;
    const CLI_KEY = `dive_manager_clients_${center}`;
    const EVT_KEY = `dive_manager_events_${center}`;

    const rs = JSON.parse(localStorage.getItem(RES_KEY)  || '[]');
    const cs = JSON.parse(localStorage.getItem(CLI_KEY)  || '[]');
    const ev = JSON.parse(localStorage.getItem(EVT_KEY) || '[]');

    setReservations(rs);
    setClients(cs);
    setEvents(ev.map(e => ({ ...e, start: new Date(e.start) })));
  };

  // ---- Carga inicial tras saber el centro ----
  useEffect(() => {
    if (!center) return;
    loadAll();
  }, [center]);

  // ---- Recargar cuando volvemos al "/" (por Link o back) ----
  useEffect(() => {
    const onRouteChange = url => {
      if (url === '/') loadAll();
    };
    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [router.events, center]);

  // ---- Estados intermedios ----
  if (center === undefined) {
    return <p style={{ padding:20, fontFamily:'sans-serif' }}>Cargando…</p>;
  }
  if (center === null) {
    return null; // ya redirigió a /login
  }

  // ---- Cambiar de centro ----
  const handleChange = () => {
    localStorage.removeItem('active_center');
    router.push('/login');
  };

  // ---- Métricas ----
  const calcRemaining = r => {
    const tot  = Number(r.totalAmount)   || 0;
    const dep  = Number(r.depositAmount) || 0;
    const paid = (r.payments||[]).reduce((s,p)=>s + (Number(p.amount)||0), 0);
    return tot - dep - paid;
  };
  const totalRes = reservations.length;
  const openRes  = reservations.filter(r => calcRemaining(r) > 0).length;
  const totalCli = clients.length;

  const today   = new Date();
  const evToday = events.filter(ev => isSameDay(ev.start, today));
  const evTmrw  = events.filter(ev => isSameDay(ev.start, addDays(today,1)));

  // ---- Render ----
  return (
    <div style={{ padding:20, fontFamily:'sans-serif' }}>
      <h1>Gestión Centro Buceo España — {center}</h1>

      <button
        onClick={handleChange}
        style={{
          marginBottom:'1rem',
          padding:'6px 12px',
          background:'#dc3545',
          color:'white',
          border:'none',
          borderRadius:4,
          cursor:'pointer'
        }}
      >
        Cambiar Centro
      </button>

      <nav style={{ marginBottom:20 }}>
        <Link href="/agenda" style={navLink}>Agenda</Link> |{' '}
        <Link href="/crm"    style={navLink}>CRM</Link> |{' '}
        <Link href="/caja"   style={navLink}>Caja</Link> |{' '}
        <Link href="/reservas" style={navLink}>Reservas</Link> |{' '}
        <Link href="/staff"  style={navLink}>Staff</Link>
      </nav>

      <div style={{ display:'flex', gap:16, marginBottom:32 }}>
        <Metric label="Reservas abiertas" value={openRes} />
        <Metric label="Total reservas"    value={totalRes} />
        <Metric label="Clientes CRM"      value={totalCli} />
        <Metric label="Eventos hoy"       value={evToday.length} />
        <Metric label="Eventos mañana"    value={evTmrw.length} />
      </div>

      <Section title="Eventos de Hoy"    items={evToday} />
      <Section title="Eventos de Mañana" items={evTmrw} />
    </div>
  );
}

// —— Componentes auxiliares ——
function Metric({ label, value }) {
  return (
    <div style={{
      flex:1,
      background:'#222',
      color:'white',
      padding:16,
      borderRadius:8,
      textAlign:'center'
    }}>
      <small style={{ opacity:0.8 }}>{label}</small>
      <div style={{ fontSize:24, marginTop:4 }}>{value}</div>
    </div>
  );
}
function Section({ title, items }) {
  return (
    <div style={{ marginBottom:24 }}>
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p>No hay eventos.</p>
      ) : (
        <ul style={{ paddingLeft:16 }}>
          {items.map(ev => (
            <li key={ev.id}>
              <strong>{ev.title}</strong> — {ev.start.toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
const navLink = {
  color:'#0070f3',
  textDecoration:'none',
  fontWeight:500
};