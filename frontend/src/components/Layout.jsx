import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { LANGS } from '../i18n';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { lang, setLang, t } = useLang();

  const adminNavItems = [
    { to: '/', label: t('nav_home'), icon: '📊', end: true },
    { to: '/acenteler', label: t('nav_agencies'), icon: '🏢' },
    { to: '/musteriler', label: t('nav_customers'), icon: '👥' },
    { to: '/sevkiyatlar', label: t('nav_shipments'), icon: '📦' },
    { to: '/raporlar', label: t('nav_reports'), icon: '📈' },
  ];

  const agencyNavItems = [
    { to: '/', label: t('nav_home'), icon: '📊', end: true },
    { to: '/musteriler', label: t('nav_customers'), icon: '👥' },
    { to: '/sevkiyatlar', label: t('nav_shipments'), icon: '📦' },
    { to: '/raporlar', label: t('nav_reports'), icon: '📈' },
  ];

  const navItems = isAdmin ? adminNavItems : agencyNavItems;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-56 flex-shrink-0 bg-blue-950 text-white flex flex-col shadow-xl">
        <div className="px-5 py-5 border-b border-blue-900">
          <div className="text-lg font-bold tracking-tight">AcentePro</div>
          <div className="text-blue-400 text-xs mt-0.5">{t('subtitle')}</div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-blue-900 bg-blue-900/40">
          <div className="text-xs text-blue-400 uppercase tracking-wide mb-0.5">
            {isAdmin ? 'Admin' : t('agency_portal')}
          </div>
          <div className="text-white text-sm font-medium truncate">{user?.name}</div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'text-blue-200 hover:bg-blue-900 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Language + Logout */}
        <div className="px-3 py-3 border-t border-blue-900 space-y-2">
          {/* Language selector */}
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                title={l.label}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all ${
                  lang === l.code
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-400 hover:text-white hover:bg-blue-800'
                }`}
              >
                {l.flag}
              </button>
            ))}
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-xs text-blue-400 hover:text-white px-2 py-1.5 rounded hover:bg-blue-800 transition-colors"
          >
            ← {t('logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
