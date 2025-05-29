import { useState, useEffect } from "react";

export function useOportunidades(center, clienteId) {
  const LS_KEY = `dive_manager_oportunidades_${center}`;
  const [oportunidades, setOportunidades] = useState([]);

  useEffect(() => {
    if (!center || !clienteId) return setOportunidades([]);
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    setOportunidades(all.filter(o => o.clienteId === clienteId));
  }, [center, clienteId]);

  function saveAllOportunidades(all) {
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  }

  function addOportunidad(data) {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const nueva = {
      ...data,
      id: Date.now() + Math.random(),
      clienteId,
      estado: "pendiente",
      fechaCreacion: new Date().toISOString(),
      historial: [],
    };
    const updated = [nueva, ...all];
    saveAllOportunidades(updated);
    setOportunidades(updated.filter(o => o.clienteId === clienteId));
  }

  function updateOportunidad(id, update) {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const updated = all.map(o =>
      o.id === id ? { ...o, ...update } : o
    );
    saveAllOportunidades(updated);
    setOportunidades(updated.filter(o => o.clienteId === clienteId));
  }

  function addHistorial(id, accion, comentario = "") {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const updated = all.map(o => {
      if (o.id === id) {
        const historial = [...(o.historial || []), { accion, fecha: new Date().toISOString(), comentario }];
        return { ...o, historial, fechaUltimoContacto: new Date().toISOString() };
      }
      return o;
    });
    saveAllOportunidades(updated);
    setOportunidades(updated.filter(o => o.clienteId === clienteId));
  }

  function borrarOportunidad(id) {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    const updated = all.filter(o => o.id !== id);
    saveAllOportunidades(updated);
    setOportunidades(updated.filter(o => o.clienteId === clienteId));
  }

  return {
    oportunidades,
    addOportunidad,
    updateOportunidad,
    addHistorial,
    borrarOportunidad,
  };
}
