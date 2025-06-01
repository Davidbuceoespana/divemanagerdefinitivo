import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// CONFIGURA TU PASSWORD AQUÍ
const PASSWORD = "David311284";
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"];

export default function ManagerPage() {
  const [center, setCenter] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [pw, setPw] = useState("");
  const [events, setEvents] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState("monthly"); // monthly | quarterly | yearly

  // Cargar center al montar
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCenter(localStorage.getItem("active_center"));
    }
  }, []);

  // Cargar datos SOLO si logueado y center está definido
  useEffect(() => {
    if (!loggedIn || !center) return;
    setEvents(
      (JSON.parse(localStorage.getItem(`dive_manager_events_${center}`)) || []).map(e => ({
        ...e, start: new Date(e.start), end: new Date(e.end)
      }))
    );
    setReservations(
      JSON.parse(localStorage.getItem(`dive_manager_reservations_${center}`) || "[]")
    );
    setClients(
      JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || "[]")
    );
    setVouchers(
      JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || "[]")
    );
    setExpenses(
      (JSON.parse(localStorage.getItem(`dive_manager_expenses_${center}`) || "[]") || [])
        .map(g => ({ ...g, date: new Date(g.date) }))
    );
  }, [loggedIn, center]);

  // --- DATA PROCESSING ---
  // INGRESOS / GASTOS MENSUALES
  const monthlyData = useMemo(() => {
    const inc = {}, exp = {};
    reservations.forEach(r => {
      const d = new Date(r.registered || r.date || r.createdAt);
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      const a = (Number(r.depositAmount) || 0) +
        (r.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      inc[m] = (inc[m] || 0) + a;
    });
    expenses.forEach(g => {
      const d = new Date(g.date);
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      exp[m] = (exp[m] || 0) + Number(g.amount || 0);
    });
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: inc[i] || 0,
      expense: exp[i] || 0
    }));
  }, [reservations, expenses, year]);

  // INGRESOS / GASTOS TRIMESTRALES
  const quarterlyData = useMemo(() => {
    const quarters = [
      { name: "Q1", months: [0, 1, 2] },
      { name: "Q2", months: [3, 4, 5] },
      { name: "Q3", months: [6, 7, 8] },
      { name: "Q4", months: [9, 10, 11] },
    ];
    return quarters.map((q, i) => ({
      quarter: q.name,
      income: q.months.reduce((sum, m) => sum + (monthlyData[m]?.income || 0), 0),
      expense: q.months.reduce((sum, m) => sum + (monthlyData[m]?.expense || 0), 0),
    }));
  }, [monthlyData]);

  // INGRESOS / GASTOS ANUALES (resumen)
  const yearStats = useMemo(() => ({
    totalIncome: monthlyData.reduce((s, m) => s + m.income, 0),
    totalExpense: monthlyData.reduce((s, m) => s + m.expense, 0),
    balance: monthlyData.reduce((s, m) => s + m.income - m.expense, 0)
  }), [monthlyData]);

  // --- HANDLERS ---
  function resetLogin() {
    setLoggedIn(false);
    setPw("");
  }

  // --- RENDER LOGIN FIRST ---
  if (!loggedIn) {
    return (
      <div style={{ padding: 40, maxWidth: 340, margin: "80px auto" }}>
        <h2>Zona Manager</h2>
        <input
          type="password"
          placeholder="Contraseña"
          value={pw}
          onChange={e => setPw(e.target.value)}
          style={{ padding: 8, width: "100%", marginBottom: 12, fontSize: 17 }}
        />
        <button
          onClick={() => setLoggedIn(pw === PASSWORD)}
          style={{
            background: "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "8px 18px",
            fontWeight: "bold",
            fontSize: 18,
            width: "100%"
          }}
        >
          Entrar
        </button>
        {pw && pw !== PASSWORD && (
          <div style={{ color: "red", marginTop: 8, fontWeight: "bold" }}>
            Contraseña incorrecta
          </div>
        )}
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Panel Manager</h1>
        <button onClick={resetLogin} style={{
          background: "#dc3545",
          color: "white",
          border: "none",
          borderRadius: 4,
          padding: "6px 20px",
          fontWeight: "bold",
          fontSize: 16
        }}>Cerrar sesión</button>
      </div>
      <hr style={{ marginBottom: 16, marginTop: 0 }} />

      {/* Selector de año y vista */}
      <div style={{ marginBottom: 24, display: "flex", gap: 18, alignItems: "center" }}>
        <label>
          <b>Año:</b>{" "}
          <input
            type="number"
            min="2000"
            max={new Date().getFullYear()}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: "4px 10px", width: 90, fontSize: 16, borderRadius: 4, border: "1px solid #aaa" }}
          />
        </label>
        <button
          style={{
            background: view === "monthly" ? "#0070f3" : "#eee",
            color: view === "monthly" ? "#fff" : "#222",
            border: "none",
            borderRadius: 4,
            padding: "5px 12px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          onClick={() => setView("monthly")}
        >Mensual</button>
        <button
          style={{
            background: view === "quarterly" ? "#0070f3" : "#eee",
            color: view === "quarterly" ? "#fff" : "#222",
            border: "none",
            borderRadius: 4,
            padding: "5px 12px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          onClick={() => setView("quarterly")}
        >Trimestral</button>
        <button
          style={{
            background: view === "yearly" ? "#0070f3" : "#eee",
            color: view === "yearly" ? "#fff" : "#222",
            border: "none",
            borderRadius: 4,
            padding: "5px 12px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
          onClick={() => setView("yearly")}
        >Anual</button>
      </div>

      {/* GRÁFICAS */}
      {view === "monthly" && (
        <div>
          <h3>Ingresos y Gastos Mensuales</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" label={{ value: "Mes", position: "insideBottom", offset: -5 }} />
              <YAxis label={{ value: "€", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={v => v.toFixed(2) + "€"} />
              <Legend verticalAlign="top" />
              <Bar dataKey="income" name="Ingresos" fill={COLORS[0]} />
              <Bar dataKey="expense" name="Gastos" fill={COLORS[3]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {view === "quarterly" && (
        <div>
          <h3>Ingresos y Gastos Trimestrales</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={quarterlyData}>
              <XAxis dataKey="quarter" />
              <YAxis label={{ value: "€", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={v => v.toFixed(2) + "€"} />
              <Legend verticalAlign="top" />
              <Bar dataKey="income" name="Ingresos" fill={COLORS[1]} />
              <Bar dataKey="expense" name="Gastos" fill={COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {view === "yearly" && (
        <div>
          <h3>Resumen Anual</h3>
          <table style={{ fontSize: 18, marginTop: 16, marginBottom: 16 }}>
            <tbody>
              <tr>
                <td><b>Total ingresos:</b></td>
                <td style={{ color: "#0070f3" }}>{yearStats.totalIncome.toFixed(2)} €</td>
              </tr>
              <tr>
                <td><b>Total gastos:</b></td>
                <td style={{ color: "#dc3545" }}>{yearStats.totalExpense.toFixed(2)} €</td>
              </tr>
              <tr>
                <td><b>Balance:</b></td>
                <td style={{ color: yearStats.balance >= 0 ? "#28a745" : "#dc3545", fontWeight: "bold" }}>
                  {yearStats.balance.toFixed(2)} €
                </td>
              </tr>
            </tbody>
          </table>
          <ResponsiveContainer width={400} height={250}>
            <PieChart>
              <Pie
                data={[
                  { name: "Ingresos", value: yearStats.totalIncome },
                  { name: "Gastos", value: yearStats.totalExpense }
                ]}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label
              >
                <Cell fill={COLORS[0]} />
                <Cell fill={COLORS[3]} />
              </Pie>
              <Legend />
              <Tooltip formatter={v => v.toFixed(2) + "€"} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detalle extra */}
      <div style={{ marginTop: 50 }}>
        <h3>Resumen rápido ({year})</h3>
        <ul>
          <li><b>Total reservas:</b> {reservations.length}</li>
          <li><b>Total clientes:</b> {clients.length}</li>
          <li><b>Total gastos registrados:</b> {expenses.length}</li>
          <li><b>Total vouchers vendidos:</b> {vouchers.length}</li>
        </ul>
      </div>
      {/* Puedes añadir más análisis aquí */}
    </div>
  );
}
