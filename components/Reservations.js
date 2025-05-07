// components/Reservations.js 
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const STORAGE_KEY_RES     = 'dive_manager_reservations';
const STORAGE_KEY_CLIENTS = 'dive_manager_clients';
const STATUS = ['Confirmada', 'Pendiente', 'Cancelada'];
const METHODS = ['Enlace de pago','Efectivo','Clip','Transferencia','Bizum'];

export default function Reservations() {
  // ➕ 0) Leer qué centro está activo
  const center = typeof window !== 'undefined'
    ? localStorage.getItem('active_center')
    : null;
  if (!center) return null;

  // ➕ 1) Derivar las claves que tocan según el centro
  const DYN_RES_KEY     = `${STORAGE_KEY_RES}_${center}`;
  const DYN_CLIENTS_KEY = `${STORAGE_KEY_CLIENTS}_${center}`;

  // ————— Estado principal —————
  const [reservations, setReservations]   = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [showForm, setShowForm]           = useState(false);
  const [editItem, setEditItem]           = useState(null);
  const [tab, setTab]                     = useState('details'); // details|payments|summary

  // ————— Formulario —————
  const todayStr = new Date().toISOString().slice(0,10);
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
    payments: [],    // { amount, method, date }
    payDate: '',
    payMethod: METHODS[0],
    payAmount: '',
    note: ''
  });

  // ————— Carga inicial y persistencia —————
  useEffect(() => {
    // ➕ usar clave dinámica para reservas
    const st = localStorage.getItem(DYN_RES_KEY);
    if (st) setReservations(JSON.parse(st));

    // ➕ usar clave dinámica para clientes
    const c  = localStorage.getItem(DYN_CLIENTS_KEY);
    if (c) {
      try {
        const arr = JSON.parse(c);
        setClientOptions(arr.map(x=>x.name).filter(Boolean));
      } catch{}
    }
  }, [center]);

  useEffect(() => {
    // ➕ persistir con clave dinámica
    localStorage.setItem(DYN_RES_KEY, JSON.stringify(reservations));
  }, [reservations, center]);

  // ————— Métricas —————
  const total    = reservations.length;
  const upcoming = useMemo(() => {
    return reservations.filter(r => r.date >= todayStr).length;
  }, [reservations, todayStr]);

  // ————— Helpers pagos y restante —————
  const addPayment = () => {
    if (!form.payAmount) return;
    setForm(f => ({
      ...f,
      payments: [...f.payments, { date:f.payDate, method:f.payMethod, amount:f.payAmount }],
      payAmount: ''
    }));
  };
  const removePayment = i => {
    setForm(f=>({
      ...f,
      payments: f.payments.filter((_,j)=>j!==i)
    }));
  };
  const calcRemaining = r => {
    const tot = Number(r.totalAmount)||0;
    const dep = Number(r.depositAmount)||0;
    const paid = (r.payments||[]).reduce((s,p)=>s+(Number(p.amount)||0),0);
    return (tot - dep - paid).toFixed(2);
  };

  // ————— Modal: abrir nuevo/editar —————
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

  // ————— Guardar y borrar —————
  const handleSubmit = e => {
    e.preventDefault();
    const payload = {
      ...form,
      totalAmount:   Number(form.totalAmount)||0,
      depositAmount: Number(form.depositAmount)||0,
      payments: form.payments.map(p=>({
        ...p,
        amount: Number(p.amount)||0
      }))
    };
    if (editItem) {
      setReservations(rs => rs.map(r => r.id===form.id ? payload : r));
    } else {
      setReservations(rs => [{ ...payload, id:Date.now() }, ...rs]);
    }
    setShowForm(false);
  };
  const handleDelete = id => {
    if (!confirm('¿Borrar esta reserva?')) return;
    setReservations(rs => rs.filter(r=>r.id!==id));
  };

  return (
    <div style={{ padding:20, fontFamily:'sans-serif', position:'relative' }}>
      <h2>Reservas — Centro: {center}</h2>
      <Link href="/" style={{ display:'inline-block', marginBottom:20, color:'#0070f3', textDecoration:'none' }}>
        ← Volver al panel principal
      </Link>

      {/* Métricas */}
      <div style={{ display:'flex', gap:20, marginBottom:20 }}>
        <div style={{ padding:20, background:'#222', color:'white', borderRadius:4 }}>
          <div>Total Reservas</div>
          <div style={{ fontSize:24 }}>{total}</div>
        </div>
        <div style={{ padding:20, background:'#222', color:'white', borderRadius:4 }}>
          <div>Próximas</div>
          <div style={{ fontSize:24 }}>{upcoming}</div>
        </div>
      </div>

      <button onClick={openNew} style={{
        marginBottom:20, padding:'8px 16px', background:'#0070f3',
        color:'white', border:'none', borderRadius:4, cursor:'pointer'
      }}>+ Agregar una reserva</button>

      {/* Tabla */}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Cliente</th>
            <th style={th}>Actividad</th>
            <th style={th}>Fecha</th>
            <th style={th}>Total</th>
            <th style={th}>Restante</th>
            <th style={th}>Estado</th>
            <th style={th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r,i)=> {
            const rem = calcRemaining(r);
            return (
              <tr key={r.id}>
                <td style={td}>{i+1}</td>
                <td style={td}>{r.client}</td>
                <td style={td}>{r.activity}</td>
                <td style={td}>{r.date}</td>
                <td style={td}>{Number(r.totalAmount).toFixed(2)} $</td>
                <td style={td}>{rem} $</td>
                <td style={td}>
                  {rem <= 0
                    ? <span style={{ background:'green', color:'white', padding:'2px 6px', borderRadius:4 }}>Pagado</span>
                    : <span style={{ background:'red', color:'white', padding:'2px 6px', borderRadius:4 }}>Pendiente</span>
                  }
                </td>
                <td style={td}>
                  <button onClick={()=>openEdit(r)} style={btn}>Editar</button>
                  <button onClick={()=>handleDelete(r.id)} style={{ ...btn, background:'red' }}>Borrar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal Formulario */}
      {showForm && (
        <div style={{
          position:'fixed', top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          <div style={{ background:'white', padding:20, borderRadius:4, width:360 }}>
            <h3>{editItem?'Editar Reserva':'Crear Reserva'}</h3>
            {/* Pestañas */}
            <div style={{ display:'flex', marginBottom:12 }}>
              {['details','payments','summary'].map(t=>(
                <button key={t}
                  onClick={()=>setTab(t)}
                  style={{
                    flex:1, padding:8, cursor:'pointer',
                    background: tab===t?'#0070f3':'#f0f0f0',
                    color: tab===t?'white':'black', border:'none'
                  }}
                >
                  {t==='details'?'Detalles': t==='payments'?'Pagos recibidos':'Resumen & Nota'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit}>
              {/* Detalles */}
              {tab==='details' && <>
                <label>Cliente</label><br/>
                <input list="clients-dl" required style={inp}
                  value={form.client}
                  onChange={e=>setForm(f=>({...f,client:e.target.value}))}
                />
                <datalist id="clients-dl">{clientOptions.map((c,i)=><option key={i} value={c}/>)}</datalist><br/>

                <label>Actividad</label><br/>
                <input required style={inp}
                  value={form.activity}
                  onChange={e=>setForm(f=>({...f,activity:e.target.value}))}
                /><br/>

                <label>Fecha</label><br/>
                <input type="date" required style={inp}
                  value={form.date}
                  onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                /><br/>

                <label>Total</label><br/>
                <input type="number" required style={inp}
                  value={form.totalAmount}
                  onChange={e=>setForm(f=>({...f,totalAmount:e.target.value}))}
                /><br/>

                <label>Depósito inicial</label><br/>
                <input type="number" style={{...inp,width:'calc(50% - 4px)'}}
                  placeholder="Cantidad"
                  value={form.depositAmount}
                  onChange={e=>setForm(f=>({...f,depositAmount:e.target.value}))}
                />
                <select style={{...inp,width:'calc(50% - 4px)',marginLeft:8}}
                  value={form.depositMethod}
                  onChange={e=>setForm(f=>({...f,depositMethod:e.target.value}))}
                >{METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select><br/>
                <input type="date" style={inp}
                  value={form.depositDate}
                  onChange={e=>setForm(f=>({...f,depositDate:e.target.value}))}
                /><br/>
              </>}

              {/* Pagos recibidos */}
              {tab==='payments' && <>
                <label>Agregar pago</label><br/>
                <input type="date" style={{...inp,width:'30%'}}
                  value={form.payDate}
                  onChange={e=>setForm(f=>({...f,payDate:e.target.value}))}
                />
                <select style={{...inp,width:'30%',margin:'0 4px'}}
                  value={form.payMethod}
                  onChange={e=>setForm(f=>({...f,payMethod:e.target.value}))}
                >{METHODS.map(m=><option key={m} value={m}>{m}</option>)}</select>
                <input type="number" placeholder="Cantidad" style={{...inp,width:'30%',marginLeft:4}}
                  value={form.payAmount}
                  onChange={e=>setForm(f=>({...f,payAmount:e.target.value}))}
                /><br/>
                <button type="button" onClick={addPayment} style={btn}>Añadir pago</button>
                <ul style={{ marginTop:12 }}>
                  {form.payments.map((p,i)=>(<li key={i} style={{ marginBottom:6 }}>
                    {p.date} — {p.method} — {p.amount} $
                    <button onClick={()=>removePayment(i)} style={{
                      marginLeft:8, color:'red', border:'none', background:'none', cursor:'pointer'
                    }}>×</button>
                  </li>))}
                </ul>
              </>}

              {/* Resumen & Nota */}
              {tab==='summary' && <>
                <p><strong>Restante a pagar:</strong> {calcRemaining(form)} $</p>
                <label>Nota</label><br/>
                <textarea style={{...inp,height:80}}
                  value={form.note}
                  onChange={e=>setForm(f=>({...f,note:e.target.value}))}
                />
              </>}

              <div style={{ marginTop:12 }}>
                <button type="submit" style={btn}>
                  {editItem?'Guardar':'Crear'}
                </button>
                <button type="button" onClick={()=>setShowForm(false)} style={{
                  ...btn, marginLeft:8, background:'#888'
                }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// estilos en línea
const th  = { border:'1px solid #ccc', padding:8, background:'#f4f4f4' };
const td  = { border:'1px solid #ccc', padding:8 };
const btn = { padding:'4px 8px', marginTop:4, background:'#0070f3', color:'white', border:'none', borderRadius:4, cursor:'pointer' };
const inp = { width:'100%', padding:6, marginBottom:8, boxSizing:'border-box' };
