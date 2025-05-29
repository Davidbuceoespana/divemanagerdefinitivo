import React, { useState } from "react";
import { useOportunidades } from "./hooks/useOportunidades";

export function OportunidadesCliente({ center, cliente }) {
  const {
    oportunidades,
    addOportunidad,
    updateOportunidad,
    addHistorial,
    borrarOportunidad,
  } = useOportunidades(center, cliente.id);

  const [nuevoCurso, setNuevoCurso] = useState("");
  const [nuevoMsg, setNuevoMsg] = useState("");

  return (
    <div style={{ marginTop: 26, background: "#f8fcff", padding: 18, borderRadius: 8 }}>
      <h4>Oportunidades de Venta</h4>
      <div style={{ marginBottom: 10 }}>
        <input
          placeholder="Curso a recomendar"
          value={nuevoCurso}
          onChange={e => setNuevoCurso(e.target.value)}
          style={{ padding: "6px", marginRight: 6, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <input
          placeholder="Mensaje sugerido"
          value={nuevoMsg}
          onChange={e => setNuevoMsg(e.target.value)}
          style={{ padding: "6px", marginRight: 6, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <button
          style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 4, padding: "7px 15px" }}
          onClick={() => {
            if (!nuevoCurso) return;
            addOportunidad({ curso: nuevoCurso, recommend: nuevoCurso, message: nuevoMsg });
            setNuevoCurso(""); setNuevoMsg("");
          }}
        >+ Añadir oportunidad</button>
      </div>
      <table style={{ width: "100%", fontSize: 15 }}>
        <thead>
          <tr>
            <th>Curso</th>
            <th>Estado</th>
            <th>Último contacto</th>
            <th>Comentarios</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {oportunidades.map((o, idx) => (
            <tr key={o.id} style={{
              background: o.estado === "pendiente" ? "#f8ffe7" :
                o.estado === "contactado" ? "#f0f9ff" :
                  o.estado === "vendido" ? "#e0ffe6" :
                    o.estado === "descartado" ? "#fff3f2" : "#fff"
            }}>
              <td><b>{o.recommend || o.curso}</b></td>
              <td>
                <select value={o.estado} onChange={e => updateOportunidad(o.id, { estado: e.target.value })}>
                  {["pendiente", "contactado", "vendido", "descartado"].map(st =>
                    <option key={st} value={st}>{st}</option>
                  )}
                </select>
              </td>
              <td>{o.fechaUltimoContacto ? new Date(o.fechaUltimoContacto).toLocaleString() : "-"}</td>
              <td>
                <textarea
                  value={o.comentarios || ""}
                  onChange={e => updateOportunidad(o.id, { comentarios: e.target.value })}
                  style={{ width: 120, borderRadius: 4, border: "1px solid #ddd" }}
                />
              </td>
              <td>
                <button
                  style={{ background: "#25d366", color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", marginRight: 5, cursor: "pointer" }}
                  onClick={() => {
                    window.open(`https://wa.me/34${cliente.phone.replace(/\D/g, "")}?text=${encodeURIComponent(o.message || "")}`);
                    addHistorial(o.id, "WhatsApp", o.message || "");
                  }}
                >WhatsApp</button>
                <button
                  style={{ background: "#2196f3", color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", marginRight: 5, cursor: "pointer" }}
                  onClick={() => {
                    window.open(`mailto:${cliente.email}?subject=Curso recomendado&body=${encodeURIComponent(o.message || "")}`);
                    addHistorial(o.id, "Email", o.message || "");
                  }}
                >Email</button>
                {o.historial && o.historial.length > 0 && (
                  <button
                    style={{ background: "#888", color: "#fff", border: "none", borderRadius: 4, padding: "2px 7px", cursor: "pointer" }}
                    onClick={() =>
                      alert(o.historial.map(h =>
                        `${h.accion} - ${new Date(h.fecha).toLocaleString()}${h.comentario ? " | " + h.comentario : ""}`
                      ).join("\n"))
                    }
                  >Historial</button>
                )}
                {o.estado === "descartado" && (
                  <button
                    style={{
                      background: "#ff4c4c", color: "#fff", border: 'none',
                      borderRadius: 3, padding: '2px 10px', fontSize: 14, cursor: "pointer"
                    }}
                    onClick={() => borrarOportunidad(o.id)}
                    title="Borrar oportunidad"
                  >🗑️</button>
                )}
              </td>
            </tr>
          ))}
          {oportunidades.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', color: '#bbb' }}>Sin oportunidades todavía</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
