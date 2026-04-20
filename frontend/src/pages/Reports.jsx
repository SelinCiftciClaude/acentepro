import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}
function fmtMoney(n, cur = 'USD') {
  if (!n) return '—';
  return `${cur} ${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

export default function Reports() {
  const [customers, setCustomers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getAgencies().then(setAgencies).catch(console.error);
    api.getCustomers().then(setCustomers).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCustomer) loadReport();
  }, [selectedCustomer, startDate, endDate]);

  async function loadReport() {
    if (!selectedCustomer) return;
    setLoading(true);
    const p = {};
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    try {
      setReport(await api.getCustomerReport(selectedCustomer, p));
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
      setStartDate('');
      setEndDate('');
    }
  }

  function exportExcel() {
    if (!report) return;
    const rows = report.shipments.map(s => ({
      'Tarih': fmtDate(s.shipment_date),
      'Fatura No': s.reference_no || '',
      'Açıklama': s.description || '',
      'Sevk Şekli': s.shipping_method || '',
      'Durum': s.status === 'paid' ? 'Ödendi' : 'Bekliyor',
      'Döviz': s.currency,
      'Ödeme Tutarı': s.payment_amount || 0,
      [`Komisyon (%${report.customer?.commission_rate})`]: s.commission_amount || 0,
    }));
    rows.push({
      'Tarih': '',
      'Fatura No': '',
      'Açıklama': 'TOPLAM',
      'Sevk Şekli': '',
      'Durum': `${report.shipments.length} sevkiyat`,
      'Döviz': '',
      'Ödeme Tutarı': report.total_payment || 0,
      [`Komisyon (%${report.customer?.commission_rate})`]: report.total_commission || 0,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komisyon Raporu');
    const period = startDate || endDate ? `_${startDate || ''}_${endDate || ''}` : '_tum_zamanlar';
    XLSX.writeFile(wb, `komisyon_${report.customer?.name}${period}.xlsx`);
  }

  function exportPDF() {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const period = startDate || endDate
      ? `${startDate ? fmtDate(startDate) : '—'} → ${endDate ? fmtDate(endDate) : '—'}`
      : 'Tüm zamanlar';

    doc.setFontSize(16);
    doc.text('Komisyon Raporu', 14, 18);
    doc.setFontSize(10);
    doc.text(`Müşteri: ${report.customer?.name}  |  Acente: ${report.customer?.agency_name}  |  Komisyon Oranı: %${report.customer?.commission_rate}`, 14, 26);
    doc.text(`Dönem: ${period}`, 14, 32);

    autoTable(doc, {
      startY: 38,
      head: [['Tarih', 'Fatura No', 'Açıklama', 'Sevk Şekli', 'Durum', 'Döviz', 'Ödeme Tutarı', `Komisyon (%${report.customer?.commission_rate})`]],
      body: [
        ...report.shipments.map(s => [
          fmtDate(s.shipment_date),
          s.reference_no || '—',
          s.description || '—',
          s.shipping_method || '—',
          s.status === 'paid' ? 'Ödendi' : 'Bekliyor',
          s.currency,
          s.payment_amount ? Number(s.payment_amount).toFixed(2) : '—',
          s.commission_amount ? Number(s.commission_amount).toFixed(2) : '—',
        ]),
        ['', '', 'TOPLAM', '', `${report.shipments.length} sevkiyat`, '',
          report.total_payment ? Number(report.total_payment).toFixed(2) : '—',
          report.total_commission ? Number(report.total_commission).toFixed(2) : '—'],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      foot: [],
      didParseCell: (data) => {
        if (data.row.index === report.shipments.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [236, 253, 245];
        }
      },
    });

    const period2 = startDate || endDate ? `_${startDate || ''}_${endDate || ''}` : '_tum';
    doc.save(`komisyon_${report.customer?.name}${period2}.pdf`);
  }

  const filteredCustomers = filterAgency
    ? customers.filter(c => String(c.agency_id) === String(filterAgency))
    : customers;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Komisyon Raporu</h1>
          <p className="text-gray-500 text-sm mt-0.5">Müşteri bazında komisyon özetleri</p>
        </div>
        {report && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary text-sm" onClick={exportExcel}>
              <span className="mr-1">📊</span><span className="hidden sm:inline">Excel İndir</span><span className="sm:hidden">Excel</span>
            </button>
            <button className="btn-secondary text-sm" onClick={exportPDF}>
              <span className="mr-1">📄</span><span className="hidden sm:inline">PDF İndir</span><span className="sm:hidden">PDF</span>
            </button>
            <button className="btn-secondary text-sm" onClick={() => window.print()}>
              <span className="mr-1">🖨️</span><span className="hidden sm:inline">Yazdır</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Filtreler</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Acente</label>
            <select className="input" value={filterAgency} onChange={e => { setFilterAgency(e.target.value); setSelectedCustomer(''); }}>
              <option value="">Tüm Acenteler</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Müşteri *</label>
            <select className="input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
              <option value="">Müşteri seçin...</option>
              {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Başlangıç Tarihi</label>
            <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Bitiş Tarihi</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary text-xs" onClick={() => setQuickFilter('all')}>Tüm Zamanlar</button>
          <button className="btn-secondary text-xs" onClick={() => setQuickFilter('this_month')}>Bu Ay</button>
          <button className="btn-secondary text-xs" onClick={() => setQuickFilter('last_month')}>Geçen Ay</button>
          <button className="btn-secondary text-xs" onClick={() => setQuickFilter('this_year')}>Bu Yıl</button>
        </div>
      </div>

      {!selectedCustomer && (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📈</div>
          <div className="text-gray-500 font-medium">Rapor oluşturmak için yukarıdan bir müşteri seçin</div>
        </div>
      )}

      {loading && (
        <div className="card p-16 text-center text-gray-400">Rapor yükleniyor...</div>
      )}

      {report && !loading && (
        <div className="space-y-5" id="print-area">
          {/* Customer Info */}
          <div className="card p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Müşteri</div>
                <div className="font-bold text-gray-900 text-base">{report.customer?.name}</div>
                <div className="text-sm text-gray-500">{report.customer?.agency_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Komisyon Oranı</div>
                <div className="text-2xl font-bold text-blue-700">%{report.customer?.commission_rate}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rapor Dönemi</div>
                <div className="text-sm text-gray-700">
                  {startDate || endDate
                    ? `${startDate ? fmtDate(startDate) : '—'} → ${endDate ? fmtDate(endDate) : '—'}`
                    : 'Tüm zamanlar'}
                </div>
              </div>
            </div>
          </div>

          {/* Shipments Table */}
          <div className="card overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Sevkiyat Detayları</h2>
            </div>
            {report.shipments?.length === 0 ? (
              <div className="p-10 text-center text-gray-400">Bu dönemde sevkiyat bulunamadı</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Tarih</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Fatura No</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Açıklama</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Durum</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Ödeme Tutarı</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Komisyon (%{report.customer?.commission_rate})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.shipments.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{fmtDate(s.shipment_date)}</td>
                        <td className="px-5 py-3.5">
                          <Link to={`/sevkiyatlar/${s.id}`} className="text-blue-600 hover:underline text-sm font-mono">
                            {s.reference_no || `#${s.id}`}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{s.description || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={s.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                            {s.status === 'paid' ? '✓ Ödendi' : '⏳ Bekliyor'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-sm font-mono text-gray-700">
                          {fmtMoney(s.payment_amount, s.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {s.commission_amount
                            ? <span className="font-bold text-green-600 text-sm">{fmtMoney(s.commission_amount, s.currency)}</span>
                            : <span className="text-gray-400 text-sm">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                </div>
                {/* Totals */}
                <div className="border-t-2 border-gray-200 px-4 sm:px-5 py-4 bg-gray-50">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="text-sm text-gray-500">{report.shipments.length} sevkiyat · {report.shipments.filter(s => s.status === 'paid').length} ödendi</div>
                    <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                      <div className="text-right">
                        <div className="text-xs text-gray-400 uppercase tracking-wide">Toplam Ödeme</div>
                        <div className="text-sm font-semibold text-gray-700">{fmtMoney(report.total_payment)}</div>
                      </div>
                      <div className="text-right bg-green-100 rounded-xl px-5 py-2">
                        <div className="text-xs text-green-600 uppercase tracking-wide font-semibold">Toplam Komisyon</div>
                        <div className="text-xl font-extrabold text-green-700">{fmtMoney(report.total_commission)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
