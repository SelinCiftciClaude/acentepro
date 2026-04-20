import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';

const empty = { customer_id: '', reference_no: '', shipment_date: '', description: '', currency: 'USD', invoice_amount: '', shipping_method: 'CIF', fob_amount: '', notes: '' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

export default function Shipments() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    customer_id: searchParams.get('customer_id') || '',
    agency_id: '',
    start_date: '',
    end_date: '',
    status: ''
  });

  useEffect(() => {
    Promise.all([api.getCustomers(), api.getAgencies()])
      .then(([c, a]) => { setCustomers(c); setAgencies(a); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.getShipments(p)
      .then(setItems)
      .catch(e => alert(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function openNew() { setForm(empty); setModal('new'); }

  async function handleSave() {
    if (!form.customer_id) return alert('Müşteri seçin');
    if (!form.shipment_date) return alert('Tarih girilmesi zorunludur');
    setSaving(true);
    try {
      await api.createShipment({
        ...form,
        invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
        fob_amount: form.shipping_method === 'FOB' && form.fob_amount ? parseFloat(form.fob_amount) : null,
      });
      setModal(null);
      setFilters(f => ({ ...f }));
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(item) {
    if (!confirm('Bu sevkiyatı silmek istediğinizden emin misiniz?\nTüm belgeler de silinecektir.')) return;
    try { await api.deleteShipment(item.id); setFilters(f => ({ ...f })); } catch (e) { alert(e.message); }
  }

  const hasFilters = Object.values(filters).some(v => v);
  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const ff = (field) => (e) => setFilters(p => ({ ...p, [field]: e.target.value }));
  const clearAll = () => setFilters({ customer_id: '', agency_id: '', start_date: '', end_date: '', status: '' });

  const filteredCustomers = filters.agency_id
    ? customers.filter(c => String(c.agency_id) === String(filters.agency_id))
    : customers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sevkiyatlar</h1>
          <p className="text-gray-500 text-sm mt-0.5">Müşteri bazında sevkiyatları takip edin</p>
        </div>
        <button className="btn-primary text-sm" onClick={openNew}>+ Ekle</button>
      </div>

      {/* Filters — collapsible on mobile */}
      <div className="card">
        <button
          className="w-full flex items-center justify-between px-4 py-3 sm:hidden"
          onClick={() => setFiltersOpen(v => !v)}
        >
          <span className="text-sm font-medium text-gray-700">
            Filtreler {hasFilters ? <span className="text-blue-600">(aktif)</span> : ''}
          </span>
          <span className="text-gray-400 text-xs">{filtersOpen ? '▲' : '▼'}</span>
        </button>

        <div className={`p-4 ${filtersOpen ? 'block' : 'hidden'} sm:block`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="label">Acente</label>
              <select className="input" value={filters.agency_id} onChange={ff('agency_id')}>
                <option value="">Tümü</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Müşteri</label>
              <select className="input" value={filters.customer_id} onChange={ff('customer_id')}>
                <option value="">Tümü</option>
                {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Başlangıç</label>
              <input type="date" className="input" value={filters.start_date} onChange={ff('start_date')} />
            </div>
            <div>
              <label className="label">Bitiş</label>
              <input type="date" className="input" value={filters.end_date} onChange={ff('end_date')} />
            </div>
            <div>
              <label className="label">Durum</label>
              <select className="input" value={filters.status} onChange={ff('status')}>
                <option value="">Tümü</option>
                <option value="pending">Bekliyor</option>
                <option value="paid">Ödendi</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn-secondary text-xs" onClick={clearAll}>Filtreleri Temizle</button>
            <button className="btn-secondary text-xs" onClick={() => {
              const now = new Date();
              setFilters(p => ({ ...p, start_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end_date: '' }));
            }}>Bu Ay</button>
            <button className="btn-secondary text-xs" onClick={() => {
              const now = new Date();
              setFilters(p => ({ ...p, start_date: `${now.getFullYear()}-01-01`, end_date: `${now.getFullYear()}-12-31` }));
            }}>Bu Yıl</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            {hasFilters ? (
              <div className="space-y-2">
                <div className="text-3xl">🔍</div>
                <div className="text-gray-500 font-medium">Seçilen filtrelere uygun sevkiyat bulunamadı</div>
                <button className="text-blue-600 text-sm hover:underline mt-1" onClick={clearAll}>
                  Filtreleri temizle ve tümünü gör
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-4xl">📦</div>
                <div className="text-gray-500 font-medium">Henüz sevkiyat eklenmemiş</div>
                <button className="btn-primary" onClick={openNew}>Yeni Sevkiyat Ekle</button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Tarih</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Fatura No</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Müşteri</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Sevk Şekli</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Durum</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ödeme</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Komisyon</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Evrak</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtDate(item.shipment_date)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 font-mono">{item.reference_no || '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-gray-900">{item.customer_name}</div>
                        <div className="text-xs text-gray-400">{item.agency_name}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        {item.shipping_method && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.shipping_method === 'FOB' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                            {item.shipping_method}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={item.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                          {item.status === 'paid' ? '✓ Ödendi' : '⏳ Bekliyor'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-700 font-mono">
                        {item.payment_amount ? `${item.currency} ${Number(item.payment_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.commission_amount
                          ? <span className="text-sm font-bold text-green-600">{item.currency} {Number(item.commission_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{item.doc_count || 0} belge</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <Link to={`/sevkiyatlar/${item.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-4">Detay</Link>
                        <button className="text-red-500 hover:text-red-700 text-sm font-medium" onClick={() => handleDelete(item)}>Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-100">
              {items.map(item => (
                <div key={item.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{item.customer_name}</div>
                      <div className="text-xs text-gray-400">{item.agency_name} · {fmtDate(item.shipment_date)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {item.shipping_method && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${item.shipping_method === 'FOB' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                          {item.shipping_method}
                        </span>
                      )}
                      <span className={item.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                        {item.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500 space-x-2">
                      {item.reference_no && <span className="font-mono">{item.reference_no}</span>}
                      {item.commission_amount
                        ? <span className="font-semibold text-green-600">{item.currency} {Number(item.commission_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        : <span className="text-gray-400">Komisyon bekleniyor</span>}
                    </div>
                    <div className="flex gap-3">
                      <Link to={`/sevkiyatlar/${item.id}`} className="text-blue-600 text-xs font-medium">Detay</Link>
                      <button className="text-red-500 text-xs font-medium" onClick={() => handleDelete(item)}>Sil</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
                <span>{items.length} sevkiyat listeleniyor</span>
                <span className="font-semibold text-green-600 text-xs sm:text-sm">
                  Toplam Komisyon: {items.reduce((s, i) => s + (i.commission_amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (karma döviz)
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <Modal title="Yeni Sevkiyat" onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div>
              <label className="label">Müşteri *</label>
              <select className="input" value={form.customer_id} onChange={f('customer_id')}>
                <option value="">Müşteri seçin...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — %{c.commission_rate}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Sevkiyat Tarihi *</label>
                <input type="date" className="input" value={form.shipment_date} onChange={f('shipment_date')} />
              </div>
              <div>
                <label className="label">Fatura No</label>
                <input className="input" value={form.reference_no} onChange={f('reference_no')} placeholder="Örn: INV-2024-001" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Döviz</label>
                <select className="input" value={form.currency} onChange={f('currency')}>
                  <option value="USD">USD - Amerikan Doları</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - İngiliz Sterlini</option>
                  <option value="TRY">TRY - Türk Lirası</option>
                </select>
              </div>
              <div>
                <label className="label">Fatura Tutarı (Commercial Invoice)</label>
                <input type="number" min="0" step="0.01" className="input" value={form.invoice_amount} onChange={f('invoice_amount')} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="label">Sevk Şekli</label>
              <div className="flex gap-3">
                {['CIF', 'FOB'].map(m => (
                  <label key={m} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${form.shipping_method === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    <input type="radio" name="shipping_method" className="hidden" value={m} checked={form.shipping_method === m} onChange={f('shipping_method')} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            {form.shipping_method === 'FOB' && (
              <div>
                <label className="label">FOB Tutarı</label>
                <input type="number" min="0" step="0.01" className="input" value={form.fob_amount} onChange={f('fob_amount')} placeholder="0.00" />
                <p className="text-xs text-gray-400 mt-1">Navlun ve sigorta hariç teslim tutarı</p>
              </div>
            )}
            <div>
              <label className="label">Açıklama</label>
              <input className="input" value={form.description} onChange={f('description')} placeholder="Ürün/sevkiyat açıklaması" />
            </div>
            <div>
              <label className="label">Notlar</label>
              <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} placeholder="İsteğe bağlı notlar..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setModal(null)}>İptal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor...' : 'Sevkiyatı Kaydet'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
