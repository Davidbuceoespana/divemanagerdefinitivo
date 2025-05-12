// pages/manager.js
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const PASSWORD = '311284'; // Cámbiala por algo seguro
const COLORS = ['#8884d8','#82ca9d','#ffc658','#ff8042','#8dd1e1','#d0ed57'];

export default function ManagerPage() {
  const router = useRouter();

  // ---- Estado de autenticación ----
  const [auth,    setAuth]    = useState(false);

  // ---- Datos ----
  const [events,       setEvents]       = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients,      setClients]      = useState([]);
  const [vouchers,     setVouchers]     = useState([]);
  const [expenses,     setExpenses]     = useState([]);

  // ---- Carga inicial tras autenticar ----
  useEffect(() => {
    if (!auth) {
      const pw = window.prompt('Introduce la contraseña de acceso:');
      if (pw === PASSWORD) setAuth(true);
      else router.replace('/');
      return;
    }

    const center = localStorage.getItem('active_center');
    if (!center) { router.replace('/'); return; }

    // Eventos
    const ev = JSON.parse(localStorage.getItem(`dive_manager_events_${center}`) || '[]')
      .map(e => ({ ...e, start:new Date(e.start), end:new Date(e.end) }));
    setEvents(ev);

    // Reservas
    setReservations(JSON.parse(localStorage.getItem(`dive_manager_reservations_${center}`) || '[]'));

    // Clientes
    setClients(JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]'));

    // Bonos
    setVouchers(JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`) || '[]'));

    // Gastos
    const ex = JSON.parse(localStorage.getItem(`dive_manager_expenses_${center}`) || '[]')
      .map(g => ({ ...g, date: new Date(g.date) }));
    setExpenses(ex);
  }, [auth, router]);

  // ---- Datos agrupados por mes para ingresos y gastos ----
  const monthlyData = useMemo(() => {
    const year = new Date().getFullYear();
    const incomeMap = {};
    const expenseMap = {};

    // Ingresos
    reservations.forEach(r => {
      const d = new Date(r.date || r.createdAt || r.registered);
      if (d.getFullYear() !== year) return;
      const month = d.getMonth();
      const inc = (Number(r.depositAmount)||0)
                + (r.payments||[]).reduce((s,p)=> s + (Number(p.amount)||0), 0);
      incomeMap[month] = (incomeMap[month]||0) + inc;
    });

    // Gastos
    expenses.forEach(g => {
      const d = new Date(g.date);
      if (d.getFullYear() !== year) return;
      const month = d.getMonth();
      expenseMap[month] = (expenseMap[month]||0) + (Number(g.amount)||0);
    });

    // Construir array de 12 meses
    return Array.from({ length: 12 }, (_, i) => ({
      month: i+1,
      income: incomeMap[i] || 0,
      expense: expenseMap[i] || 0
    }));
  }, [reservations, expenses]);

  // ---- Métricas del mes actual ----
  const thisMonth = new Date().getMonth();
  const thisIncome  = monthlyData[thisMonth]?.income  || 0;
  const thisExpense = monthlyData[thisMonth]?.expense || 0;
  const totalIncome  = monthlyData.reduce((s,d)=>s+d.income,0);
  const totalExpense = monthlyData.reduce((s,d)=>s+d.expense,0);

  return auth ? (
    <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:960, margin:'0 auto' }}>
      <button
        onClick={() => router.push('/')}
        style={{
          marginBottom:20,
          padding:'6px 12px',
          background:'#0070f3',
          color:'#fff',
          border:'none',
          borderRadius:4,
          cursor:'pointer'
        }}
      >← Volver al panel principal</button>

      <h1 style={{ marginBottom:16 }}>Panel de Gestión — Centro de Buceo</h1>

      {/* Métricas rápidas */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:32 }}>
        <Metric label="Inmersiones este mes"
                value={events.filter(e => {
                  const d = new Date(e.start);
                  return d.getMonth()===thisMonth && d.getFullYear()===new Date().getFullYear();
                }).length} />

        <Metric label="Clientes nuevos"
                value={clients.filter(c => {
                  const d = new Date(c.registered);
                  return d.getMonth()===thisMonth && d.getFullYear()===new Date().getFullYear();
                }).length} />

        <Metric label="Clientes recurrentes"
                value={clients.length - clients.filter(c=>{
                  const d = new Date(c.registered);
                  return d.getMonth()===thisMonth && d.getFullYear()===new Date().getFullYear();
                }).length} />

        <Metric label="Ingresos este mes"
                value={`${thisIncome.toFixed(2)}€`} />

        <Metric label="Gastos este mes"
                value={`${thisExpense.toFixed(2)}€`} />

        <Metric label="Ticket medio"
                value={`${(
                  totalIncome / (reservations.length||1)
                ).toFixed(2)}€`} />

        <Metric label="Ingresos totales"
                value={`${totalIncome.toFixed(2)}€`} />

        <Metric label="Gastos totales"
                value={`${totalExpense.toFixed(2)}€`} />
      </div>

      {/* 📈 Gráfico de Ingresos vs Gastos por mes */}
      <h2>Ingresos vs Gastos por mes (año {new Date().getFullYear()})</h2>
      <div style={{ width:'100%', height:300, marginBottom:40 }}>
        <ResponsiveContainer>
          <BarChart data={monthlyData}>
            <XAxis dataKey="month" label={{ value:'Mes', position:'insideBottom', offset:-5 }} />
            <YAxis label={{ value:'€', angle:-90, position:'insideLeft' }} />
            <Tooltip formatter={v=>v.toFixed(2)+'€'} />
            <Legend verticalAlign="top" />
            <Bar dataKey="income"  name="Ingresos" fill={COLORS[0]} />
            <Bar dataKey="expense" name="Gastos"   fill={COLORS[3]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 📊 Gráfico de Inmersiones por tipo */}
      <h2>Inmersiones por tipo</h2>
      <div style={{ width:'100%', height:300, marginBottom:40 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={(() => {
                const cnt = {};
                events.forEach(e => { cnt[e.activity] = (cnt[e.activity]||0) + 1; });
                return Object.entries(cnt).map(([name,value])=>({ name,value }));
              })()}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
              {events.map((e,i) =>
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              )}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 📊 Estado de bonos */}
      <h2>Estado de bonos</h2>
      <div style={{ width:'100%', height:250 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={[
                { name:'Usadas',     value: vouchers.reduce((s,v)=>s+v.used,0) },
                { name:'Restantes',  value: vouchers.reduce((s,v)=>s+(v.total-v.used),0) },
              ]}
              dataKey="value"
              nameKey="name"
              outerRadius={80}
              label
            >
              <Cell fill={COLORS[1]} />
              <Cell fill={COLORS[2]} />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  ) : null;
}

// —— Componente Metric ——  
function Metric({ label, value }) {
  return (
    <div style={{
      flex:'1 1 150px',
      background:'#222',
      color:'#fff',
      padding:16,
      borderRadius:8,
      textAlign:'center',
      minWidth:150
    }}>
      <small style={{ opacity:0.8 }}>{label}</small>
      <div style={{ fontSize:24, marginTop:4 }}>{value}</div>
    </div>
  );
}
