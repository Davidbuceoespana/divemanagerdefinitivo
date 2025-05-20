// pages/manager.js
import { useSession, signOut } from "next-auth/react";
import { useRouter }          from "next/router";
import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend
} from "recharts";

const COLORS = ["#8884d8","#82ca9d","#ffc658","#ff8042"];

export default function ManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 1) Mientras carga el SDK de NextAuth…
  if (status === "loading") {
    return <p style={{ padding:20, fontFamily:"sans-serif" }}>Cargando sesión…</p>;
  }

  // 2) Si NextAuth ya ha cargado y NO hay sesión, redirijo y corto el render
  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  // 3) A estas alturas status === "authenticated"
  //    => podemos ya cargar nuestros datos de manager
  const [events,       setEvents]       = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients,      setClients]      = useState([]);
  const [vouchers,     setVouchers]     = useState([]);
  const [expenses,     setExpenses]     = useState([]);

  useEffect(() => {
    const center = localStorage.getItem("active_center");
    if (!center) return;

    // eventos
    const ev = JSON.parse(
      localStorage.getItem(`dive_manager_events_${center}`) || "[]"
    ).map(e => ({
      ...e,
      start: new Date(e.start),
      end:   new Date(e.end)
    }));
    setEvents(ev);

    // resto de colecciones
    setReservations(
      JSON.parse(localStorage.getItem(`dive_manager_reservations_${center}`)||"[]")
    );
    setClients(
      JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`)||"[]")
    );
    setVouchers(
      JSON.parse(localStorage.getItem(`dive_manager_vouchers_${center}`)||"[]")
    );
    const ex = JSON.parse(
      localStorage.getItem(`dive_manager_expenses_${center}`)||"[]"
    ).map(g=>({ ...g, date:new Date(g.date) }));
    setExpenses(ex);
  }, []);

  const monthlyData = useMemo(() => {
    const year = new Date().getFullYear();
    const inc = {}, exp = {};
    reservations.forEach(r=> {
      const d=new Date(r.registered||r.date||r.createdAt);
      if (d.getFullYear()!==year) return;
      const m=d.getMonth();
      const a=(Number(r.depositAmount)||0)
              + (r.payments||[])
                  .reduce((s,p)=>s+Number(p.amount||0),0);
      inc[m]=(inc[m]||0)+a;
    });
    expenses.forEach(g=> {
      const d=new Date(g.date);
      if (d.getFullYear()!==year) return;
      const m=d.getMonth();
      exp[m]=(exp[m]||0)+Number(g.amount||0);
    });
    return Array.from({length:12},(_,i)=>({
      month:i+1,
      income:  inc[i]||0,
      expense: exp[i]||0
    }));
  }, [reservations, expenses]);

  return (
    <div style={{ padding:20, fontFamily:"sans-serif", maxWidth:960, margin:"0 auto" }}>
      <button
        onClick={()=>router.push("/")}
        style={{
          marginBottom:20,
          padding:"6px 12px",
          background:"#0070f3",
          color:"#fff",
          border:"none",
          borderRadius:4,
          cursor:"pointer"
        }}
      >← Volver al panel principal</button>

      <h1>Zona Manager — {session.user.email}</h1>
      <button
        onClick={()=>signOut({ callbackUrl:"/login" })}
        style={{
          margin:"1rem 0",
          padding:"8px 16px",
          background:"#dc3545",
          color:"white",
          border:"none",
          borderRadius:4,
          cursor:"pointer"
        }}
      >Cerrar sesión</button>

      <h2>Ingresos vs Gastos por mes ({new Date().getFullYear()})</h2>
      <div style={{ width:"100%", height:300, marginBottom:40 }}>
        <ResponsiveContainer>
          <BarChart data={monthlyData}>
            <XAxis dataKey="month" label={{ value:"Mes", position:"insideBottom", offset:-5 }} />
            <YAxis label={{ value:"€", angle:-90, position:"insideLeft" }} />
            <Tooltip formatter={v=>v.toFixed(2)+"€"} />
            <Legend verticalAlign="top" />
            <Bar dataKey="income"  name="Ingresos"  fill={COLORS[0]} />
            <Bar dataKey="expense" name="Gastos"    fill={COLORS[3]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* …el resto de tu UI… */}
    </div>
  );
}
