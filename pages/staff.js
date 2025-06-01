// pages/staff.js
import Link from 'next/link';
import Staff from '../components/Staff';

export default function StaffPage() {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <nav><Link href="/">← Volver a Inicio</Link></nav>
      <Staff />
    </div>
  );
}
