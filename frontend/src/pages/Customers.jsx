import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';

const empty = { agency_id: '', name: '', email: '', phone: '', country: '', commission_rate: '', notes: '' };

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1 text-blue-500">{sort.dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function Customers() {
  const [items, setItems] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  // Inline column filters
  const [fName, setFName] = useState('');
  const [fAgency, setFAgency] = useState('');
  const [fCountry, setFCountry] = useState('');
  const [fRate, setFRate] = useState('');
  const [fShipments, setFShipments] = useState('');
  const [fCommission, setFCommission] = useState('');

  // Sort
  const [sort, setSort] = useState({ field: 'name', dir: 'asc' });

  useEffect(() => {
    api.getAgencies().then(setAgencies).catch(console.error);
    load();
  }, []);

  async function load() {
    setLoading(true);
    try { setItems(await api.getCustomers()); } catch (e) { alert(e.message); }
    setLoading(false);
  }

  function toggleSort(field) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  }

  function clearFilters() {
    setFName(''); setFAgency(''); setFCountry('');
    setFRate(''); setFShipments(''); setFCommission('');
  }

  const countries = useMemo(() => [...new Set(items.map(i => i.country).filter(Boolean))].sort(), [items]);
  const agencyOptions = useMemo(() => [...new Set(items.map(i => i.agency_name).filter(Boolean))].sort(), [items]);

  const hasFilters = fName || fAgency || fCountry || fRate || fShipments || fCommission;

  const filtered = useMemo(() => {
    let list = [...items];
    if (fName) { const q = fName.toLowerCase(); list = list.filter(i => i.name.toLowerCase().includes(q) || (i.email || '').toLowerCase().includes(q)); }
    if (fAgency) list = list.filter(i => String(i.agency_id) === fAgency);
    if (fCountry) list = list.filter(i => (i.country || '').toLowerCase() === fCountry.toLowerCase());
    if (fRate !== '') list = list.filter(i => String(i.commission_rate).includes(fRate));
    if (fShipments !== '') list = list.filter(i => i.shipment_count >= parseInt(fShipments));
    if (fCommission !== '') list = list.filter(i => (i.total_commission || 0) >= parseFloat(fCommission));

    list.sort((a, b) => {
      let va, vb;
      switch (sort.field) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'agency': va = (a.agency_name || '').toLowerCase(); vb = (b.agency_name || '').toLowerCase(); break;
        case 'country': va = (a.country || '').toLowerCase(); vb = (b.country || '').toLowerCase(); break;
        case 'rate': va = a.commission_rate; vb = b.commission_rate; break;
        case 'shipments': va = a.shipment_count; vb = b.shipment_count; break;
        case 'commission': va = a.total_commission || 0; vb = b.total_commission || 0; break;
        default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [items, fName, fAgency, fCountry, fRate, fShipments, fCommission, sort]);

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({ agency_id: item.agency_id, name: item.name, email: item.email || '', phone: item.phone || '', country: item.country || '', commission_rate: item.commission_rate, notes: item.notes || '' });
    setModal(item);
  }

  async function handleSave() {
    if (!form.agency_id) return alert('Lütfen acente seçin');
    if (!form.name.trim()) return alert('Müşteri adı zorunludur');
    if (form.commission_rate === '' || isNaN(Number(form.commission_rate))) return alert('Komisyon oranı gereklidir');
    setSaving(true);
    try {
      const data = { ...form, commission_rate: parseFloat(form.commission_rate) };
      if (modal === 'new') await api.createCustomer(data);
      else await api.updateCustomer(modal.id, data);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.name}" müşterisini silmek istediğinizden emin misiniz?\nTüm sevkiyatlar da silinecektir.`)) return;
    try { await api.deleteCustomer(item.id); load(); } catch (e) { alert(e.message); }
  }

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const thClass = "text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap";
  const filterInputClass = "w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white placeholder-gray-300";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Müşteriler</h1>
          <p className="text-gray-500 text-sm mt-1">Her müşteri için komisyon oranı tanımlayın</p>
        </div>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
              ✕ Filtreleri Temizle
            </button>
          )}
          <button className="btn-primary" onClick={openNew}>+ Yeni Müşteri</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-gray-500 font-medium">Müşteri bulunamadı</div>
            <button className="btn-primary mt-4" onClick={openNew}>İlk Müşteriyi Ekle</button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                {/* Sıralama satırı */}
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className={thClass} onClick={() => toggleSort('name')}>Müşteri <SortIcon field="name" sort={sort} /></th>
                  <th className={thClass} onClick={() => toggleSort('agency')}>Acente <SortIcon field="agency" sort={sort} /></th>
                  <th className={thClass} onClick={() => toggleSort('country')}>Ülke <SortIcon field="country" sort={sort} /></th>
                  <th className={thClass} onClick={() => toggleSort('rate')}>Komisyon Oranı <SortIcon field="rate" sort={sort} /></th>
                  <th className={thClass} onClick={() => toggleSort('shipments')}>Sevkiyat <SortIcon field="shipments" sort={sort} /></th>
                  <th className={thClass} onClick={() => toggleSort('commission')}>Toplam Komisyon <SortIcon field="commission" sort={sort} /></th>
                  <th className="px-3 py-3 bg-gray-50"></th>
                </tr>
                {/* Filtre satırı */}
                <tr className="bg-white border-b border-gray-200">
                  <td className="px-3 py-2">
                    <input className={filterInputClass} placeholder="Ada göre ara..." value={fName} onChange={e => setFName(e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <select className={filterInputClass} value={fAgency} onChange={e => setFAgency(e.target.value)}>
                      <option value="">Tümü</option>
                      {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select className={filterInputClass} value={fCountry} onChange={e => setFCountry(e.target.value)}>
                      <option value="">Tümü</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input className={filterInputClass} type="number" min="0" max="100" placeholder="Örn: 5" value={fRate} onChange={e => setFRate(e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={filterInputClass} type="number" min="0" placeholder="Min. adet" value={fShipments} onChange={e => setFShipments(e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <input className={filterInputClass} type="number" min="0" placeholder="Min. tutar" value={fCommission} onChange={e => setFCommission(e.target.value)} />
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                      Filtreyle eşleşen müşteri bulunamadı —
                      <button onClick={clearFilters} className="ml-1 text-blue-500 hover:underline text-sm">filtreleri temizle</button>
                    </td>
                  </tr>
                ) : filtered.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3.5">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.email && <div className="text-xs text-gray-400 mt-0.5">{item.email}</div>}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-gray-600">{item.agency_name}</td>
                    <td className="px-3 py-3.5 text-sm text-gray-500">{item.country || '—'}</td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        %{item.commission_rate}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-sm text-gray-500">
                      <Link to={`/sevkiyatlar?customer_id=${item.id}`} className="hover:text-blue-600">
                        {item.shipment_count} sevkiyat
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-green-600">
                      {item.total_commission > 0
                        ? `$${Number(item.total_commission).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3.5 text-right whitespace-nowrap">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3" onClick={() => openEdit(item)}>Düzenle</button>
                      <button className="text-red-500 hover:text-red-700 text-sm font-medium" onClick={() => handleDelete(item)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              {hasFilters
                ? `${filtered.length} / ${items.length} müşteri gösteriliyor`
                : `${items.length} müşteri`}
            </div>
          </>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'Yeni Müşteri' : 'Müşteri Düzenle'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Acente *</label>
              <select className="input" value={form.agency_id} onChange={f('agency_id')}>
                <option value="">Acente seçin...</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Müşteri / Firma Adı *</label>
              <input className="input" value={form.name} onChange={f('name')} placeholder="Örn: Global Trade Inc." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">E-posta</label>
                <input className="input" type="email" value={form.email} onChange={f('email')} />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input className="input" value={form.phone} onChange={f('phone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Ülke</label>
                <input className="input" value={form.country} onChange={f('country')} placeholder="Örn: Türkiye" />
              </div>
              <div>
                <label className="label">Komisyon Oranı (%) *</label>
                <div className="relative">
                  <input className="input pr-8" type="number" min="0" max="100" step="0.01" value={form.commission_rate} onChange={f('commission_rate')} placeholder="Örn: 5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ödeme tutarı üzerinden alınacak komisyon yüzdesi</p>
              </div>
            </div>
            <div>
              <label className="label">Notlar</label>
              <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} placeholder="İsteğe bağlı notlar..." />
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
