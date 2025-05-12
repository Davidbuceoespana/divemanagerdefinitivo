// pages/gastos.js
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

export default function GastosPage() {
  const router = useRouter();
  const [center, setCenter] = useState(undefined);
  const [expenses, setExpenses] = useState([]);
  const [date, setDate]     = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc]     = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = localStorage.getItem('active_center');
    setCenter(c);
    if (!c) router.replace('/login');
  }, [router]);

  useEffect(() => {
    if (!center) return;
    const raw = localStorage.getItem(`dive_manager_expenses_${center}`) || '[]';
    setExpenses(JSON.parse(raw));
  }, [center]);

  useEffect(() => {
    if (!center) return;
    localStorage.setItem(`dive_manager_expenses_${center}`, JSON.stringify(expenses));
  }, [expenses, center]);

  const grouped = useMemo(() => {
    const map = {};
    expenses.forEach(exp => {
      const [yy, mm] = exp.date.split('-');
      const key = `${yy}-${mm}`;
      if (!map[key]) map[key] = [];
      map[key].push(exp);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  if (center === undefined) {
    return <p style={{ padding:20, fontFamily:'sans-serif' }}>Cargando…</p>;
  }

  const handleAdd = e => {
    e.preventDefault();
    if (!date || !amount || isNaN(parseFloat(amount))) return;
    setExpenses(exps => [
      ...exps,
      { id: Date.now(), date, amount: parseFloat(amount), desc }
    ]);
    setDate(''); setAmount(''); setDesc('');
  };

  const handleDelete = id => {
    if (confirm('¿Borrar este gasto?')) {
      setExpenses(exps => exps.filter(e => e.id !== id));
    }
  };

  return (
    <div style={{ padding:20, fontFamily:'sans-serif', maxWidth:800, margin:'0 auto' }}>
      <h2>Gastos — Centro: {center}</h2>
      <div style={{ marginBottom:20 }}>
        <button
          onClick={() => router.push('/')}
          style={{
            padding:'6px 12px', marginRight:10,
            background:'#0070f3', color:'#fff', border:'none', borderRadius:4,
            cursor:'pointer'
          }}
        >
          ← Volver
        </button>
      </div>

      <form onSubmit={handleAdd} style={{ display:'flex', gap:8, marginBottom:24, alignItems:'center' }}>
        <input
          type="date"
          value={date}
          onChange={e=>setDate(e.target.value)}
          required
          style={{ padding:6, borderRadius:4, border:'1px solid #ccc' }}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Importe (€)"
          value={amount}
          onChange={e=>setAmount(e.target.value)}
          required
          style={{ padding:6, borderRadius:4, border:'1px solid #ccc', width:120 }}
        />
        <input
          type="text"
          placeholder="Descripción"
          value={desc}
          onChange={e=>setDesc(e.target.value)}
          style={{ flex:1, padding:6, borderRadius:4, border:'1px solid #ccc' }}
        />
        <button
          type="submit"
          style={{
            padding:'6px 12px',
            background:'#28a745', color:'#fff', border:'none', borderRadius:4,
            cursor:'pointer'
          }}
        >
          Añadir
        </button>
      </form>

      {grouped.length === 0 ? (
        <p>No hay gastos registrados.</p>
      ) : grouped.map(([month, exps]) => {
        const total = exps.reduce((s, e) => s + e.amount, 0);
        return (
          <details key={month} style={{ marginBottom:16 }}>
            <summary style={{ fontSize:16, fontWeight:500, cursor:'pointer' }}>
              {month} — {exps.length} gasto{exps.length>1?'s':''} — Total: {total.toFixed(2)}€
            </summary>
            <table style={{ width:'100%', borderCollapse:'collapse', marginTop:8 }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Importe</th>
                  <th style={th}>Descripción</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {exps.map(exp => (
                  <tr key={exp.id}>
                    <td style={td}>{exp.date}</td>
                    <td style={{ ...td, textAlign:'right' }}>{exp.amount.toFixed(2)}€</td>
                    <td style={td}>{exp.desc}</td>
                    <td style={td}>
                      <button
                        onClick={()=>handleDelete(exp.id)}
                        style={{
                          background:'transparent', border:'none',
                          color:'#dc3545', cursor:'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        );
      })}
    </div>
  );
}

const th = {
  borderBottom:'1px solid #ccc',
  padding:'8px',
  textAlign:'left'
};
const td = {
  borderBottom:'1px solid #eee',
  padding:'8px'
};
