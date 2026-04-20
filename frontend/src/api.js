const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function req(url, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + url, { ...opts, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bir hata oluştu');
  return data;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const api = {
  // Auth
  login: (d) => req('/auth/login', json('POST', d)),
  me: () => req('/auth/me'),

  // Agencies
  getAgencies: () => req('/agencies'),
  createAgency: (d) => req('/agencies', json('POST', d)),
  updateAgency: (id, d) => req(`/agencies/${id}`, json('PUT', d)),
  deleteAgency: (id) => req(`/agencies/${id}`, { method: 'DELETE' }),
  setCredentials: (id, d) => req(`/agencies/${id}/credentials`, json('PUT', d)),

  // Companies
  getCompanies: () => req('/companies'),
  createCompany: (d) => req('/companies', json('POST', d)),
  updateCompany: (id, d) => req(`/companies/${id}`, json('PUT', d)),
  deleteCompany: (id) => req(`/companies/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (p = {}) => req('/customers?' + new URLSearchParams(p)),
  createCustomer: (d) => req('/customers', json('POST', d)),
  updateCustomer: (id, d) => req(`/customers/${id}`, json('PUT', d)),
  deleteCustomer: (id) => req(`/customers/${id}`, { method: 'DELETE' }),

  // Shipments
  getShipments: (p = {}) => req('/shipments?' + new URLSearchParams(p)),
  getShipment: (id) => req(`/shipments/${id}`),
  createShipment: (d) => req('/shipments', json('POST', d)),
  updateShipment: (id, d) => req(`/shipments/${id}`, json('PUT', d)),
  deleteShipment: (id) => req(`/shipments/${id}`, { method: 'DELETE' }),

  // Documents
  uploadDocument: (shipmentId, formData) => {
    const token = getToken();
    return fetch(`${BASE}/shipments/${shipmentId}/documents`, {
      method: 'POST', body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    }).then(r => r.json());
  },
  deleteDocument: (id) => req(`/documents/${id}`, { method: 'DELETE' }),

  // Images
  uploadImage: (shipmentId, formData) => {
    const token = getToken();
    return fetch(`${BASE}/shipments/${shipmentId}/images`, {
      method: 'POST', body: formData,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    }).then(r => r.json());
  },
  deleteImage: (id) => req(`/product-images/${id}`, { method: 'DELETE' }),

  // Reports
  getCustomerReport: (id, p = {}) => req(`/reports/customer/${id}?` + new URLSearchParams(p)),
  getAgencyReport: (id, p = {}) => req(`/reports/agency/${id}?` + new URLSearchParams(p)),
  getSummary: () => req('/reports/summary'),
};
