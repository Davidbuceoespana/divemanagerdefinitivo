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
  const [manualAlarms, setManualAlarms] = useState([]);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [newAlarmText, setNewAlarmText] = useState("");

  // SOLO cuando está montado el cliente cargamos los datos del navegador
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCenter(localStorage.getItem('active_center'));
    }
  }, []);

  // Cargar datos principales
  useEffect(() => {
    if (!mounted || !center) return;

    setClients(JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]"));
    setSeguimientos(JSON.parse(localStorage.getItem(`dive_manager_seguimientos_${center}`) || "[]"));
    setVouchers(JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || "[]"));
    setEvents(
      (JSON.parse(localStorage.getItem(`dive_manager_events_${center}`)) || []).map(e => ({
        ...e, start: new Date(e.start), end: new Date(e.end)
      }))
    );

    // Upsell/Oportunidades de venta
    const DEFAULT_TRIGGERS = [
      { baseCourse: "Open Water", minDays: 90, recommend: "Advanced", message: "¡Ofrécele el Advanced ya!" },
      { baseCourse: "Advanced", minDays: 120, recommend: "Rescue", message: "¡Es momento de hablarle del Rescue Diver!" }
    ];
    const triggers = JSON.parse(localStorage.getItem(`dive_manager_upsell_triggers_${center}`)) || DEFAULT_TRIGGERS;
    const loadedClients = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]");
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

    // Alarmas manuales
    setManualAlarms(JSON.parse(localStorage.getItem(`dive_manager_manual_alarms_${center}`) || "[]"));
  }, [mounted, center]);

  // Guardar alarmas manuales al cambiar
  useEffect(() => {
    if (center)
      localStorage.setItem(`dive_manager_manual_alarms_${center}`, JSON.stringify(manualAlarms));
  }, [manualAlarms, center]);

  // --- Resto de métricas y cálculos ---
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

  // --- Clientes destacados ---
  const clientesVIP = clients.filter(c => (c.tags || []).includes("VIP") || (c.tags || []).includes("viajero")).slice(0, 5);

  // --- AVISO de Oportunidades de Venta ---
  const hayOportunidades = upsellData.length > 0;

  // --- Funciones para Alarmas manuales ---
  function addManualAlarm() {
    if (!newAlarmText.trim()) return;
    setManualAlarms([...manualAlarms, { text: newAlarmText, created: new Date().toISOString(), done: false }]);
    setNewAlarmText("");
    setShowAlarmModal(false);
  }
  function markAlarmDone(idx) {
    setManualAlarms(manualAlarms.map((a, i) => i === idx ? { ...a, done: true } : a));
  }
  function removeAlarm(idx) {
    setManualAlarms(manualAlarms.filter((_, i) => i !== idx));
  }

  // --- Seguridad y sesión ---
  if (status === "loading") return <p>Cargando sesión…</p>;
  if (!session) {
    router.replace("/login");
    return null;
  }
  if (!mounted || !center) return <p>Cargando datos del centro...</p>;

  // --- RENDER ---
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

        {/* --- Oportunidades de Venta / Seguimiento --- */}
        <div style={{
          flex: "1 1 320px",
          background: "#40a9ff",
          color: "#fff",
          padding: 16,
          borderRadius: 8,
          textAlign: "center",
          minWidth: 220,
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative"
        }}>
          <small style={{ opacity: 0.85 }}>Seguimiento de Oportunidades de Venta</small>
          <div style={{ fontSize: 24, marginTop: 4, marginBottom: 8, color: hayOportunidades ? "#ffe300" : "#fff", fontWeight: "bold" }}>
            {hayOportunidades ? `¡${upsellData.length} oportunidad${upsellData.length > 1 ? "es" : ""}!` : "Sin oportunidades"}
          </div>
          {hayOportunidades && (
            <div style={{ color: "#ffe300", marginBottom: 8 }}>
              <b>¡Tienes clientes listos para upselling!</b>
            </div>
          )}
          <Link href="/oportunidades-venta">
            <button style={{
              background: "#ffe300",
              color: "#000",
              border: "none",
              borderRadius: 4,
              padding: "7px 18px",
              fontWeight: "bold",
              fontSize: 16,
              marginTop: 8,
              cursor: "pointer"
            }}>
              Ir a Oportunidades de Venta
            </button>
          </Link>
        </div>

        {/* --- CRM Clientes destacados --- */}
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

        {/* --- Alarmas automáticas + manuales (ahora en azul claro) --- */}
        <div style={{ flex: "1 1 260px", background: "#e3f2fd", color: "#003366", padding: 16, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b>🔔 Alarmas</b>
            <button
              style={{
                background: "#40a9ff",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "2px 9px",
                fontWeight: "bold",
                fontSize: 18,
                cursor: "pointer"
              }}
              onClick={() => setShowAlarmModal(true)}
              title="Añadir alarma manual"
            >＋</button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lowTanks > 0 && <li>Bajas botellas: <b>{lowTanks}</b></li>}
            {equiposSinRevision > 0 && <li>Equipos sin revisar: <b>{equiposSinRevision}</b></li>}
            {pagosPendientes > 0 && <li>Clientes con pagos pendientes: <b>{pagosPendientes}</b></li>}
            {manualAlarms.filter(a => !a.done).map((a, idx) => (
              <li key={idx} style={{ marginTop: 3 }}>
                <span>{a.text}</span>
                <button onClick={() => markAlarmDone(idx)}
                  style={{
                    marginLeft: 7,
                    background: "#40a9ff", color: "#fff", border: "none",
                    borderRadius: 4, padding: "2px 7px", fontSize: 12, cursor: "pointer"
                  }}>
                  Marcar resuelta
                </button>
                <button onClick={() => removeAlarm(idx)}
                  style={{
                    marginLeft: 3,
                    background: "#ff4c4c", color: "#fff", border: "none",
                    borderRadius: 4, padding: "2px 7px", fontSize: 12, cursor: "pointer"
                  }}>
                  🗑
                </button>
              </li>
            ))}
            {(!lowTanks && !equiposSinRevision && !pagosPendientes && manualAlarms.filter(a => !a.done).length === 0) &&
              <li>Todo ok 🤿</li>
            }
          </ul>
        </div>
      </div>

      {/* --- MODAL para alarmas manuales --- */}
      {showAlarmModal && (
        <div style={{
          position: "fixed", left: 0, top: 0, width: "100vw", height: "100vh",
          background: "rgba(0,0,0,0.2)", zIndex: 2000,
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: 30, minWidth: 340, boxShadow: "0 6px 32px #aaa"
          }}>
            <h2>Agregar alarma manual</h2>
            <input
              type="text"
              value={newAlarmText}
              onChange={e => setNewAlarmText(e.target.value)}
              placeholder="Describe tu alarma..."
              style={{ width: "100%", fontSize: 17, marginBottom: 14, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
              onKeyDown={e => { if (e.key === "Enter") addManualAlarm(); }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
              <button onClick={addManualAlarm}
                style={{
                  background: "#40a9ff", color: "#fff", border: "none",
                  borderRadius: 4, padding: "8px 18px", fontWeight: "bold", fontSize: 16
                }}>
                Añadir
              </button>
              <button onClick={() => setShowAlarmModal(false)}
                style={{
                  background: "#fff", color: "#555", border: "1px solid #ccc",
                  borderRadius: 4, padding: "8px 18px", fontSize: 16
                }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Listados de eventos --- */}
      <Section title="Eventos de Hoy" items={evToday} />
      <Section title="Eventos de Mañana" items={evTmrw} />
    </div>
  );
}
