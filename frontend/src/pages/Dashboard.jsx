import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function StatCard({ label, value, icon, color, to }) {
  const card = (
    <div className={`card p-4 flex items-center gap-3 ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl sm:text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs sm:text-sm text-gray-500 truncate">{label}</div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}

function fmtCurrency(n, cur = 'USD') {
  if (!n) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('tr-TR');
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSummary().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Yükleniyor...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ana Sayfa</h1>
        <p className="text-gray-500 text-sm mt-1">Komisyon takip sistemine hoş geldiniz</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Acente" value={stats.agencies} icon="🏢" color="bg-blue-50" to="/acenteler" />
        <StatCard label="Müşteri" value={stats.customers} icon="👥" color="bg-indigo-50" to="/musteriler" />
        <StatCard label="Sevkiyat" value={stats.shipments} icon="📦" color="bg-orange-50" to="/sevkiyatlar" />
        <StatCard label="Ödendi" value={stats.paid} icon="✅" color="bg-green-50" />
        <StatCard label="Bekliyor" value={stats.shipments - stats.paid} icon="⏳" color="bg-yellow-50" />
      </div>

      <div className="card p-4 sm:p-5">
        <div className="text-sm font-medium text-gray-500 mb-1">Toplam Komisyon Geliri</div>
        <div className="text-2xl sm:text-3xl font-bold text-green-600">{fmtCurrency(stats.total_commission)}</div>
        <div className="text-xs text-gray-400 mt-1">Ödenen tüm sevkiyatlardan hesaplanan</div>
      </div>

      <div className="card">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Son Sevkiyatlar</h2>
          <Link to="/sevkiyatlar" className="text-blue-600 text-sm hover:underline">Tümünü gör →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.recent_shipments?.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">Henüz sevkiyat yok</div>
          )}
          {stats.recent_shipments?.map(s => (
            <Link key={s.id} to={`/sevkiyatlar/${s.id}`}
              className="flex items-center justify-between px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.customer_name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.agency_name || '—'} · {fmtDate(s.shipment_date)}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.commission_amount
                  ? <span className="text-sm font-semibold text-green-600 hidden sm:inline">{fmtCurrency(s.commission_amount, s.currency)}</span>
                  : null}
                <span className={s.status === 'paid' ? 'badge-paid' : 'badge-pending'}>
                  {s.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
