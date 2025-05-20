import React, { useState, useEffect } from 'react';

// ---------- Helpers ----------
function daysBetween(date1, date2) {
  return Math.floor((date2 - date1) / (1000 * 60 * 60 * 24));
}

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

export default function OportunidadesVenta() {
  const [clients, setClients] = useState([]);
  const [courses, setCourses] = useState([]);
  const [triggers, setTriggers] = useState(DEFAULT_TRIGGERS);
  const [newTrig, setNewTrig] = useState({ baseCourse:"", minDays:30, recommend:"", message:"" });

  // Para el botón atrás (cambia la ruta según tu router)
  function goBack() {
    window.history.back();
  }

  // Cargar datos
  useEffect(() => {
    const center = localStorage.getItem('active_center');
    if (!center) return;

    // Clientes
    const cl = JSON.parse(localStorage.getItem(`dive_manager_clients_${center}`) || '[]');
    setClients(cl);

    // Cursos (historial de cursos)
    let cs = [];
    cl.forEach(cliente => {
      if (Array.isArray(cliente.cursos)) {
        cliente.cursos.forEach(cur =>
          cs.push({ name: cliente.name, phone: cliente.phone || "", curso: cur.curso, fecha: cur.fecha })
        );
      }
    });
    setCourses(cs);

    // Gatillos
    const t = localStorage.getItem(`dive_manager_upsell_triggers_${center}`);
    if (t) setTriggers(JSON.parse(t));
    else setTriggers(DEFAULT_TRIGGERS);

    // DEBUG
    console.log("Clientes cargados:", cl);
    console.log("Cursos encontrados:", cs);
  }, []);

  useEffect(() => {
    const center = localStorage.getItem('active_center');
    if (!center) return;
    localStorage.setItem(`dive_manager_upsell_triggers_${center}`, JSON.stringify(triggers));
  }, [triggers]);

  // CALCULAR OPORTUNIDADES
  const oportunidades = [];
  const hoy = new Date();

  courses.forEach(item => {
    triggers.forEach(trig => {
      if (
        item.curso && trig.baseCourse &&
        item.curso.toLowerCase() === trig.baseCourse.toLowerCase() &&
        daysBetween(new Date(item.fecha), hoy) >= trig.minDays
      ) {
        oportunidades.push({
          ...item,
          dias: daysBetween(new Date(item.fecha), hoy),
          recommend: trig.recommend,
          message: trig.message
        });
      }
    });
  });

  // WHATSAPP
  function sendWhatsApp(phone, mensaje) {
    if (!phone) { alert("El cliente no tiene teléfono"); return; }
    const tel = "34" + phone.replace(/\D/g, "");
    const msg = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${tel}?text=${msg}`, "_blank");
  }

  // ---- UI -----
  return (
    <div style={{padding:30, maxWidth:850, margin:'0 auto'}}>
      <button onClick={goBack} style={{
        marginBottom:20, background:'#f0f7ff', color:'#155fa0',
        border:'1px solid #c3d8ef', borderRadius:7, padding:'7px 22px', fontWeight:'bold', fontSize:16, cursor:'pointer'
      }}>← Atrás</button>

      <h2 style={{marginTop:0}}>Oportunidades de Venta / Upselling</h2>

      <div style={{
        background:'#e7f6fc', padding:18, borderRadius:8, marginBottom:30, border:'1px solid #b0e0fc'
      }}>
        <h3>Gatillos de Upselling</h3>
        <table style={{width:'100%', marginBottom:14}}>
          <thead>
            <tr style={{background:'#f0fbff'}}>
              <th>Curso base</th>
              <th>Días desde que lo hizo</th>
              <th>Recomendar</th>
              <th>Mensaje sugerido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t, idx) => (
              <tr key={idx}>
                <td>
                  <input value={t.baseCourse}
                    onChange={e=>{
                      const n = [...triggers];
                      n[idx].baseCourse = e.target.value;
                      setTriggers(n);
                    }}
                    style={{width:'98%'}}
                  />
                </td>
                <td>
                  <input type="number" value={t.minDays}
                    onChange={e=>{
                      const n = [...triggers];
                      n[idx].minDays = Number(e.target.value);
                      setTriggers(n);
                    }}
                    style={{width:60}}
                  />
                </td>
                <td>
                  <input value={t.recommend}
                    onChange={e=>{
                      const n = [...triggers];
                      n[idx].recommend = e.target.value;
                      setTriggers(n);
                    }}
                    style={{width:'96%'}}
                  />
                </td>
                <td>
                  <input value={t.message}
                    onChange={e=>{
                      const n = [...triggers];
                      n[idx].message = e.target.value;
                      setTriggers(n);
                    }}
                    style={{width:'98%'}}
                  />
                </td>
                <td>
                  <button onClick={()=>{
                    const n = triggers.filter((_,i)=>i!==idx);
                    setTriggers(n);
                  }} style={{
                    color:'red', border:'none', background:'none', fontWeight:'bold'
                  }}>✖</button>
                </td>
              </tr>
            ))}
            {/* Añadir nuevo */}
            <tr>
              <td>
                <input placeholder="Curso base" value={newTrig.baseCourse}
                  onChange={e=>setNewTrig(n=>({...n, baseCourse:e.target.value}))}
                  style={{width:'98%'}}
                />
              </td>
              <td>
                <input type="number" placeholder="Días" value={newTrig.minDays}
                  onChange={e=>setNewTrig(n=>({...n, minDays:Number(e.target.value)}))}
                  style={{width:60}}
                />
              </td>
              <td>
                <input placeholder="Recomendar..." value={newTrig.recommend}
                  onChange={e=>setNewTrig(n=>({...n, recommend:e.target.value}))}
                  style={{width:'96%'}}
                />
              </td>
              <td>
                <input placeholder="Mensaje sugerido" value={newTrig.message}
                  onChange={e=>setNewTrig(n=>({...n, message:e.target.value}))}
                  style={{width:'98%'}}
                />
              </td>
              <td>
                <button onClick={()=>{
                  if(!newTrig.baseCourse || !newTrig.recommend || !newTrig.message) return;
                  setTriggers([...triggers, {...newTrig}]);
                  setNewTrig({ baseCourse:"", minDays:30, recommend:"", message:"" });
                }} style={{
                  color:'#2196f3', border:'none', background:'none', fontWeight:'bold'
                }}>➕</button>
              </td>
            </tr>
          </tbody>
        </table>
        <small>
          <b>Ejemplo:</b> Si un cliente hizo el "Open Water" hace más de 90 días, recomiéndale el "Advanced" con un mensaje personalizado.<br/>
          Puedes añadir o modificar cualquier criterio en cualquier momento.
        </small>
      </div>

      <h3>Clientes con Oportunidad</h3>
      <table style={{width:'100%', marginBottom:40}}>
        <thead>
          <tr style={{background:'#e0f7fa'}}>
            <th>Cliente</th>
            <th>Curso</th>
            <th>Fecha</th>
            <th>Días</th>
            <th>Recomendar</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {oportunidades.map((o,idx)=>(
            <tr key={idx}>
              <td>{o.name}</td>
              <td>{o.curso}</td>
              <td>{o.fecha && (new Date(o.fecha)).toLocaleDateString()}</td>
              <td>{o.dias}</td>
              <td>
                <b>{o.recommend}</b>
                <br/><span style={{fontSize:12,color:'#888'}}>{o.message}</span>
              </td>
              <td>
                <button
                  style={{
                    background:'#25d366', color:'#fff', border:'none',
                    borderRadius:4, padding:'3px 10px', fontWeight:'bold', marginRight:8
                  }}
                  onClick={()=>sendWhatsApp(o.phone, `¡Hola ${o.name}! ${o.message}`)}
                >WhatsApp</button>
              </td>
            </tr>
          ))}
          {oportunidades.length === 0 && (
            <tr>
              <td colSpan={6} style={{textAlign:'center', color:'#aaa', padding:20}}>
                <i>No hay oportunidades de venta actualmente</i>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
