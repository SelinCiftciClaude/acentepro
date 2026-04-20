import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agencies from './pages/Agencies';
import AgencyDetail from './pages/AgencyDetail';
import Customers from './pages/Customers';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Reports from './pages/Reports';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/acenteler" element={<Agencies />} />
        <Route path="/acenteler/:id" element={<AgencyDetail />} />
        <Route path="/musteriler" element={<Customers />} />
        <Route path="/sevkiyatlar" element={<Shipments />} />
        <Route path="/sevkiyatlar/:id" element={<ShipmentDetail />} />
        <Route path="/raporlar" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LangProvider>
  );
}

function LoginGuard() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
