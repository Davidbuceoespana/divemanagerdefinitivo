// lib/CenterContext.js
import { createContext, useState, useEffect } from 'react';

// 1) Creamos el contexto y lo exportamos
export const CenterContext = createContext();

// 2) Proveedor que envolverá tu app
export function CenterProvider({ children }) {
  const [center, setCenter] = useState(null);

  // Al cargar tu app, leemos si ya había un centro seleccionado
  useEffect(() => {
    const saved = localStorage.getItem('active_center');
    if (saved) setCenter(saved);
  }, []);

  // Cada vez que cambie el centro, lo guardamos
  useEffect(() => {
    if (center) localStorage.setItem('active_center', center);
  }, [center]);

  return (
    <CenterContext.Provider value={{ center, setCenter }}>
      {children}
    </CenterContext.Provider>
  );
}
