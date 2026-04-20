import { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

const empty = { name: '', email: '', phone: '', country: '', address: '' };

export default function Companies() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems(await api.getCompanies()); } catch (e) { alert(e.message); }
    setLoading(false);
  }

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) { setForm({ name: item.name, email: item.email || '', phone: item.phone || '', country: item.country || '', address: item.address || '' }); setModal(item); }

  async function handleSave() {
    if (!form.name.trim()) return alert('Firma adı zorunludur');
    setSaving(true);
    try {
      if (modal === 'new') await api.createCompany(form);
      else await api.updateCompany(modal.id, form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.name}" firmasını silmek istediğinizden emin misiniz?`)) return;
    try { await api.deleteCompany(item.id); load(); } catch (e) { alert(e.message); }
  }

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Firmalar</h1>
          <p className="text-gray-500 text-sm mt-1">Sevkiyat yapılan firmaları yönetin</p>
        </div>
        <button className="btn-primary" onClick={openNew}>+ Yeni Firma</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🏭</div>
            <div className="text-gray-500 font-medium">Henüz firma eklenmemiş</div>
            <button className="btn-primary mt-4" onClick={openNew}>İlk Firmayı Ekle</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Firma Adı</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ülke</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">E-posta</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Telefon</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{item.name}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{item.country || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{item.email || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{item.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-4" onClick={() => openEdit(item)}>Düzenle</button>
                    <button className="text-red-500 hover:text-red-700 text-sm font-medium" onClick={() => handleDelete(item)}>Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Yeni Firma' : 'Firma Düzenle'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Firma Adı *</label>
              <input className="input" value={form.name} onChange={f('name')} placeholder="Örn: XYZ Manufacturing Ltd." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Ülke</label>
                <input className="input" value={form.country} onChange={f('country')} placeholder="Örn: Çin, Almanya" />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" value={form.phone} onChange={f('phone')} placeholder="+86 ..." />
              </div>
            </div>
            <div>
              <label className="label">E-posta</label>
              <input className="input" type="email" value={form.email} onChange={f('email')} placeholder="info@firma.com" />
            </div>
            <div>
              <label className="label">Adres</label>
              <textarea className="input" rows={2} value={form.address} onChange={f('address')} placeholder="Firma adresi" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setModal(null)}>İptal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
