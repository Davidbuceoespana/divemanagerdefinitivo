// pages/index.js 
import { useSession, signOut } from "next-auth/react";
import { useRouter }           from "next/router";
import Link                    from "next/link";
import { useState, useEffect } from "react";
import { isSameDay, addDays }  from "date-fns";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents]           = useState([]);
  const [clients, setClients]         = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [vouchers, setVouchers]       = useState([]);
  const [upsellData, setUpsellData]   = useState([]); // Oportunidades de venta

  // 1) Auth
  if (status === "loading") return <p>Cargando sesión…</p>;
  if (!session) {
    router.replace("/login");
    return null;
  }

  // 2) Carga datos desde localStorage
  useEffect(() => {
    const center = localStorage.getItem("active_center");
    if (!center) return;
    // agenda
    const ev = JSON.parse(
      localStorage.getItem(`dive_manager_events_${center}`) || "[]"
    ).map(e => ({ ...e, start: new Date(e.start) }));
    setEvents(ev);
    // crm
    const loadedClients = JSON.parse(
      localStorage.getItem(`dive_manager_clients_${center}`) || "[]"
    );
    setClients(loadedClients);
    // seguimientos
    setSeguimientos(JSON.parse(
      localStorage.getItem(`dive_manager_seguimientos_${center}`) || "[]"
    ));
    // bonos
    setVouchers(JSON.parse(
      localStorage.getItem(`dive_manager_vouchers_${center}`) || "[]"
    ));

    // --- Oportunidades de venta ---
    // Disparadores por defecto (puedes ampliar en el CRM)
    const DEFAULT_TRIGGERS = [
      {
        baseCourse: "Open Water",
        minDays: 90,
        recommend: "Advanced",
        message: "¡Ofrécele el Advanced ya!"
      },
      {
        baseCourse: "Advanced",
        minDays: 120,
        recommend: "Rescue",
        message: "¡Es momento de hablarle del Rescue Diver!"
      }
    ];
    const triggers = JSON.parse(localStorage.getItem(`dive_manager_upsell_triggers_${center}`)) || DEFAULT_TRIGGERS;
    const hoy = new Date();

    // Prepara lista de cursos realizados por cliente
    let cursosRealizados = [];
    loadedClients.forEach(cliente => {
      if (Array.isArray(cliente.cursos)) {
        cliente.cursos.forEach(cur =>
          cursosRealizados.push({ name: cliente.name, curso: cur.curso, fecha: cur.fecha })
        );
      }
    });

    // Busca oportunidades
    let oportunidades = [];
    cursosRealizados.forEach(item => {
      triggers.forEach(trig => {
        // Si ha hecho el curso base hace más de X días => oportunidad
        const fechaCurso = new Date(item.fecha);
        const diasPasados = Math.floor((hoy - fechaCurso) / (1000 * 60 * 60 * 24));
        if (
          item.curso &&
          trig.baseCourse &&
          item.curso.toLowerCase() === trig.baseCourse.toLowerCase() &&
          diasPasados >= trig.minDays
        ) {
          oportunidades.push({
            name: item.name,
            curso: item.curso,
            fecha: item.fecha,
            recommend: trig.recommend,
            dias: diasPasados,
            message: trig.message
          });
        }
      });
    });

    setUpsellData(oportunidades);
  }, []);

  // 3) Métricas
  const today    = new Date();
  const evToday  = events.filter(e => isSameDay(e.start, today));
  const evTmrw   = events.filter(e => isSameDay(e.start, addDays(today, 1)));
  const totalCli = clients.length;
  const totalSeg = seguimientos.length;
  const openBonos = vouchers
    .reduce((sum, v) => sum + ((v.total || 0) - (v.used || 0)), 0);

  return (
    <div style={{ padding:20, fontFamily:"sans-serif" }}>
      <h1>Bienvenido, {session.user.email}</h1>
      <button onClick={() => signOut({ callbackUrl:"/login" })}>
        Cerrar Sesión
      </button>
      <nav style={{ marginTop:20 }}>
        <Link href="/crm">Crm</Link> |{" "}
        <Link href="/agenda">Agenda</Link> |{" "}
        <Link href="/bonos">Bonos</Link> |{" "}
        <Link href="/caja">Caja</Link> |{" "}
        <Link href="/seguimiento">Seguimiento</Link> |{" "}
        <Link href="/gastos">Gastos</Link> |{" "}
        <Link href="/reservas">Reservas</Link> |{" "}
        <Link href="/oportunidades-venta">Oportunidades Venta</Link> |{" "}
        <Link href="/manager">Manager</Link> |{" "}
      </nav>

      {/* --- Métricas rápidas + Oportunidades --- */}
      <div style={{
        display: "flex", gap:16, flexWrap:"wrap", margin: "20px 0"
      }}>
        <Metric label="Eventos hoy"     value={evToday.length} />
        <Metric label="Eventos mañana"  value={evTmrw.length} />
        <Metric label="Total clientes"  value={totalCli} />
        <Metric label="Total seguimientos" value={totalSeg} />
        <Metric label="Bonos abiertos"  value={openBonos} />

        {/* --- Caja negra de oportunidades --- */}
        <div style={{
          flex:"1 1 300px",
          background:"#000",
          color:"#fff",
          padding:16,
          borderRadius:8,
          textAlign:"center",
          minWidth:200,
          maxWidth:320,
          display:"flex",
          flexDirection:"column",
          justifyContent:"center",
          alignItems:"center"
        }}>
          <small style={{ opacity:0.8 }}>Oportunidades de venta</small>
          <div style={{ fontSize:24, marginTop:4, marginBottom:8, color: "#ffe300", fontWeight:"bold" }}>
            {upsellData.length}
          </div>
          {upsellData.length === 0 ? (
            <div style={{ color:"#aaa", fontSize:13 }}>Sin oportunidades ahora</div>
          ) : (
            <ul style={{ listStyle:"none", margin:0, padding:0, fontSize:14, textAlign:"left" }}>
              {upsellData.slice(0,6).map((o, i) => (
                <li key={i} style={{ marginBottom:4 }}>
                  <b>{o.name}</b> &rarr; <span style={{color:"#ffe300"}}>{o.recommend}</span>
                </li>
              ))}
              {upsellData.length > 6 &&
                <li style={{color:"#ffe300"}}>+{upsellData.length - 6} más…</li>
              }
            </ul>
          )}
        </div>
      </div>

      {/* --- Listados de eventos --- */}
      <Section title="Eventos de Hoy"    items={evToday} />
      <Section title="Eventos de Mañana" items={evTmrw} />
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{
      flex:"1 1 150px",
      background:"#222",
      color:"#fff",
      padding:16,
      borderRadius:8,
      textAlign:"center",
      minWidth:120
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
      {items.length === 0
        ? <p>No hay eventos.</p>
        : <ul style={{ paddingLeft:16 }}>
            {items.map(ev => (
              <li key={ev.id || ev.start.toISOString()}>
                <strong>{ev.title || "–sin título–"}</strong>{" "}
                ({new Date(ev.start).toLocaleString()})
              </li>
            ))}
          </ul>
      }
    </div>
  );
}
