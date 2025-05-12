// pages/reservas.js
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function ReservasPage() {
  const router = useRouter()
  const [center, setCenter]       = useState('')
  const [clients, setClients]     = useState([])
  const [reservations, setReservations] = useState([])

  // formulario reserva
  const [selectedClient, setSelectedClient] = useState('')
  const [type, setType]                     = useState('')
  const [description, setDescription]       = useState('')
  const [totalAmount, setTotalAmount]       = useState('')
  const [depositAmount, setDepositAmount]   = useState('')

  // para añadir pago inline
  const [editingPayFor, setEditingPayFor] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  // 1) cargar centro, clientes y reservas
  useEffect(() => {
    const c = localStorage.getItem('active_center')
    if (!c) {
      router.replace('/login')
      return
    }
    setCenter(c)
    const cl = JSON.parse(localStorage.getItem(`dive_manager_clients_${c}`) || '[]')
    setClients(cl)
    const rs = JSON.parse(localStorage.getItem(`dive_manager_reservations_${c}`) || '[]')
    setReservations(rs)
  }, [router])

  // 2) persistir reservas
  useEffect(() => {
    if (center) {
      localStorage.setItem(`dive_manager_reservations_${center}`, JSON.stringify(reservations))
    }
  }, [reservations, center])

  // 3) crear reserva
  const handleAddReservation = e => {
    e.preventDefault()
    if (!selectedClient || !type || Number(totalAmount) <= 0) {
      return alert('Completa Cliente, Tipo y Total')
    }
    const r = {
      id: Date.now(),
      client: selectedClient,
      type,
      description,
      totalAmount: Number(totalAmount),
      depositAmount: Number(depositAmount) || 0,
      payments: []  // { id, date, amount }
    }
    setReservations(rsa => [...rsa, r])
    // reset form
    setSelectedClient('')
    setType('')
    setDescription('')
    setTotalAmount('')
    setDepositAmount('')
  }

  // 4) cálculo restante
  const calcRemaining = r =>
    r.totalAmount - r.depositAmount - r.payments.reduce((s,p) => s + p.amount, 0)

  // 5) añadir pago intermedio
  const handleAddPayment = id => {
    const amt = Number(paymentAmount)
    if (!amt || amt <= 0) {
      return alert('Introduce importe válido')
    }
    setReservations(rsa =>
      rsa.map(r =>
        r.id === id
          ? {
              ...r,
              payments: [
                ...r.payments,
                { id: Date.now(), date: new Date().toISOString(), amount: amt }
              ]
            }
          : r
      )
    )
    setEditingPayFor(null)
    setPaymentAmount('')
  }

  // 6) borrar reserva
  const handleDeleteReservation = id => {
    if (confirm('¿Borrar reserva?')) {
      setReservations(rsa => rsa.filter(r => r.id !== id))
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1>Reservas — Centro: {center}</h1>
      <Link href="/" style={{ display: 'inline-block', marginBottom: 20 }}>
        ← Volver al panel principal
      </Link>

      {/* Formulario nueva reserva */}
      <form onSubmit={handleAddReservation} style={{ marginBottom: 30 }}>
        <h2>Crear nueva reserva</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            style={{ flex: 1, padding: 6 }}
            required
          >
            <option value="">— Selecciona Cliente —</option>
            {clients.map(c => (
              <option key={c.id || c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Tipo (curso, bono…)"
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ flex: 1, padding: 6 }}
            required
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <input
            placeholder="Descripción (opcional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            placeholder="Total €"
            min="0"
            value={totalAmount}
            onChange={e => setTotalAmount(e.target.value)}
            style={{ flex: 1, padding: 6 }}
            required
          />
          <input
            type="number"
            placeholder="Depósito €"
            min="0"
            value={depositAmount}
            onChange={e => setDepositAmount(e.target.value)}
            style={{ flex: 1, padding: 6 }}
          />
        </div>
        <button type="submit" style={{ padding: '8px 16px' }}>
          Añadir Reserva
        </button>
      </form>

      {/* Listado de reservas */}
      <h2>Listado de Reservas</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Cliente','Tipo','Total','Depósito','Pagos','Restante','Acciones'].map(h => (
              <th
                key={h}
                style={{
                  borderBottom: '2px solid #ccc',
                  padding: 8,
                  textAlign: 'left'
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reservations.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{r.client}</td>
              <td style={{ padding: 8 }}>{r.type}</td>
              <td style={{ padding: 8 }}>{r.totalAmount.toFixed(2)}€</td>
              <td style={{ padding: 8 }}>{r.depositAmount.toFixed(2)}€</td>
              <td style={{ padding: 8 }}>
                {r.payments.map(p => (
                  <div key={p.id}>
                    {new Date(p.date).toLocaleDateString()}: {p.amount.toFixed(2)}€
                  </div>
                ))}
              </td>
              <td style={{ padding: 8 }}>{calcRemaining(r).toFixed(2)}€</td>
              <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                {editingPayFor !== r.id ? (
                  <button onClick={() => setEditingPayFor(r.id)} style={{ marginRight: 8 }}>
                    + Pago
                  </button>
                ) : (
                  <>
                    <input
                      type="number"
                      placeholder="€"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                      style={{ width: 60, marginRight: 4 }}
                    />
                    <button onClick={() => handleAddPayment(r.id)}>OK</button>{' '}
                    <button onClick={() => setEditingPayFor(null)}>✕</button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteReservation(r.id)}
                  style={{ marginLeft: 8, color: 'red' }}
                >
                  Borrar
                </button>
              </td>
            </tr>
          ))}
          {reservations.length === 0 && (
            <tr>
              <td colSpan="7" style={{ padding: 8, textAlign: 'center' }}>
                No hay reservas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
