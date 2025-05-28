import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import CrmOportunidades from './CrmOportunidades';
import CrmTareas from './CrmTareas';
import CrmTags from './CrmTags';
import CrmDashboard from './CrmDashboard';
import CrmExport from './CrmExport';
import CrmIntegraciones from './CrmIntegraciones';
import CrmHistorial from './CrmHistorial';
import { OportunidadesCliente } from "./OportunidadesCliente";


export default function Crm() {
  const center = typeof window !== 'undefined' && localStorage.getItem('active_center');
  if (!center) return null;

  // Estados principales
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [integracionesOpen, setIntegracionesOpen] = useState(false);

  // Carga de datos principal
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('center', center)
        .order('registered', { ascending: false });
      setClients(data || []);
    })();
  }, [center]);

  // Filtro global
  const filteredClients = useMemo(() => {
    let arr = [...clients];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      arr = arr.filter(c =>
        c.name?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t) ||
        c.phone?.toLowerCase().includes(t) ||
        c.location?.toLowerCase().includes(t) ||
        (c.tags || []).join(' ').toLowerCase().includes(t)
      );
    }
    if (filterTag) {
      arr = arr.filter(c => c.tags && c.tags.includes(filterTag));
    }
    return arr;
  }, [clients, searchTerm, filterTag]);

  // Render
  return (
    <div style={{ background: "#f5f8fb", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <header style={{ background: "#fff", padding: 18, borderBottom: "1px solid #e1e1e1" }}>
        <h1 style={{ margin: 0, color: "#0a2540", fontWeight: 900 }}>Buceo CRM PRO</h1>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => setDashboardOpen(o => !o)} style={styles.btnSecondary}>📊 Dashboard</button>
          <button onClick={() => setExportOpen(o => !o)} style={styles.btnSecondary}>📤 Exportar</button>
          <button onClick={() => setIntegracionesOpen(o => !o)} style={styles.btnSecondary}>🔗 Integraciones</button>
        </div>
      </header>

      {/* Filtros y búsqueda */}
      <div style={{ padding: "12px 16px", display: 'flex', gap: 16, alignItems: 'center' }}>
        <input
          placeholder="Buscar por nombre, email, teléfono, tag, curso, etc."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.inputSearch}
        />
        <CrmTags allClients={clients} filterTag={filterTag} setFilterTag={setFilterTag} />
        <button style={styles.btnSmall} onClick={() => setSearchTerm('')}>Limpiar búsqueda</button>
      </div>

      {/* Paneles modales */}
      {dashboardOpen && <CrmDashboard clients={clients} onClose={() => setDashboardOpen(false)} />}
      {exportOpen && <CrmExport clients={filteredClients} onClose={() => setExportOpen(false)} />}
      {integracionesOpen && <CrmIntegraciones clients={filteredClients} onClose={() => setIntegracionesOpen(false)} />}
{detail && (
  <div style={styles.modalOverlay} onClick={()=>setDetail(null)}>
    <div style={styles.modal} onClick={e=>e.stopPropagation()}>
      {/* ...todos tus datos del cliente... */}
      <OportunidadesCliente center={center} cliente={detail} />
      <button style={styles.smallBtn} onClick={()=>setDetail(null)}>Cerrar</button>
    </div>
  </div>
)}
      {/* Tabla clientes */}
      <div style={{ margin: '0 auto', maxWidth: 1100, background: '#fff', borderRadius: 10, padding: 18, boxShadow: "0 3px 8px #0001" }}>
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Población</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Tags</th>
              <th>Estado/Oportunidad</th>
              <th>Tareas</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(c => (
              <tr key={c.id} style={{ background: c.vip ? '#ffeedd' : '#fff' }}>
                <td>{c.name}</td>
                <td>{c.location}</td>
                <td>{c.email}</td>
                <td>
                  {c.phone}
                  <CrmOportunidades cliente={c} />
                </td>
                <td>
                  <CrmTags cliente={c} editable setClients={setClients} clients={clients} />
                </td>
                <td>
                  <CrmOportunidades cliente={c} editable setClients={setClients} clients={clients} />
                </td>
                <td>
                  <CrmTareas cliente={c} editable setClients={setClients} clients={clients} />
                </td>
                <td>
                  <button style={styles.btnSmall} onClick={() => window.open(`https://wa.me/34${c.phone.replace(/\D/g, "")}`, "_blank")}>WhatsApp</button>
                  <button style={styles.btnSmall} onClick={() => window.open(`mailto:${c.email}`)}>Email</button>
                  <CrmHistorial cliente={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredClients.length === 0 && <div style={{ color: '#bbb', padding: 20, textAlign: 'center' }}>Sin clientes que mostrar</div>}
      </div>
    </div>
  );
}

const styles = {
  btnSecondary: { background: "#f0f7fa", border: "1px solid #c2defb", color: "#015", borderRadius: 6, padding: "7px 15px", fontWeight: 600, cursor: "pointer" },
  btnSmall: { background: "#2186f6", color: "#fff", border: "none", borderRadius: 4, padding: "2px 9px", fontWeight: 500, margin: "0 2px", fontSize: 13, cursor: "pointer" },
  inputSearch: { padding: 10, borderRadius: 6, border: "1px solid #bbb", width: 260, fontSize: 15 }
};
