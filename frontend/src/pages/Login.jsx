import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { LANGS } from '../i18n';
import { api } from '../api';

export default function Login() {
  const { login } = useAuth();
  const { lang, setLang, t } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login({ username, password });
      login(data.token, data.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-extrabold text-white tracking-tight">AcentePro</div>
          <div className="text-blue-300 text-sm mt-1">{t('subtitle')}</div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t('login_title')}</h2>
          <p className="text-gray-400 text-sm mb-6">{t('login_subtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('username')}</label>
              <input
                className="input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('username')}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label">{t('password')}</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? t('logging_in') : t('login_btn')}
            </button>
          </form>
        </div>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mt-5">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                lang === l.code
                  ? 'bg-white text-blue-900 shadow'
                  : 'text-blue-300 hover:text-white hover:bg-blue-800'
              }`}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
