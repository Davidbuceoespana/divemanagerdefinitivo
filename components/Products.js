// components/Products.js
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Products() {
  // —–– 1) Hooks (SIEMPRE al principio) —––
  const [center,     setCenter]     = useState(undefined);
  const [products,   setProducts]   = useState([]); // { id, family, name, price, specialPrices }
  const [families,   setFamilies]   = useState([]); // ["Buceo", ...]
  const [clients,    setClients]    = useState([]); // ["Juan", ...]
  const [editingIdx, setEditingIdx] = useState(-1);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({
    name: '',
    family: '',
    price: '',
    specialPrices: [] // { client, discount }
  });
  const [spClient,   setSpClient]   = useState('');
  const [spDiscount, setSpDiscount] = useState('');
  const [spEditIdx,  setSpEditIdx]  = useState(-1);

  // —–– 2) Detectar centro activo —––
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCenter(localStorage.getItem('active_center'));
  }, []);

  // —–– 3) Claves dinámicas —––
  const PROD_KEY = `dive_manager_products_${center}`;
  const FAM_KEY  = `dive_manager_families_${center}`;
  const CLI_KEY  = `dive_manager_clients_${center}`;

  // —–– 4) Cargar familias, clientes y productos —––
  useEffect(() => {
    if (!center) return;
    const rawF = JSON.parse(localStorage.getItem(FAM_KEY) || '[]');
    setFamilies(rawF);
    const rawC = JSON.parse(localStorage.getItem(CLI_KEY) || '[]');
    setClients(rawC.map(c => c.name));
    const rawP = JSON.parse(localStorage.getItem(PROD_KEY) || '[]');
    setProducts(rawP);
  }, [center]);

  // —–– 5) Persistir productos —––
  useEffect(() => {
    if (!center) return;
    localStorage.setItem(PROD_KEY, JSON.stringify(products));
  }, [products, center]);

  // —–– 6) Early returns —––
  if (center === undefined) return <p style={{ padding:20, fontFamily:'sans-serif' }}>Cargando…</p>;
  if (!center) return null;

  // —–– 7) Abrir formulario nuevo / editar —––
  const openNew = () => {
    setEditingIdx(-1);
    setForm({ name:'', family:'', price:'', specialPrices: [] });
    setSpClient(''); setSpDiscount(''); setSpEditIdx(-1);
    setShowForm(true);
  };
  const openEdit = idx => {
    const p = products[idx];
    setEditingIdx(idx);
    setForm({
      name: p.name,
      family: p.family,
      price: p.price,
      specialPrices: p.specialPrices || []
    });
    setSpClient(''); setSpDiscount(''); setSpEditIdx(-1);
    setShowForm(true);
  };

  // —–– 8) Guardar / actualizar producto —––
  const handleSave = e => {
    e.preventDefault();
    const entry = {
      id: editingIdx >= 0 ? products[editingIdx].id : Date.now(),
      ...form
    };
    if (editingIdx >= 0) {
      setProducts(ps => ps.map((p,i) => i === editingIdx ? entry : p));
    } else {
      setProducts(ps => [entry, ...ps]);
    }
    setShowForm(false);
  };

  // —–– 9) Borrar producto —––
  const handleDelete = idx => {
    if (!confirm('¿Borrar este producto?')) return;
    setProducts(ps => ps.filter((_,i) => i !== idx));
  };

  // —–– 10) Manejar “precios especiales” —––
  const handleAddSpecial = () => {
    const client = spClient.trim();
    const discount = Number(spDiscount) || 0;
    if (!client) return;
    setForm(f => {
      const arr = [...f.specialPrices];
      if (spEditIdx >= 0) {
        arr[spEditIdx] = { client, discount };
      } else {
        arr.push({ client, discount });
      }
      return { ...f, specialPrices: arr };
    });
    setSpClient(''); setSpDiscount(''); setSpEditIdx(-1);
  };
  const handleEditSpecial = i => {
    const sp = form.specialPrices[i];
    setSpClient(sp.client);
    setSpDiscount(sp.discount);
    setSpEditIdx(i);
  };
  const handleDelSpecial = i => {
    setForm(f => ({
      ...f,
      specialPrices: f.specialPrices.filter((_,j) => j !== i)
    }));
    if (spEditIdx === i) {
      setSpClient(''); setSpDiscount(''); setSpEditIdx(-1);
    }
  };

  return (
    <div style={{ padding:20, fontFamily:'sans-serif' }}>
      <h2>Gestión de Productos — Centro: {center}</h2>
      <div style={{ marginBottom:20 }}>
        <Link href="/" style={{ color:'#0070f3', marginRight:16 }}>← Panel principal</Link>
        <Link href="/familias" style={{ color:'#0070f3' }}>Gestionar Familias</Link>
      </div>

      <button onClick={openNew} style={{
        marginBottom:20, padding:'8px 16px',
        background:'#0070f3', color:'white',
        border:'none', borderRadius:4, cursor:'pointer'
      }}>
        + Añadir Producto
      </button>

      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
        <thead>
          <tr>
            <th style={{border:'1px solid #ccc',padding:8}}>Nombre</th>
            <th style={{border:'1px solid #ccc',padding:8}}>Familia</th>
            <th style={{border:'1px solid #ccc',padding:8}}>Precio</th>
            <th style={{border:'1px solid #ccc',padding:8}}>Especiales</th>
            <th style={{border:'1px solid #ccc',padding:8}}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p,i) => (
            <tr key={p.id}>
              <td style={{border:'1px solid #ccc',padding:8}}>{p.name}</td>
              <td style={{border:'1px solid #ccc',padding:8}}>{p.family}</td>
              <td style={{border:'1px solid #ccc',padding:8}}>{Number(p.price).toFixed(2)}</td>
              <td style={{border:'1px solid #ccc',padding:8}}>
                {p.specialPrices?.length || 0}
              </td>
              <td style={{border:'1px solid #ccc',padding:8}}>
                <button onClick={()=>openEdit(i)} style={{marginRight:8}}>✏️</button>
                <button onClick={()=>handleDelete(i)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div style={{
          position:'fixed', top:0,left:0,right:0,bottom:0,
          background:'rgba(0,0,0,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center'
        }}>
          <div style={{ background:'white', padding:20, borderRadius:4, width:360 }}>
            <h3>{editingIdx>=0 ? 'Editar Producto' : 'Nuevo Producto'}</h3>
            <form onSubmit={handleSave}>
              <label>Nombre</label><br/>
              <input
                required autoFocus
                value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                style={{ width:'100%', padding:6, marginBottom:8 }}
              /><br/>

              <label>Familia</label><br/>
              <select
                required
                value={form.family}
                onChange={e=>setForm(f=>({...f,family:e.target.value}))}
                style={{ width:'100%', padding:6, marginBottom:8 }}
              >
                <option value="">— elige familia —</option>
                {families.map(f=>(
                  <option key={f} value={f}>{f}</option>
                ))}
              </select><br/>

              <label>Precio</label><br/>
              <input
                type="number" step="0.01" required
                value={form.price}
                onChange={e=>setForm(f=>({...f,price:e.target.value}))}
                style={{ width:'100%', padding:6, marginBottom:8 }}
              /><br/>

              <fieldset style={{ marginBottom:12, padding:8, border:'1px solid #ccc' }}>
                <legend>Precios especiales</legend>
                <input
                  list="clients-dl"
                  placeholder="Cliente..."
                  value={spClient}
                  onChange={e=>setSpClient(e.target.value)}
                  style={{ width:'60%', padding:6, marginRight:4 }}
                />
                <input
                  type="number" placeholder="% dto"
                  value={spDiscount}
                  onChange={e=>setSpDiscount(e.target.value)}
                  style={{ width:'30%', padding:6, marginRight:4 }}
                />
                <button type="button" onClick={handleAddSpecial}>
                  {spEditIdx>=0 ? 'Actualizar' : 'Añadir'}
                </button>
                <datalist id="clients-dl">
                  {clients.map((c,i)=><option key={i} value={c}/>)}
                </datalist>
                <ul style={{ marginTop:8, paddingLeft:16 }}>
                  {form.specialPrices.map((sp,i)=>(
                    <li key={i}>
                      {sp.client} — {sp.discount}%{' '}
                      <button type="button" onClick={()=>handleEditSpecial(i)}>✏️</button>{' '}
                      <button type="button" onClick={()=>handleDelSpecial(i)}>🗑️</button>
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div style={{ marginTop:12 }}>
                <button type="submit" style={{
                  padding:'6px 12px', background:'#0070f3',
                  color:'white', border:'none', borderRadius:4
                }}>
                  {editingIdx>=0 ? 'Guardar' : 'Crear'}
                </button>{' '}
                <button type="button" onClick={()=>setShowForm(false)} style={{
                  padding:'6px 12px', background:'#888',
                  color:'white', border:'none', borderRadius:4
                }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
