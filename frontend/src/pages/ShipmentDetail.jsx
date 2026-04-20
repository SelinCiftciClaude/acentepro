import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const DOC_TYPES = [
  { key: 'proforma', label: 'Proforma Fatura', icon: '📋', desc: 'Proforma Invoice' },
  { key: 'commercial_invoice', label: 'Ticari Fatura', icon: '🧾', desc: 'Commercial Invoice' },
  { key: 'packing_list', label: 'Çeki Listesi', icon: '📦', desc: 'Packing List' },
  { key: 'payment_receipt', label: 'Ödeme Dekontu', icon: '💳', desc: 'Bank Receipt / Payment', isPayment: true },
];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(n, cur = 'USD') {
  if (n == null || n === '') return '—';
  return `${cur} ${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

function DocCard({ type, doc, onUpload, onDelete, shipmentId }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showAmountInput, setShowAmountInput] = useState(false);

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (type.isPayment && !paymentAmount) {
      setShowAmountInput(true);
      return;
    }
    await doUpload(file);
  }

  async function doUpload(file) {
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', type.key);
    if (type.isPayment && paymentAmount) fd.append('payment_amount', paymentAmount);
    const result = await api.uploadDocument(shipmentId, fd);
    setUploading(false);
    setShowAmountInput(false);
    setPaymentAmount('');
    if (result.error) alert(result.error);
    else onUpload();
    fileRef.current.value = '';
  }

  async function handleDelete() {
    if (!confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) return;
    await api.deleteDocument(doc.id);
    onDelete();
  }

  const isUploaded = !!doc;

  return (
    <div className={`card p-4 flex flex-col gap-3 border-2 transition-colors ${isUploaded ? 'border-green-200 bg-green-50/30' : 'border-gray-200 border-dashed'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl">{type.icon}</div>
          <div className="font-semibold text-gray-900 text-sm mt-1">{type.label}</div>
          <div className="text-xs text-gray-400">{type.desc}</div>
        </div>
        {isUploaded && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
            ✓ Yüklendi
          </span>
        )}
      </div>

      {isUploaded ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 truncate" title={doc.original_name}>📎 {doc.original_name}</div>
          <div className="text-xs text-gray-400">{fmtDate(doc.uploaded_at)}</div>
          <div className="flex gap-2">
            <a href={`/uploads/${doc.filename}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline font-medium">
              Görüntüle / İndir ↗
            </a>
            <span className="text-gray-300">|</span>
            <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-700 font-medium">Sil</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {showAmountInput && type.isPayment ? (
            <div className="space-y-2">
              <div>
                <label className="label">Ödeme Tutarı *</label>
                <input
                  type="number" min="0" step="0.01"
                  className="input text-sm"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">Bu tutar üzerinden komisyon hesaplanacak</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!paymentAmount) return alert('Lütfen ödeme tutarını girin');
                    fileRef.current.click();
                  }}
                  className="btn-success text-xs flex-1"
                >
                  Dosya Seç ve Yükle
                </button>
                <button onClick={() => setShowAmountInput(false)} className="btn-secondary text-xs">İptal</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                if (type.isPayment) setShowAmountInput(true);
                else fileRef.current.click();
              }}
              disabled={uploading}
              className="w-full btn-secondary text-xs justify-center"
            >
              {uploading ? 'Yükleniyor...' : '+ Dosya Yükle'}
            </button>
          )}
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
            onChange={handleFileSelect}
          />
        </div>
      )}
    </div>
  );
}

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [customers, setCustomers] = useState([]);
  const [imgDesc, setImgDesc] = useState('');
  const imgRef = useRef();

  useEffect(() => {
    load();
    api.getCustomers().then(setCustomers);
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const d = await api.getShipment(id);
      setData(d);
      setForm({
        customer_id: d.customer_id,
        reference_no: d.reference_no || '', shipment_date: d.shipment_date || '',
        description: d.description || '', currency: d.currency || 'USD',
        invoice_amount: d.invoice_amount || '', payment_amount: d.payment_amount || '',
        shipping_method: d.shipping_method || 'CIF', fob_amount: d.fob_amount || '',
        notes: d.notes || ''
      });
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  async function handleSave() {
    try {
      await api.updateShipment(id, {
        ...form,
        company_id: null,
        invoice_amount: form.invoice_amount ? parseFloat(form.invoice_amount) : null,
        payment_amount: form.payment_amount ? parseFloat(form.payment_amount) : null,
        fob_amount: form.shipping_method === 'FOB' && form.fob_amount ? parseFloat(form.fob_amount) : null,
      });
      setEditMode(false);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete() {
    if (!confirm('Bu sevkiyatı silmek istediğinizden emin misiniz? Tüm belgeler de silinecektir.')) return;
    try { await api.deleteShipment(id); navigate('/sevkiyatlar'); } catch (e) { alert(e.message); }
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('description', imgDesc);
    const result = await api.uploadImage(id, fd);
    if (result.error) alert(result.error);
    else { setImgDesc(''); load(); }
    imgRef.current.value = '';
  }

  async function handleDeleteImage(imgId) {
    if (!confirm('Bu görseli silmek istediğinizden emin misiniz?')) return;
    await api.deleteImage(imgId);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Yükleniyor...</div>;
  if (!data) return <div className="text-center text-gray-500 mt-20">Sevkiyat bulunamadı.</div>;

  const docsByType = {};
  data.documents?.forEach(d => { docsByType[d.doc_type] = d; });

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/sevkiyatlar" className="hover:text-blue-600">Sevkiyatlar</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{data.reference_no || `Sevkiyat #${data.id}`}</span>
      </div>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">
                {data.reference_no || `Sevkiyat #${data.id}`}
              </h1>
              <span className={data.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                {data.status === 'paid' ? '✓ Ödendi' : '⏳ Ödeme Bekleniyor'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
              <span>📅 {fmtDate(data.shipment_date)}</span>
              <span>👥 {data.customer_name} <span className="text-gray-400">({data.agency_name})</span></span>
              {data.shipping_method && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${data.shipping_method === 'FOB' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                  {data.shipping_method}
                  {data.shipping_method === 'FOB' && data.fob_amount ? ` · ${fmtMoney(data.fob_amount, data.currency)}` : ''}
                </span>
              )}
              {data.description && <span>📝 {data.description}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm" onClick={() => setEditMode(!editMode)}>
              {editMode ? 'İptal' : '✏️ Düzenle'}
            </button>
            <button className="btn-danger text-sm" onClick={handleDelete}>Sil</button>
          </div>
        </div>

        {editMode && (
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-4">
            <div>
              <label className="label">Müşteri</label>
              <select className="input" value={form.customer_id} onChange={f('customer_id')}>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Tarih</label>
                <input type="date" className="input" value={form.shipment_date} onChange={f('shipment_date')} />
              </div>
              <div>
                <label className="label">Fatura No</label>
                <input className="input" value={form.reference_no} onChange={f('reference_no')} />
              </div>
              <div>
                <label className="label">Döviz</label>
                <select className="input" value={form.currency} onChange={f('currency')}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="TRY">TRY</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Sevk Şekli</label>
              <div className="flex gap-3">
                {['CIF', 'FOB'].map(m => (
                  <label key={m} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${form.shipping_method === m ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    <input type="radio" name="edit_shipping_method" className="hidden" value={m} checked={form.shipping_method === m} onChange={f('shipping_method')} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            {form.shipping_method === 'FOB' && (
              <div>
                <label className="label">FOB Tutarı</label>
                <input type="number" min="0" step="0.01" className="input" value={form.fob_amount} onChange={f('fob_amount')} placeholder="0.00" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fatura Tutarı (CI)</label>
                <input type="number" min="0" step="0.01" className="input" value={form.invoice_amount} onChange={f('invoice_amount')} />
              </div>
              <div>
                <label className="label">Ödeme Tutarı</label>
                <input type="number" min="0" step="0.01" className="input" value={form.payment_amount} onChange={f('payment_amount')} placeholder="Ödeme geldiğinde giriniz" />
                <p className="text-xs text-gray-400 mt-1">Bu alan doldurulduğunda komisyon otomatik hesaplanır</p>
              </div>
            </div>
            <div>
              <label className="label">Açıklama</label>
              <input className="input" value={form.description} onChange={f('description')} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setEditMode(false)}>İptal</button>
              <button className="btn-primary" onClick={handleSave}>Değişiklikleri Kaydet</button>
            </div>
          </div>
        )}
      </div>

      {/* Commission Summary */}
      <div className="card p-5 bg-gradient-to-br from-blue-50 to-green-50 border-blue-200">
        <h2 className="font-bold text-gray-800 mb-4 text-base">💰 Komisyon Özeti</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Komisyon Oranı</div>
            <div className="text-2xl font-bold text-blue-700">%{data.commission_rate}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Ödeme Tutarı</div>
            <div className="text-2xl font-bold text-gray-700">{fmtMoney(data.payment_amount, data.currency)}</div>
          </div>
          <div className="text-center bg-green-100 rounded-xl py-2">
            <div className="text-xs text-green-600 mb-1 uppercase tracking-wide font-semibold">Hesaplanan Komisyon</div>
            <div className="text-2xl font-extrabold text-green-700">
              {data.commission_amount ? fmtMoney(data.commission_amount, data.currency) : '—'}
            </div>
          </div>
        </div>
        {!data.payment_amount && (
          <p className="text-xs text-center text-gray-400 mt-4">
            Komisyon hesaplaması için ödeme dekontu yükleyin ve ödeme tutarını girin
          </p>
        )}
        {data.invoice_amount && (
          <div className="mt-3 text-center text-xs text-gray-500">
            Fatura Tutarı: {fmtMoney(data.invoice_amount, data.currency)}
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3 text-base">📂 Sevkiyat Belgeleri</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {DOC_TYPES.map(type => (
            <DocCard
              key={type.key}
              type={type}
              doc={docsByType[type.key]}
              shipmentId={id}
              onUpload={load}
              onDelete={load}
            />
          ))}
        </div>
      </div>

      {/* Product Images */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3 text-base">🖼️ Ürün Görselleri</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.images?.map(img => (
            <div key={img.id} className="card overflow-hidden group">
              <a href={`/uploads/${img.filename}`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`/uploads/${img.filename}`}
                  alt={img.description || img.original_name}
                  className="w-full h-36 object-cover hover:opacity-90 transition-opacity"
                  onError={e => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div style={{ display: 'none' }} className="w-full h-36 bg-gray-100 items-center justify-center text-gray-400 text-sm">
                  📄 {img.original_name}
                </div>
              </a>
              <div className="p-2">
                {img.description && <div className="text-xs text-gray-600 truncate">{img.description}</div>}
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-gray-400">{fmtDate(img.uploaded_at)}</div>
                  <button onClick={() => handleDeleteImage(img.id)} className="text-xs text-red-400 hover:text-red-600">Sil</button>
                </div>
              </div>
            </div>
          ))}

          {/* Add image card */}
          <div className="card border-2 border-dashed border-gray-200 p-4 flex flex-col items-center justify-center gap-2 min-h-36">
            <div className="text-gray-300 text-3xl">+</div>
            <div className="text-xs text-gray-400 text-center">Ürün Görseli Ekle</div>
            <input
              type="text"
              className="input text-xs w-full"
              placeholder="Açıklama (isteğe bağlı)"
              value={imgDesc}
              onChange={e => setImgDesc(e.target.value)}
            />
            <button className="btn-secondary text-xs w-full" onClick={() => imgRef.current.click()}>
              Görsel Seç
            </button>
            <input
              type="file"
              ref={imgRef}
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleImageUpload}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
