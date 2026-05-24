import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc } from '../lib/firebase';
import { Edit3, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function KPITemplateManagement() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    role: 'dokter',
    taskName: '',
    price: 0,
    unit: 'tindakan'
  });

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'kpi_templates'), orderBy('role', 'asc')), (snap) => {
      setTemplates(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!form.taskName || form.price <= 0) return alert('Nama tugas dan harga harus diisi');
    try {
      if (editingId) {
        await updateDoc(doc(db, 'kpi_templates', editingId), {
          ...form,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'kpi_templates'), {
          ...form,
          createdAt: serverTimestamp()
        });
      }
      setEditingId(null);
      setForm(prev => ({ ...prev, taskName: '', price: 0 }));
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus template ini?')) return;
    try {
      await deleteDoc(doc(db, 'kpi_templates', id));
    } catch (e) {
      console.error(e);
      alert('Gagal menghapus template');
    }
  };

  if (loading) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="bg-zinc-950/50 p-8 rounded-[2.5rem] border border-zinc-800">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6">Manajemen Template KPI</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Peran / Role</label>
            <select 
              value={form.role}
              onChange={(e) => setForm({...form, role: e.target.value})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="keuangan">Keuangan</option>
              <option value="dokter">Dokter</option>
              <option value="perawat">Perawat</option>
              <option value="apoteker">Apoteker</option>
              <option value="media">Media</option>
              <option value="PIC">PIC</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nama Tugas KPI</label>
            <input 
              type="text"
              value={form.taskName}
              onChange={(e) => setForm({...form, taskName: e.target.value})}
              placeholder="Contoh: Scaling Gigi"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Harga / Jasa (Rp)</label>
            <input 
              type="number"
              value={form.price}
              onChange={(e) => setForm({...form, price: Number(e.target.value)})}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
            />
          </div>
        </div>
        
        <div className="flex gap-4 mt-6">
          <button 
            onClick={handleSubmit}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
          >
            {editingId ? 'Update Template' : 'Tambah Template'}
          </button>
          {editingId && (
            <button 
              onClick={() => { setEditingId(null); setForm({ role: 'dokter', taskName: '', price: 0, unit: 'tindakan' }); }}
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Batal
            </button>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Role</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest">Tugas KPI</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Harga (Rp)</th>
              <th className="px-8 py-5 text-[10px] font-black uppercase text-zinc-500 tracking-widest text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors group">
                <td className="px-8 py-4">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-zinc-800 text-zinc-400 rounded-lg group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-all border border-zinc-700 group-hover:border-blue-500/20">
                    {t.role}
                  </span>
                </td>
                <td className="px-8 py-4">
                  <p className="text-xs font-bold text-white">{t.taskName}</p>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Per {t.unit || 'tindakan'}</p>
                </td>
                <td className="px-8 py-4 text-right">
                  <p className="text-xs font-black text-emerald-500 font-mono">Rp {t.price.toLocaleString()}</p>
                </td>
                <td className="px-8 py-4 text-right overflow-hidden">
                  <div className="flex justify-end gap-2 translate-x-20 group-hover:translate-x-0 transition-transform">
                    <button 
                      onClick={() => {
                        setEditingId(t.id);
                        setForm({ role: t.role, taskName: t.taskName, price: t.price, unit: t.unit || 'tindakan' });
                      }}
                      className="p-2.5 bg-zinc-800 text-zinc-500 hover:text-white rounded-xl transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="p-2.5 bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
