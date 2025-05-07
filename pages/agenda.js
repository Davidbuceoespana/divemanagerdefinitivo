// pages/agenda.js
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Cargamos el Calendar sólo en el cliente
const Calendar = dynamic(() => import('../components/Calendar'), { ssr: false });

export default function AgendaPage() {
  const [center, setCenter] = useState('');

  useEffect(() => {
    // Leer el centro activo de la sesión
    const c = localStorage.getItem('active_center');
    if (c) setCenter(c);
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      {/* Título con nombre de centro */}
      <h1 style={{ marginBottom: 8 }}>
        Agenda de Instructores{center ? ` — Centro: ${center}` : ''}
      </h1>

      {/* Botón Volver */}
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: 20,
          padding: '6px 12px',
          background: '#0070f3',
          color: 'white',
          borderRadius: 4,
          textDecoration: 'none'
        }}
      >
        ← Volver al panel principal
      </Link>

      {/* Aquí se monta tu Calendar (ssr: false) */}
      <Calendar />
    </div>
  );
}
