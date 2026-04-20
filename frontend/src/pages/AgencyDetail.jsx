import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}
function fmtMoney(n) {
  if (!n && n !== 0) return '—';
  return `$${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

export default function AgencyDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    load();
  }, [id, startDate, endDate]);

  async function load() {
    setLoading(true);
    const p = {};
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    try {
      setReport(await api.getAgencyReport(id, p));
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  function setQuickFilter(type) {
    const now = new Date();
    if (type === 'this_month') {
      setStartDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
      setEndDate('');
    } else if (type === 'this_year') {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(`${now.getFullYear()}-12-31`);
    } else if (type === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(lm.toISOString().slice(0, 10));
      setEndDate(lme.toISOString().slice(0, 10));
    } else {
      setStartDate(''); setEndDate('');
    }
  }

  function exportExcel() {
    if (!report) return;
    // Müşteri özet sheet
    const customerRows = report.customers.map(c => ({
      'Müşteri': c.name,
      'Komisyon Oranı (%)': c.commission_rate,
      'Sevkiyat Sayısı': c.shipment_count,
      'Ödenen Sevkiyat': c.paid_count,
      'Toplam Ödeme ($)': c.total_payment || 0,
      'Toplam Komisyon ($)': c.total_commission || 0,
    }));

    // Sevkiyat detay sheet
    const shipRows = report.shipments.map(s => ({
      'Tarih': fmtDate(s.shipment_date),
      'Fatura No': s.reference_no || '',
      'Müşteri': s.customer_name,
      'Sevk Şekli': s.shipping_method || '',
      'Durum': s.status === 'paid' ? 'Ödendi' : 'Bekliyor',
      'Döviz': s.currency,
      'Ödeme Tutarı': s.payment_amount || 0,
      'Komisyon': s.commission_amount || 0,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRows), 'Müşteri Özeti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shipRows), 'Sevkiyat Detayı');
    XLSX.writeFile(wb, `acente_ozet_${report.agency?.name}.xlsx`);
  }

  function exportPDF() {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Acente Özet Raporu: ${report.agency?.name}`, 14, 18);
    doc.setFontSize(10);
    const period = startDate || endDate
      ? `${startDate ? fmtDate(startDate) : '—'} → ${endDate ? fmtDate(endDate) : '—'}`
      : 'Tüm zamanlar';
    doc.text(`Dönem: ${period}  |  Toplam Komisyon: $${Number(report.total_commission || 0).toFixed(2)}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [['Müşteri', 'Komisyon Oranı', 'Sevkiyat', 'Ödenen', 'Toplam Ödeme', 'Toplam Komisyon']],
      body: report.customers.map(c => [
        c.name,
        `%${c.commission_rate}`,
        c.shipment_count,
        c.paid_count,
        c.total_payment ? `$${Number(c.total_payment).toFixed(2)}` : '—',
        c.total_commission ? `$${Number(c.total_commission).toFixed(2)}` : '—',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    const y2 = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text('Sevkiyat Detayları', 14, y2);
    autoTable(doc, {
      startY: y2 + 4,
      head: [['Tarih', 'Fatura No', 'Müşteri', 'Sevk Şekli', 'Durum', 'Ödeme', 'Komisyon']],
      body: report.shipments.map(s => [
        fmtDate(s.shipment_date),
        s.reference_no || '—',
        s.customer_name,
        s.shipping_method || '—',
        s.status === 'paid' ? 'Ödendi' : 'Bekliyor',
        s.payment_amount ? `${s.currency} ${Number(s.payment_amount).toFixed(2)}` : '—',
        s.commission_amount ? `${s.currency} ${Number(s.commission_amount).toFixed(2)}` : '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`acente_${report.agency?.name}.pdf`);
  }

  if (loading) return <div className="card p-16 text-center text-gray-400">Yükleniyor...</div>;
  if (!report) return null;

  const { agency, customers, shipments, total_commission, total_payment, paid_count } = report;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/acenteler" className="text-gray-400 hover:text-gray-700 text-sm">← Acenteler</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">{agency.name}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportExcel}>
            <span className="mr-1.5">📊</span>Excel İndir
          </button>
          <button className="btn-secondary" onClick={exportPDF}>
            <span className="mr-1.5">📄</span>PDF İndir
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Müşteri Sayısı</div>
          <div className="text-3xl font-bold text-gray-900">{customers.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Toplam Sevkiyat</div>
          <div className="text-3xl font-bold text-gray-900">{shipments.length}</div>
          <div className="text-xs text-gray-400 mt-1">{paid_count} ödendi</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Toplam Ödeme</div>
          <div className="text-2xl font-bold text-gray-700">{fmtMoney(total_payment)}</div>
        </div>
        <div className="card p-5 bg-green-50 border border-green-100">
          <div className="text-xs text-green-600 uppercase tracking-wide font-semibold mb-1">Toplam Komisyon</div>
          <div className="text-2xl font-bold text-green-700">{fmtMoney(total_commission)}</div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="label">Başlangıç</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button className="btn-secondary text-xs" onClick={() => setQuickFilter('all')}>Tümü</button>
            <button className="btn-secondary text-xs" onClick={() => setQuickFilter('this_month')}>Bu Ay</button>
            <button className="btn-secondary text-xs" onClick={() => setQuickFilter('last_month')}>Geçen Ay</button>
            <button className="btn-secondary text-xs" onClick={() => setQuickFilter('this_year')}>Bu Yıl</button>
          </div>
        </div>
      </div>

      {/* Customer Breakdown */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Müşteri Bazında Özet</h2>
        </div>
        {customers.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Bu acenteye ait müşteri bulunamadı</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Müşteri</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Komisyon Oranı</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Sevkiyat</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ödenen</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Toplam Ödeme</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Toplam Komisyon</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        %{c.commission_rate}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      <Link to={`/sevkiyatlar?customer_id=${c.id}`} className="hover:text-blue-600">
                        {c.shipment_count} sevkiyat
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{c.paid_count} ödendi</td>
                    <td className="px-5 py-3.5 text-right text-sm text-gray-700 font-mono">
                      {c.total_payment > 0 ? fmtMoney(c.total_payment) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-green-600">
                        {c.total_commission > 0 ? fmtMoney(c.total_commission) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/raporlar`} state={{ customerId: c.id }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        Rapor
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>{customers.length} müşteri</span>
              <span className="font-semibold text-green-600">
                Toplam Komisyon: {fmtMoney(total_commission)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Recent Shipments */}
      {shipments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Sevkiyat Listesi</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Tarih</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Fatura No</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Müşteri</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Sevk Şekli</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Durum</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ödeme</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Komisyon</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shipments.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-600 whitespace-nowrap">{fmtDate(s.shipment_date)}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{s.reference_no || '—'}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{s.customer_name}</td>
                  <td className="px-5 py-3">
                    {s.shipping_method && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${s.shipping_method === 'FOB' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'}`}>
                        {s.shipping_method}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={s.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                      {s.status === 'paid' ? '✓ Ödendi' : '⏳ Bekliyor'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-gray-700">
                    {s.payment_amount ? `${s.currency} ${Number(s.payment_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s.commission_amount
                      ? <span className="text-sm font-bold text-green-600">{s.currency} {Number(s.commission_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/sevkiyatlar/${s.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Detay</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
