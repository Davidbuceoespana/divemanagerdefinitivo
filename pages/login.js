// pages/login.js
import { useRouter } from 'next/router';

const CENTERS = [
  { id: 'laHerradura',    name: 'La Herradura' },
  { id: 'playaDelCarmen', name: 'Playa del Carmen' },
];

export default function Login() {
  const router = useRouter();

  const selectCenter = id => {
    // 1) Guardamos el centro en localStorage
    localStorage.setItem('active_center', id);
    // 2) Vamos al dashboard
    router.push('/');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      background: '#f0f4f8',
      margin: 0
    }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Selecciona tu Centro</h1>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {CENTERS.map(center => (
          <button
            key={center.id}
            onClick={() => selectCenter(center.id)}
            style={{
              padding: '1rem 2rem',
              fontSize: '1rem',
              borderRadius: '0.5rem',
              border: '2px solid #0070f3',
              background: '#fff',
              color: '#0070f3',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            {center.name}
          </button>
        ))}
      </div>
    </div>
  );
}
