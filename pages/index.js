import { useSession, signOut } from "next-auth/react"; 
import { useRouter } from "next/router";
import Link from "next/link";
import { useState, useEffect } from "react";
import { isSameDay, addDays } from "date-fns";

function Metric({ label, value }) {
  return (
    <div style={{
      flex: "1 1 150px",
      background: "#222",
      color: "#fff",
      padding: 16,
      borderRadius: 8,
      textAlign: "center",
      minWidth: 120
    }}>
      <small style={{ opacity: 0.8 }}>{label}</small>
      <div style={{ fontSize: 24, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ title, items }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2>{title}</h2>
      {items.length === 0
        ? <p>No hay eventos.</p>
        : <ul style={{ paddingLeft: 16 }}>
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

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Estados principales
  const [mounted, setMounted] = useState(false);
  const [center, setCenter] = useState(null);
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [upsellData, setUpsellData] = useState([]);

  // SOLO cuando está montado el cliente cargamos los datos del navegador
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCenter(localStorage.getItem('active_center'));
    }
  }, []);

  useEffect(() => {
    if (!mounted || !center) return;
    // Cargar datos de localStorage
    const loadedClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]");
    setClients(loadedClients);

    setSeguimientos(JSON.parse(localStorage.getItem(`dive_manager_seguimientos_${center}`) || "[]"));
    setVouchers(JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || "[]"));

    // Upsell
    const DEFAULT_TRIGGERS = [
      { baseCourse: "Open Water", minDays: 90, recommend: "Advanced", message: "¡Ofrécele el Advanced ya!" },
      { baseCourse: "Advanced", minDays: 120, recommend: "Rescue", message: "¡Es momento de hablarle del Rescue Diver!" }
    ];
    const triggers = JSON.parse(localStorage.getItem(`dive_manager_upsell_triggers_${center}`)) || DEFAULT_TRIGGERS;
    const hoy = new Date();
    let cursosRealizados = [];
    loadedClients.forEach(cliente => {
      if (Array.isArray(cliente.cursos)) {
        cliente.cursos.forEach(cur =>
          cursosRealizados.push({ name: cliente.name, curso: cur.curso, fecha: cur.fecha })
        );
      }
    });
    let oportunidades = [];
    cursosRealizados.forEach(item => {
      triggers.forEach(trig => {
        const fechaCurso = new Date(item.fecha);
        const diasPasados = Math.floor((hoy - fechaCurso) / (1000 * 60 * 60 * 24));
        if (item.curso && trig.baseCourse && item.curso.toLowerCase() === trig.baseCourse.toLowerCase() && diasPasados >= trig.minDays) {
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
  }, [mounted, center]);

  // Aquí el truco: NO renderices nada que dependa de localStorage hasta que esté montado y tengas center
  if (status === "loading") return <p>Cargando sesión…</p>;
  if (!session) {
    router.replace("/login");
    return null;
  }
  if (!mounted || !center) return <p>Cargando datos del centro...</p>;

  // --- Métricas y datos resumen ---
  const today = new Date();
  const evToday = events.filter(e => isSameDay(e.start, today));
  const evTmrw = events.filter(e => isSameDay(e.start, addDays(today, 1)));
  const totalCli = clients.length;
  const totalSeg = seguimientos.length;
  const openBonos = vouchers.reduce((sum, v) => sum + ((v.total || 0) - (v.used || 0)), 0);

  // --- Alarmas automáticas ---
  let lowTanks = 0;
  if (mounted && typeof window !== "undefined" && localStorage.getItem("dive_manager_tanks")) {
    lowTanks = JSON.parse(localStorage.getItem("dive_manager_tanks")).filter(t => t.state === "bajo").length;
  }
  const equiposSinRevision = clients.filter(c => c.equipStatus === "pendiente").length;
  const pagosPendientes = clients.filter(c => c.pagosPendientes && c.pagosPendientes > 0).length;

  // --- Bloque CRM Clientes destacados ---
  const clientesVIP = clients.filter(c => (c.tags || []).includes("VIP") || (c.tags || []).includes("viajero")).slice(0, 5);

  // --- Ranking de "vicio" ---
  const rankingVicio = clients
    .filter(c => c.diveCount)
    .sort((a, b) => Number(b.diveCount) - Number(a.diveCount))
    .slice(0, 5);

  // --- Recordatorios: clientes sin bucear 6+ meses ---
  const avisos = clients.filter(c => {
    const ultimoBuceo = c.cursos?.length ? new Date(c.cursos[c.cursos.length - 1].fecha) : null;
    return ultimoBuceo && ((today - ultimoBuceo) / (1000 * 60 * 60 * 24)) > 180;
  });

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Bienvenido, {session.user.email}</h1>
      <button onClick={() => signOut({ callbackUrl: "/login" })}>
        Cerrar Sesión
      </button>
      <nav style={{ marginTop: 20 }}>
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

      {/* --- Bloques de Métricas y Paneles Inteligentes --- */}
      <div style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        margin: "20px 0"
      }}>
        <Metric label="Eventos hoy" value={evToday.length} />
        <Metric label="Eventos mañana" value={evTmrw.length} />
        <Metric label="Total clientes" value={totalCli} />
        <Metric label="Total seguimientos" value={totalSeg} />
        <Metric label="Bonos abiertos" value={openBonos} />

        {/* --- Caja negra de oportunidades --- */}
        <div style={{
          flex: "1 1 300px",
          background: "#000",
          color: "#fff",
          padding: 16,
          borderRadius: 8,
          textAlign: "center",
          minWidth: 200,
          maxWidth: 320,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <small style={{ opacity: 0.8 }}>Oportunidades de venta</small>
          <div style={{ fontSize: 24, marginTop: 4, marginBottom: 8, color: "#ffe300", fontWeight: "bold" }}>
            {upsellData.length}
          </div>
          {upsellData.length === 0 ? (
            <div style={{ color: "#aaa", fontSize: 13 }}>Sin oportunidades ahora</div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 14, textAlign: "left" }}>
              {upsellData.slice(0, 6).map((o, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <b>{o.name}</b> &rarr; <span style={{ color: "#ffe300" }}>{o.recommend}</span>
                </li>
              ))}
              {upsellData.length > 6 &&
                <li style={{ color: "#ffe300" }}>+{upsellData.length - 6} más…</li>
              }
            </ul>
          )}
        </div>

        {/* --- Bloque CRM Clientes destacados --- */}
        <div style={{ flex: "1 1 300px", background: "#283593", color: "#fff", padding: 16, borderRadius: 8 }}>
          <b>Clientes VIP/Especiales</b>
          <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {clientesVIP.map((c, i) => (
              <li key={i}>
                <b>{c.name}</b>
                {c.tags && c.tags.length > 0 && (
                  <span style={{ fontSize: 11, color: "#ffe300", marginLeft: 4 }}>
                    {c.tags.join(", ")}
                  </span>
                )}
                {/* WhatsApp directo */}
                <a
                  href={`https://wa.me/34${c.phone?.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(c.name)},%20¡te%20escribimos%20desde%20Buceo%20España!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 6, color: "#25d366" }}
                  title="Enviar WhatsApp"
                >📲</a>
              </li>
            ))}
            <li>
              <a href="/crm" style={{ color: "#ffe300", fontSize: 13, textDecoration: "underline" }}>Ver todos</a>
            </li>
          </ul>
        </div>

        {/* --- Alarmas automáticas --- */}
        <div style={{ flex: "1 1 260px", background: "#d32f2f", color: "#fff", padding: 16, borderRadius: 8 }}>
          <b>🚨 Alarmas</b>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lowTanks > 0 && <li>Bajas botellas: <b>{lowTanks}</b></li>}
            {equiposSinRevision > 0 && <li>Equipos sin revisar: <b>{equiposSinRevision}</b></li>}
            {pagosPendientes > 0 && <li>Clientes con pagos pendientes: <b>{pagosPendientes}</b></li>}
            {(!lowTanks && !equiposSinRevision && !pagosPendientes) && <li>Todo ok 🤿</li>}
          </ul>
        </div>

        {/* --- Resumen del día --- */}
        <div style={{ flex: "1 1 260px", background: "#0277bd", color: "#fff", padding: 16, borderRadius: 8 }}>
          <b>Hoy</b>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li>Reservas: <b>{evToday.length}</b></li>
            <li>Cursos hoy: <b>{events.filter(e => isSameDay(e.start, today) && e.type === "curso").length}</b></li>
            <li>Instructores asignados: <b>{
              Array.from(new Set(events.filter(e => isSameDay(e.start, today)).map(e => e.instructor))).length
            }</b></li>
            <li>Material pendiente: <b>{clients.filter(c => c.equipStatus === "pendiente" && c.cursoHoy).length}</b></li>
            <li>
              Aniversarios:{" "}
              <b>
                {
                  clients.filter(c =>
                    c.cursos && c.cursos.some(cur => {
                      const fecha = new Date(cur.fecha);
                      return fecha.getDate() === today.getDate() && fecha.getMonth() === today.getMonth();
                    })
                  ).length
                }
              </b>
            </li>
          </ul>
        </div>

        {/* --- Ranking de "nivel de vicio" --- */}
        <div style={{ flex: "1 1 220px", background: "#4caf50", color: "#fff", padding: 16, borderRadius: 8 }}>
          <b>Top Vicio</b>
          <ol style={{ paddingLeft: 20 }}>
            {rankingVicio.map((c, i) => (
              <li key={i}>
                {c.name} <span style={{ fontSize: 12, color: "#ffe300" }}>({c.diveCount})</span>
              </li>
            ))}
          </ol>
          <small style={{ opacity: 0.7 }}>¡Gana una camiseta por 10+ inmersiones!</small>
        </div>

        {/* --- Recordatorio de seguimientos --- */}
        <div style={{ flex: "1 1 260px", background: "#fbc02d", color: "#333", padding: 16, borderRadius: 8 }}>
          <b>Recordatorios</b>
          <ul>
            {avisos.slice(0, 5).map((c, i) => (
              <li key={i}>
                {c.name} — <span style={{ color: "#d32f2f" }}>6+ meses sin bucear</span>
                <a
                  href={`https://wa.me/34${c.phone?.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(c.name)},%20te%20echamos%20de%20menos%20en%20Buceo%20España%20😉`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 6, color: "#25d366" }}
                  title="Enviar WhatsApp"
                >📲</a>
              </li>
            ))}
            {avisos.length === 0 && <li>Sin llamadas pendientes</li>}
          </ul>
        </div>
      </div>

      {/* --- Listados de eventos --- */}
      <Section title="Eventos de Hoy" items={evToday} />
      <Section title="Eventos de Mañana" items={evTmrw} />
    </div>
  );
}
