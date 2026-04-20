import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import { useLang } from '../context/LangContext';

const empty = { name: '', email: '', phone: '', address: '' };
const emptyCreds = { username: '', password: '' };

export default function Agencies() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [credsModal, setCredsModal] = useState(null);
  const [creds, setCreds] = useState(emptyCreds);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems(await api.getAgencies()); } catch (e) { alert(e.message); }
    setLoading(false);
  }

  function openNew() { setForm(empty); setModal('new'); }
  function openEdit(item) {
    setForm({ name: item.name, email: item.email || '', phone: item.phone || '', address: item.address || '' });
    setModal(item);
  }
  function openCreds(item) {
    setCreds({ username: item.username || '', password: '' });
    setCredsModal(item);
  }

  async function handleSave() {
    if (!form.name.trim()) return alert(t('agency_name') + ' zorunludur');
    setSaving(true);
    try {
      if (modal === 'new') await api.createAgency(form);
      else await api.updateAgency(modal.id, form);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleSaveCreds() {
    if (!creds.username.trim()) return alert(t('username') + ' zorunludur');
    setSaving(true);
    try {
      await api.setCredentials(credsModal.id, creds);
      alert(t('credentials_saved'));
      setCredsModal(null);
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleDelete(item) {
    if (!confirm(`"${item.name}" ${t('delete')}?\nBu acente altındaki tüm müşteriler ve sevkiyatlar da silinecektir.`)) return;
    try { await api.deleteAgency(item.id); load(); } catch (e) { alert(e.message); }
  }

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const fc = (field) => (e) => setCreds(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('agencies_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('agencies_sub')}</p>
        </div>
        <button className="btn-primary" onClick={openNew}>{t('new_agency')}</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🏢</div>
            <div className="text-gray-500 font-medium">{t('no_agencies')}</div>
            <button className="btn-primary mt-4" onClick={openNew}>{t('add_first_agency')}</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{t('agency_name')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{t('agency_email')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{t('agency_phone')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{t('agency_customers')}</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Giriş</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{item.name}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{item.email || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{item.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{item.customer_count || 0} {t('agency_customers')}</td>
                  <td className="px-5 py-3.5">
                    {item.username ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ✓ {item.username}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <Link to={`/acenteler/${item.id}`} className="text-green-600 hover:text-green-800 text-sm font-medium mr-3">{t('summary')}</Link>
                    <button className="text-purple-600 hover:text-purple-800 text-sm font-medium mr-3" onClick={() => openCreds(item)}>{t('login_settings')}</button>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3" onClick={() => openEdit(item)}>{t('edit')}</button>
                    <button className="text-red-500 hover:text-red-700 text-sm font-medium" onClick={() => handleDelete(item)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Agency edit/new modal */}
      {modal && (
        <Modal title={modal === 'new' ? t('new_agency_modal') : t('edit_agency')} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">{t('agency_name')} *</label>
              <input className="input" value={form.name} onChange={f('name')} placeholder="Örn: ABC Dış Ticaret" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t('agency_email')}</label>
                <input className="input" type="email" value={form.email} onChange={f('email')} placeholder="info@acente.com" />
              </div>
              <div>
                <label className="label">{t('agency_phone')}</label>
                <input className="input" value={form.phone} onChange={f('phone')} placeholder="+90 212 000 0000" />
              </div>
            </div>
            <div>
              <label className="label">{t('agency_address')}</label>
              <textarea className="input" rows={2} value={form.address} onChange={f('address')} placeholder="İstanbul, Türkiye" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Credentials modal */}
      {credsModal && (
        <Modal title={`${credsModal.name} — ${t('login_settings')}`} onClose={() => setCredsModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Bu acentenin yalnızca kendi verilerini görebileceği bir portal girişi tanımlayın.
            </p>
            <div>
              <label className="label">{t('username')}</label>
              <input className="input" value={creds.username} onChange={fc('username')} placeholder="örn: luca" autoFocus />
            </div>
            <div>
              <label className="label">{t('new_password')}</label>
              <input className="input" type="password" value={creds.password} onChange={fc('password')} placeholder="••••••••" />
              <p className="text-xs text-gray-400 mt-1">{t('password_hint')}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setCredsModal(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSaveCreds} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
