// pages/index.js
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useState, useEffect } from "react";
import { isSameDay, addDays } from "date-fns";

// Componente para cada métrica (tarjeta oscura)
function Metric({ label, value }) {
  return (
    <div style={{
      flex: "1 1 160px",
      background: "#222",
      color: "#fff",
      padding: 16,
      borderRadius: 8,
      textAlign: "center",
      minWidth: 140,
      margin: "8px"
    }}>
      <small style={{ opacity: 0.8 }}>{label}</small>
      <div style={{ fontSize: 28, marginTop: 6 }}>{value}</div>
    </div>
  );
}

// Componente para secciones de eventos
function Section({ title, items }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ marginBottom: 12, color: "#003566" }}>{title}</h2>
      {items.length === 0
        ? <p style={{ color: "#666" }}>No hay eventos.</p>
        : <ul style={{ paddingLeft: 16, color: "#333" }}>
            {items.map(ev => (
              <li key={ev.id || ev.start.toISOString()} style={{ marginBottom: 8 }}>
                <strong>{ev.title || "–sin título–"}</strong>{" "}
                <span style={{ fontSize: 13, color: "#555" }}>
                  ({new Date(ev.start).toLocaleString()})
                </span>
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

  // Carga de cliente y centro
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setCenter(localStorage.getItem('active_center'));
    }
  }, []);

  // Carga de datos principales cuando hay centro y ya montado
  useEffect(() => {
    if (!mounted || !center) return;

    // Clientes
    setClients(JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]"));
    // Seguimientos
    setSeguimientos(JSON.parse(localStorage.getItem(`dive_manager_seguimientos_${center}`) || "[]"));
    // Vouchers
    setVouchers(JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || "[]"));
    // Eventos (con conversión a Date)
    const rawEvents = JSON.parse(localStorage.getItem(`dive_manager_events_${center}`) || "[]");
    setEvents(rawEvents.map(e => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end)
    })));

    // Upsell/Oportunidades
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

    // Alarmas manuales
    setManualAlarms(JSON.parse(localStorage.getItem(`dive_manager_manual_alarms_${center}`) || "[]"));
  }, [mounted, center]);

  // Persistir alarmas manuales
  useEffect(() => {
    if (center) {
      localStorage.setItem(`dive_manager_manual_alarms_${center}`, JSON.stringify(manualAlarms));
    }
  }, [manualAlarms, center]);

  // Métricas de eventos
  const today = new Date();
  const evToday = events.filter(e => isSameDay(e.start, today));
  const evTmrw = events.filter(e => isSameDay(e.start, addDays(today, 1)));

  // Otras métricas
  const totalCli = clients.length;
  const totalSeg = seguimientos.length;
  const openBonos = vouchers.reduce((sum, v) => sum + ((v.total || 0) - (v.used || 0)), 0);

  // Alarmas automáticas
  let lowTanks = 0;
  if (mounted && typeof window !== "undefined" && localStorage.getItem(`dive_manager_tanks_${center}`)) {
    lowTanks = JSON.parse(localStorage.getItem(`dive_manager_tanks_${center}`)).filter(t => t.state === "bajo").length;
  }
  const equiposSinRevision = clients.filter(c => c.equipStatus === "pendiente").length;
  const pagosPendientes = clients.filter(c => c.pagosPendientes && c.pagosPendientes > 0).length;

  // Clientes destacados
  const clientesVIP = clients.filter(c =>
    [ "VIP", "viajero" ].some(tag => (c.tags || []).includes(tag))
  ).slice(0, 5);

  // Oportunidades de venta
  const hayOportunidades = upsellData.length > 0;

  // Funciones de alarmas manuales
  function addManualAlarm() {
    if (!newAlarmText.trim()) return;
    setManualAlarms([
      ...manualAlarms,
      { text: newAlarmText, created: new Date().toISOString(), done: false }
    ]);
    setNewAlarmText("");
    setShowAlarmModal(false);
  }
  function markAlarmDone(idx) {
    setManualAlarms(manualAlarms.map((a, i) => i === idx ? { ...a, done: true } : a));
  }
  function removeAlarm(idx) {
    setManualAlarms(manualAlarms.filter((_, i) => i !== idx));
  }

  // Autenticación
  if (status === "loading") return <p>Cargando sesión…</p>;
  if (!session) {
    router.replace("/login");
    return null;
  }
  if (!mounted || !center) return <p>Cargando datos del centro…</p>;

  return (
    <div style={styles.appContainer}>
      {/* === Barra lateral / Sidebar === */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={{ color: "#fff", margin: 0, fontSize: 20 }}>Buceo España</h2>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={styles.logoutBtn}
          >
            Cerrar Sesión
          </button>
        </div>
        <nav style={styles.navLinks}>
          <Link href="/crm"><a style={styles.navLink}>CRM</a></Link>
          <Link href="/reservas"><a style={styles.navLink}>Reservas</a></Link>
          <Link href="/agenda"><a style={styles.navLink}>Calendario</a></Link>
          <Link href="/caja"><a style={styles.navLink}>Ventas</a></Link>
          <Link href="/inventario"><a style={styles.navLink}>Inventario</a></Link>
          <Link href="/productos"><a style={styles.navLink}>Productos</a></Link>
          <Link href="/personal"><a style={styles.navLink}>Personal</a></Link>
          <Link href="/informes"><a style={styles.navLink}>Informes</a></Link>
        </nav>
      </aside>

      {/* === Área principal === */}
      <main style={styles.mainContent}>
        {/* ------ Encabezado ------ */}
        <header style={styles.header}>
          <h1 style={styles.welcome}>¡Hola, {session.user.email}!</h1>
          <p style={styles.subtitle}>Centro activo: <strong>{center}</strong></p>
        </header>

        {/* ------ Métricas generales ------ */}
        <section style={styles.metricsSection}>
          <Metric label="Eventos hoy" value={evToday.length} />
          <Metric label="Eventos mañana" value={evTmrw.length} />
          <Metric label="Total clientes" value={totalCli} />
          <Metric label="Seguimientos" value={totalSeg} />
          <Metric label="Bonos abiertos" value={openBonos} />
        </section>

        {/* ------ Vistas especiales: inventario, reservas y ventas ------ */}
        <section style={styles.overviewSection}>
          {/* Inventario (simulado con cifras de ejemplo) */}
          <div style={styles.widget}>
            <h2 style={styles.widgetTitle}>Inventario</h2>
            <p style={styles.widgetText}>Trajes disponibles: <strong>32</strong></p>
            <p style={styles.widgetText}>Aletas disponibles: <strong>48</strong></p>
            <p style={styles.widgetText}>Reguladores: <strong>15</strong></p>
          </div>

          {/* Próximas reservas */}
          <div style={styles.widget}>
            <h2 style={styles.widgetTitle}>Próximas Reservas</h2>
            <p style={styles.widgetText}>Inmersiones hoy: <strong>{evToday.length}</strong></p>
            <p style={styles.widgetText}>Inmersiones mañana: <strong>{evTmrw.length}</strong></p>
            <Link href="/reservas">
              <button style={styles.viewBtn}>Ver todas</button>
            </Link>
          </div>

          {/* Ventas del día (simulado) */}
          <div style={styles.widget}>
            <h2 style={styles.widgetTitle}>Ventas Hoy</h2>
            <p style={styles.widgetText}>Ingresos: <strong>€2,450</strong></p>
            <p style={styles.widgetText}>Tickets: <strong>23</strong></p>
            <p style={styles.widgetText}>Devoluciones: <strong>2</strong></p>
            <Link href="/caja">
              <button style={styles.viewBtn}>Ir a Caja</button>
            </Link>
          </div>
        </section>

        {/* ------ Gráfica de ventas (placeholder) ------ */}
        <section style={styles.chartSection}>
          <h2 style={styles.chartTitle}>Evolución de Ventas Mensual</h2>
          <div style={styles.chartPlaceholder}>
            {/* Aquí podrías integrar una librería de gráficas como Recharts o Chart.js */}
            <p style={{ color: "#777" }}>[Gráfica interactiva de ventas]</p>
          </div>
        </section>

        {/* ------ Acciones rápidas ------ */}
        <section style={styles.quickActionsSection}>
          <h2 style={styles.sectionTitle}>Acciones Rápidas</h2>
          <div style={styles.actionsGrid}>
            <Link href="/reservas">
              <button style={styles.actionBtn}>＋ Nueva Reserva</button>
            </Link>
            <Link href="/crm">
              <button style={styles.actionBtn}>＋ Añadir Cliente</button>
            </Link>
            <Link href="/caja">
              <button style={styles.actionBtn}>＋ Registrar Venta</button>
            </Link>
            <Link href="/productos">
              <button style={styles.actionBtn}>＋ Nuevo Producto</button>
            </Link>
            <button
              style={styles.actionBtn}
              onClick={() => setShowAlarmModal(true)}
            >
              🔔 Nueva Alarma
            </button>
            <Link href="/informes">
              <button style={styles.actionBtn}>📊 Generar Informe</button>
            </Link>
          </div>
        </section>

        {/* ------ Clientes destacados ------ */}
        <section style={styles.highlightSection}>
          <h2 style={styles.sectionTitle}>Clientes VIP/Especiales</h2>
          <ul style={styles.highlightList}>
            {clientesVIP.map((c, i) => (
              <li key={i} style={styles.highlightItem}>
                <span>{c.name}</span>
                {c.tags && c.tags.length > 0 && (
                  <span style={styles.tagBadge}>{c.tags.join(", ")}</span>
                )}
                <a
                  href={`https://wa.me/34${c.phone?.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(c.name)},%20¡te%20escribimos%20desde%20Buceo%20España!`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.whatsappLink}
                  title="Enviar WhatsApp"
                >📲</a>
              </li>
            ))}
            <li>
              <Link href="/crm">
                <a style={styles.viewMoreLink}>Ver todos</a>
              </Link>
            </li>
          </ul>
        </section>

        {/* ------ Alarmas automáticas y manuales ------ */}
        <section style={styles.alarmSection}>
          <div style={styles.alarmHeader}>
            <h2 style={styles.sectionTitle}>🔔 Alarmas</h2>
            <button
              style={styles.addAlarmBtn}
              onClick={() => setShowAlarmModal(true)}
              title="Añadir alarma manual"
            >＋</button>
          </div>
          <ul style={styles.alarmList}>
            {lowTanks > 0 && (
              <li style={styles.alarmItem}>Bajas botellas: <strong>{lowTanks}</strong></li>
            )}
            {equiposSinRevision > 0 && (
              <li style={styles.alarmItem}>Equipos sin revisar: <strong>{equiposSinRevision}</strong></li>
            )}
            {pagosPendientes > 0 && (
              <li style={styles.alarmItem}>Pagos pendientes: <strong>{pagosPendientes}</strong></li>
            )}
            {manualAlarms.filter(a => !a.done).map((a, idx) => (
              <li key={idx} style={styles.alarmItem}>
                <span>{a.text}</span>
                <button onClick={() => markAlarmDone(idx)} style={styles.alarmActionBtn}>
                  ✔️
                </button>
                <button onClick={() => removeAlarm(idx)} style={styles.alarmDeleteBtn}>
                  🗑️
                </button>
              </li>
            ))}
            {(!lowTanks && !equiposSinRevision && !pagosPendientes && manualAlarms.filter(a => !a.done).length === 0) && (
              <li style={styles.noAlarmText}>Todo ok 🤿</li>
            )}
          </ul>
        </section>

        {/* ------ Eventos de Hoy y Mañana ------ */}
        <Section title="Eventos de Hoy" items={evToday} />
        <Section title="Eventos de Mañana" items={evTmrw} />

        {/* ------ Modal para añadir alarma manual ------ */}
        {showAlarmModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalContent}>
              <h2 style={{ marginTop: 0, color: "#003566" }}>Agregar Alarma Manual</h2>
              <input
                type="text"
                value={newAlarmText}
                onChange={e => setNewAlarmText(e.target.value)}
                placeholder="Describe tu alarma..."
                style={styles.modalInput}
                onKeyDown={e => { if (e.key === "Enter") addManualAlarm(); }}
                autoFocus
              />
              <div style={styles.modalActions}>
                <button onClick={addManualAlarm} style={styles.modalAddBtn}>
                  Añadir
                </button>
                <button onClick={() => setShowAlarmModal(false)} style={styles.modalCancelBtn}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// === Estilos en línea para toda la página ===
const styles = {
  appContainer: {
    display: "flex",
    height: "100vh",
    fontFamily: "Arial, sans-serif",
    background: "#f2f6fc"
  },
  /* ---------- Sidebar ---------- */
  sidebar: {
    width: 240,
    background: "#0d47a1",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },
  sidebarHeader: {
    marginBottom: 40
  },
  logoutBtn: {
    marginTop: 16,
    background: "#b71c1c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 14
  },
  navLinks: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  navLink: {
    color: "#fff",
    textDecoration: "none",
    fontSize: 16,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.1)"
  },

  /* ---------- Main Content ---------- */
  mainContent: {
    flex: 1,
    overflowY: "auto",
    padding: 24
  },
  header: {
    marginBottom: 24
  },
  welcome: {
    margin: 0,
    fontSize: 28,
    color: "#0d47a1"
  },
  subtitle: {
    margin: 0,
    fontSize: 16,
    color: "#555"
  },

  /* ---------- Métricas ---------- */
  metricsSection: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 32
  },

  /* ---------- Overview Widgets ---------- */
  overviewSection: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 32
  },
  widget: {
    flex: "1 1 280px",
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    minWidth: 260
  },
  widgetTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 18,
    color: "#003566"
  },
  widgetText: {
    margin: "6px 0",
    fontSize: 14,
    color: "#333"
  },
  viewBtn: {
    marginTop: 12,
    background: "#0d47a1",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 14
  },

  /* ---------- Gráfica Placeholder ---------- */
  chartSection: {
    marginBottom: 32
  },
  chartTitle: {
    margin: "0 0 12px 0",
    fontSize: 20,
    color: "#003566"
  },
  chartPlaceholder: {
    height: 200,
    background: "#fff",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#777",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },

  /* ---------- Acciones Rápidas ---------- */
  quickActionsSection: {
    marginBottom: 32
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 20,
    color: "#003566"
  },
  actionsGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16
  },
  actionBtn: {
    flex: "1 1 180px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "12px 20px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer",
    minWidth: 160
  },

  /* ---------- Clientes Destacados ---------- */
  highlightSection: {
    marginBottom: 32
  },
  highlightList: {
    listStyle: "none",
    padding: 0,
    margin: 0
  },
  highlightItem: {
    background: "#fff",
    borderRadius: 6,
    marginBottom: 10,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center"
  },
  tagBadge: {
    marginLeft: 8,
    background: "#ffca28",
    color: "#333",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12
  },
  whatsappLink: {
    marginLeft: "auto",
    color: "#25d366",
    fontSize: 20
  },
  viewMoreLink: {
    display: "inline-block",
    marginTop: 8,
    color: "#1976d2",
    textDecoration: "underline",
    fontSize: 14
  },

  /* ---------- Alarmas ---------- */
  alarmSection: {
    marginBottom: 32,
    background: "#e3f2fd",
    padding: 16,
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  },
  alarmHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  addAlarmBtn: {
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "4px 12px",
    fontSize: 18,
    cursor: "pointer"
  },
  alarmList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    color: "#333"
  },
  alarmItem: {
    marginBottom: 8,
    display: "flex",
    alignItems: "center"
  },
  alarmActionBtn: {
    marginLeft: 12,
    background: "#388e3c",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 12,
    cursor: "pointer"
  },
  alarmDeleteBtn: {
    marginLeft: 6,
    background: "#d32f2f",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "2px 8px",
    fontSize: 12,
    cursor: "pointer"
  },
  noAlarmText: {
    color: "#555",
    fontStyle: "italic"
  },

  /* ---------- Modal ---------- */
  modalOverlay: {
    position: "fixed",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3000
  },
  modalContent: {
    background: "#fff",
    borderRadius: 8,
    padding: 28,
    minWidth: 340,
    boxShadow: "0 6px 32px rgba(0,0,0,0.1)"
  },
  modalInput: {
    width: "100%",
    fontSize: 16,
    marginBottom: 16,
    padding: 8,
    borderRadius: 4,
    border: "1px solid #ccc"
  },
  modalActions: {
    display: "flex",
    gap: 12,
    justifyContent: "flex-end"
  },
  modalAddBtn: {
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    padding: "8px 18px",
    fontSize: 16,
    fontWeight: "bold",
    cursor: "pointer"
  },
  modalCancelBtn: {
    background: "#fff",
    color: "#555",
    border: "1px solid #ccc",
    borderRadius: 4,
    padding: "8px 18px",
    fontSize: 16,
    cursor: "pointer"
  }
};
