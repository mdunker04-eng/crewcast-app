// ═══════════════════════════════════════════════════════
// CrewCast — API Client
// ═══════════════════════════════════════════════════════

const API = {
  token: localStorage.getItem('crewcast_token'),
  user: JSON.parse(localStorage.getItem('crewcast_user') || 'null'),

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('crewcast_token', token);
    localStorage.setItem('crewcast_user', JSON.stringify(user));
  },

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('crewcast_token');
    localStorage.removeItem('crewcast_user');
  },

  isLoggedIn() {
    return !!this.token;
  },

  isAdmin() {
    return this.user && (this.user.role === 'admin' || this.user.role === 'owner');
  },

  async fetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      this.clearAuth();
      Router.navigate('/login');
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(url) { return this.fetch(url); },
  post(url, body) { return this.fetch(url, { method: 'POST', body: JSON.stringify(body) }); },
  put(url, body) { return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(url) { return this.fetch(url, { method: 'DELETE' }); },

  // ── Auth ──
  login: (phone, pin, businessSlug) => API.post('/api/auth/login', { phone, pin, businessSlug }),
  setup: (inviteToken, pin) => API.post('/api/auth/setup', { inviteToken, pin }),
  me: () => API.get('/api/auth/me'),
  logout: () => API.post('/api/auth/logout', {}),

  // ── Employees ──
  getEmployees: () => API.get('/api/employees'),
  addEmployee: (data) => API.post('/api/employees', data),
  updateEmployee: (id, data) => API.put(`/api/employees/${id}`, data),
  deleteEmployee: (id) => API.delete(`/api/employees/${id}`),
  bulkImport: (employees) => API.post('/api/employees/bulk', { employees }),

  // ── Schedules ──
  getSchedules: () => API.get('/api/schedules'),
  createSchedule: (data) => API.post('/api/schedules', data),
  updateSchedule: (id, data) => API.put(`/api/schedules/${id}`, data),
  deleteSchedule: (id) => API.delete(`/api/schedules/${id}`),
  getShifts: (scheduleId) => API.get(`/api/schedules/${scheduleId}/shifts`),
  addShifts: (scheduleId, shifts) => API.post(`/api/schedules/${scheduleId}/shifts`, { shifts }),
  respondShift: (scheduleId, shiftId, status, notes, decline_reason) =>
    API.put(`/api/schedules/${scheduleId}/shifts/${shiftId}/respond`, { status, notes, decline_reason }),
  getMyShifts: () => API.get('/api/schedules/my-shifts'),

  // ── Availability ──
  getAvailability: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.get(`/api/availability${qs ? '?' + qs : ''}`);
  },
  setAvailability: (dates) => API.put('/api/availability', { dates }),
  getAvailSummary: (date) => API.get(`/api/availability/summary?date=${date}`),

  // ── Swaps ──
  getSwaps: () => API.get('/api/swaps'),
  requestSwap: (shiftId, targetId, reason) => API.post('/api/swaps', { shiftId, targetId, reason }),
  respondSwap: (id, status) => API.put(`/api/swaps/${id}`, { status }),

  // ── Push ──
  getVapidKey: () => API.get('/api/push/vapid-key'),
  subscribePush: (subscription) => API.post('/api/push/subscribe', { subscription }),
  sendPush: (data) => API.post('/api/push/send', data),

  // ── Employee-Station Skills ──
  getEmployeeStations: (empId) => API.get(`/api/employees/${empId}/stations`),
  updateEmployeeStations: (empId, stationIds) => API.put(`/api/employees/${empId}/stations`, { stationIds }),
  getEmployeesByStation: (stationId) => API.get(`/api/employees/by-station/${stationId}`),

  // ── Station Categories & Category Ratings ──
  getCategories: () => API.get('/api/employees/categories/list'),
  getCategoryRatings: (empId) => API.get(`/api/employees/${empId}/category-ratings`),
  setCategoryRating: (empId, categoryId, rating) => API.put(`/api/employees/${empId}/category-ratings`, { categoryId, rating }),
  getAllCategoryRatings: () => API.get('/api/employees/all-ratings/list'),

  // ── Per-Station Ratings ──
  setStationRating: (empId, stationId, rating) => API.put(`/api/employees/${empId}/station-rating`, { stationId, rating }),
  getStationRatings: (empId) => API.get(`/api/employees/${empId}/station-ratings`),

  // ── My Station Preferences (employee self-service) ──
  getMyStationPrefs: () => API.get('/api/employees/me/station-preferences'),
  setMyStationPrefs: (stations) => API.put('/api/employees/me/station-preferences', { stations }),

  // ── Business Settings ──
  getSettings: () => API.get('/api/stations/settings'),
  updateSettings: (data) => API.put('/api/stations/settings', data),
  getFeatures: () => API.get('/api/stations/features'),

  // ── Time Tracking ──
  getQRCode: (empId) => API.get(`/api/time/qr/${empId}`),
  scanQR: (payload, stationId, kioskId) => API.post('/api/time/scan', { payload, stationId, kioskId }),
  clockIn: (stationId, roleId) => API.post('/api/time/clock-in', { stationId, roleId }),
  clockOut: (tipCash, tipCard) => API.post('/api/time/clock-out', { tipCash, tipCard }),
  getClockStatus: () => API.get('/api/time/status'),
  getActiveEmployees: () => API.get('/api/time/active'),
  getTimeEntries: (params) => {
    const qs = new URLSearchParams(params).toString();
    return API.get(`/api/time/entries${qs ? '?' + qs : ''}`);
  },
  editTimeEntry: (id, data) => API.put(`/api/time/entries/${id}`, data),
  getTimeDashboard: () => API.get('/api/time/dashboard'),
  createKiosk: (data) => API.post('/api/time/kiosks', data),
  getKiosks: () => API.get('/api/time/kiosks'),
  exportTimesheet: (startDate, endDate) => API.get(`/api/time/export?startDate=${startDate}&endDate=${endDate}`),
  getBreakAlerts: () => API.get('/api/time/break-alerts'),
  getOvertimeWarnings: (weekOf) => API.get(`/api/time/overtime-warnings${weekOf ? '?weekOf=' + weekOf : ''}`),
  getTipSummary: (params) => {
    const qs = new URLSearchParams(params).toString();
    return API.get(`/api/time/tip-summary${qs ? '?' + qs : ''}`);
  },

  // ── Pay Roles ──
  getPayRoles: () => API.get('/api/pay-roles'),
  createPayRole: (data) => API.post('/api/pay-roles', data),
  updatePayRole: (id, data) => API.put(`/api/pay-roles/${id}`, data),
  deletePayRole: (id) => API.delete(`/api/pay-roles/${id}`),

  // ── Stations ──
  getStations: () => API.get('/api/stations'),
  getDefaultStations: (type) => API.get(`/api/stations/defaults${type ? '?type=' + type : ''}`),
  getTemplates: () => API.get('/api/stations/templates'),
  addStation: (data) => API.post('/api/stations', data),
  bulkAddStations: (stations) => API.post('/api/stations/bulk', { stations }),
  updateStation: (id, data) => API.put(`/api/stations/${id}`, data),
  deleteStation: (id) => API.delete(`/api/stations/${id}`),
};
