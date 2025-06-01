import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Importa el Calendar **solo** en el cliente
const Calendar = dynamic(() => import('../components/Calendar'), { ssr: false })

export default function AgendaPage() {
  const [center, setCenter] = useState('')

  useEffect(() => {
    const c = localStorage.getItem('active_center')
    if (c) setCenter(c)
  }, [])

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>
        Agenda de Instructores{center ? ` — Centro: ${center}` : ''}
      </h1>
      <Link href="/" style={{
        display: 'inline-block', marginBottom: 20,
        padding: '6px 12px', background: '#0070f3',
        color: 'white', borderRadius: 4, textDecoration: 'none'
      }}>
        ← Volver al panel principal
      </Link>

      <Calendar />
    </div>
  )
}