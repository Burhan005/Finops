const API_BASE = '/api';

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
    this.isSessionExpired = true;
  }
}

const rawFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

async function authFetch(input, init = {}) {
  let res;
  try {
    res = await rawFetch(input, init);
  } catch (err) {
    throw new Error('Network error: Unable to connect to ZORVEX service. Check connection or backend status.');
  }

  if (res.status === 401) {
    const urlStr = typeof input === 'string' ? input : (input?.url || '');
    if (!urlStr.includes('/auth/login') && !urlStr.includes('/auth/register')) {
      localStorage.removeItem('finops_token');
      localStorage.removeItem('finops_user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('finops_auth_expired'));
      }
      throw new SessionExpiredError();
    }
  }

  return res;
}

// Route all module API calls through authFetch for unified 401 & error handling
const fetch = authFetch;

function authHeaders(extraHeaders = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('finops_token') : null;
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const inFlightGets = new Map();

async function memoizedGet(url, headers = {}) {
  const cacheKey = `${url}:${headers['Authorization'] || ''}`;
  if (inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey);
  }
  const promise = (async () => {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Request failed with status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      inFlightGets.delete(cacheKey);
      throw err;
    } finally {
      setTimeout(() => inFlightGets.delete(cacheKey), 1500);
    }
  })();
  inFlightGets.set(cacheKey, promise);
  return promise;
}

export const api = {
  async getHealth() {
    return memoizedGet(`${API_BASE}/health`, authHeaders());
  },

  async getDatasets() {
    return memoizedGet(`${API_BASE}/datasets`, authHeaders());
  },

  async selectDataset(filename) {
    inFlightGets.clear();
    const res = await fetch(`${API_BASE}/datasets/select`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ filename })
    });
    if (!res.ok) throw new Error('Failed to select dataset');
    return res.json();
  },

  async uploadFile(fileOrFiles) {
    inFlightGets.clear();
    const formData = new FormData();
    if (Array.isArray(fileOrFiles)) {
      fileOrFiles.forEach(f => formData.append('files', f));
    } else {
      formData.append('file', fileOrFiles);
      formData.append('files', fileOrFiles);
    }
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async getOverview(startDate = null, endDate = null, accountId = null, service = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (accountId && accountId !== 'all') params.append('account_id', accountId);
    if (service && service !== 'All') params.append('service', service);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return memoizedGet(`${API_BASE}/overview${qs}`, authHeaders());
  },

  async getTrends(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return memoizedGet(`${API_BASE}/trends${qs}`, authHeaders());
  },

  async compareDates(baseline_date, target_date, account_id = null) {
    const res = await fetch(`${API_BASE}/compare`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ baseline_date, target_date, account_id })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to compare dates');
    }
    return res.json();
  },

  async getDailyDelta(target_date, baseline_date = null, account_id = null) {
    const res = await fetch(`${API_BASE}/analytics/daily-delta`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ target_date, baseline_date, account_id })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to calculate daily delta');
    }
    return res.json();
  },

  async getMonthlyComparison(baseline_month, target_month, account_id = null) {
    const res = await fetch(`${API_BASE}/analytics/monthly-comparison`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ baseline_month, target_month, account_id })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to compare months');
    }
    return res.json();
  },

  async getRootCause({ baseline_start, baseline_end, target_start, target_end, service = null, account_id = null, min_delta = 0.001 }) {
    const res = await fetch(`${API_BASE}/analytics/root-cause`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        baseline_start,
        baseline_end,
        target_start,
        target_end,
        service: service && service !== 'All' ? service : null,
        account_id: account_id && account_id !== 'all' ? account_id : null,
        min_delta
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to analyze cost root cause');
    }
    return res.json();
  },

  async getCacheStats() {
    const res = await fetch(`${API_BASE}/system/cache-stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch cache statistics');
    return res.json();
  },

  async createExportTicket(format = 'html', baseline_date = null, target_date = null, account_id = null) {
    const res = await fetch(`${API_BASE}/export/ticket`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        format,
        baseline_date,
        target_date,
        account_id: account_id && account_id !== 'all' ? account_id : null
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create export ticket');
    }
    return res.json();
  },

  async downloadExecutiveExcel(baseline_date = null, target_date = null, account_id = null) {
    const params = new URLSearchParams();
    params.append('format', 'excel');
    if (baseline_date) params.append('baseline_date', baseline_date);
    if (target_date) params.append('target_date', target_date);
    if (account_id && account_id !== 'all') params.append('account_id', account_id);

    const res = await fetch(`${API_BASE}/export/executive-report?${params.toString()}`, {
      headers: authHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to download Excel report');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ZORVEX_Executive_FinOps_Report_${target_date || 'latest'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  getTicketExportUrl(ticket) {
    return `${API_BASE}/export/executive-report?ticket=${encodeURIComponent(ticket)}`;
  },

  getExportReportUrl(format = 'html', baseline_date = null, target_date = null, account_id = null) {
    const params = new URLSearchParams();
    params.append('format', format);
    if (baseline_date) params.append('baseline_date', baseline_date);
    if (target_date) params.append('target_date', target_date);
    if (account_id && account_id !== 'all') params.append('account_id', account_id);
    return `${API_BASE}/export/executive-report?${params.toString()}`;
  },

  async getS3Config() {
    const res = await fetch(`${API_BASE}/s3/config`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch S3 config');
    return res.json();
  },

  async saveS3Config(config) {
    const res = await fetch(`${API_BASE}/s3/config`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save S3 configuration');
    return res.json();
  },

  async triggerS3Sync() {
    const res = await fetch(`${API_BASE}/s3/sync`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to synchronize with S3');
    }
    return res.json();
  },

  async getRecommendations() {
    const res = await fetch(`${API_BASE}/recommendations`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  },

  async getResources(options = {}, legacyService = null, legacyMinCost = null, legacyAccount = null) {
    // Support legacy positional calls: api.getResources(query, service, min_cost, account_id)
    if (typeof options === 'string') {
      const p_query = options || '';
      const p_service = legacyService || 'All';
      const p_min_cost = legacyMinCost;
      const p_account = legacyAccount || 'all';
      const params = new URLSearchParams();
      if (p_query) params.append('query', p_query);
      if (p_service && p_service !== 'All') params.append('service', p_service);
      if (p_account && p_account !== 'all') params.append('account_id', p_account);
      if (p_min_cost !== null && p_min_cost !== undefined && p_min_cost !== '') params.append('min_cost', p_min_cost);
      params.append('page_size', '100');
      const res = await fetch(`${API_BASE}/resources?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch resources');
      return res.json();
    }

    const {
      query = '',
      service = 'All',
      category = 'ALL',
      account_id = 'all',
      region = 'all',
      min_cost = null,
      start_date = null,
      end_date = null,
      sort_by = 'cost',
      sort_order = 'desc',
      page = 1,
      page_size = 25
    } = options;

    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (service && service !== 'All') params.append('service', service);
    if (category && category !== 'ALL') params.append('category', category);
    if (account_id && account_id !== 'all') params.append('account_id', account_id);
    if (region && region !== 'all') params.append('region', region);
    if (min_cost !== null && min_cost !== undefined && min_cost !== '') params.append('min_cost', min_cost);
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    if (sort_by) params.append('sort_by', sort_by);
    if (sort_order) params.append('sort_order', sort_order);
    params.append('page', String(page));
    params.append('page_size', String(page_size));

    const res = await fetch(`${API_BASE}/resources?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch resources');
    return res.json();
  },

  async getResourceHierarchies() {
    const res = await fetch(`${API_BASE}/resources/hierarchies`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch resource hierarchies');
    return res.json();
  },

  async getResourceDetail(resourceId) {
    const params = new URLSearchParams();
    params.append('resource_id', resourceId);
    const res = await fetch(`${API_BASE}/resources/detail?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch resource detail');
    return res.json();
  },

  async getBranding() {
    const res = await fetch(`${API_BASE}/branding`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch branding configuration');
    return res.json();
  },

  async saveBranding(config) {
    const res = await fetch(`${API_BASE}/branding`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save branding configuration');
    return res.json();
  },

  async getUnitEconomics() {
    const res = await fetch(`${API_BASE}/unit-economics`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch unit economics');
    return res.json();
  },

  async saveUnitEconomics(config) {
    const res = await fetch(`${API_BASE}/unit-economics`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save unit economics');
    return res.json();
  },

  async simulateSavingsPlan(commitment_hourly = null, term_years = 1, payment_option = 'NO_UPFRONT', plan_type = 'COMPUTE_SP', reserved_units = null, account_id = null, region = null) {
    const res = await fetch(`${API_BASE}/simulator/savings-plans`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ commitment_hourly, term_years, payment_option, plan_type, reserved_units, account_id, region })
    });
    if (!res.ok) throw new Error('Failed to simulate savings plans');
    return res.json();
  },

  async getForexRate() {
    const res = await fetch(`${API_BASE}/forex/usd-inr`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch forex rate');
    return res.json();
  },

  // Cost Anomaly Detection
  async getAnomalies(status = null, severity = null) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (severity && severity !== 'all') params.append('severity', severity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/anomalies${qs}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch anomaly alerts');
    return res.json();
  },

  async acknowledgeAnomaly(alertId, userName = 'Admin', notes = '') {
    const res = await fetch(`${API_BASE}/anomalies/${alertId}/acknowledge`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_name: userName, notes })
    });
    if (!res.ok) throw new Error('Failed to acknowledge anomaly');
    return res.json();
  },

  async resolveAnomaly(alertId, userName = 'Admin', notes = '') {
    const res = await fetch(`${API_BASE}/anomalies/${alertId}/resolve`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_name: userName, notes })
    });
    if (!res.ok) throw new Error('Failed to resolve anomaly');
    return res.json();
  },

  async syncAnomalies() {
    const res = await fetch(`${API_BASE}/anomalies/sync`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    });
    if (!res.ok) throw new Error('Failed to trigger anomaly synchronization');
    return res.json();
  },

  // Forecasting & Budget Guard
  async getForecast() {
    const res = await fetch(`${API_BASE}/forecast`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch cost forecast');
    return res.json();
  },

  async getBudgets() {
    const res = await fetch(`${API_BASE}/budgets`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    return res.json();
  },

  async createBudget(budgetData) {
    const res = await fetch(`${API_BASE}/budgets`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(budgetData)
    });
    if (!res.ok) throw new Error('Failed to create budget');
    return res.json();
  },

  async deleteBudget(budgetId) {
    const res = await fetch(`${API_BASE}/budgets/${budgetId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete budget');
    return res.json();
  },

  // Executive Savings Ledger
  async getLedgerRecords(status = null, category = null) {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (category && category !== 'all') params.append('category', category);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/ledger/records${qs}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch savings ledger records');
    return res.json();
  },

  async getLedgerSummary() {
    const res = await fetch(`${API_BASE}/ledger/summary`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch savings ledger summary');
    return res.json();
  },

  async syncLedger() {
    const res = await fetch(`${API_BASE}/ledger/sync`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' })
    });
    if (!res.ok) throw new Error('Failed to trigger ledger synchronization');
    return res.json();
  },

  async updateRecommendationStatus(recId, status, userName = 'Admin', notes = '') {
    const res = await fetch(`${API_BASE}/recommendations/${recId}/status`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status, user_name: userName, notes })
    });
    if (!res.ok) throw new Error('Failed to update recommendation status');
    return res.json();
  },

  // Ask ZORVEX AI Analyst
  async askAiAnalyst(query) {
    const res = await fetch(`${API_BASE}/ai/query`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error('Failed to query AI analyst');
    return res.json();
  },

  async getAiHistory() {
    const res = await fetch(`${API_BASE}/ai/history`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI query history');
    return res.json();
  },

  // Auth APIs
  async register(name, company, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('finops_token', data.token);
      localStorage.setItem('finops_user', JSON.stringify(data.user));
    }
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('finops_token', data.token);
      localStorage.setItem('finops_user', JSON.stringify(data.user));
    }
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch user session');
    return res.json();
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders()
      });
    } catch (e) {
      // ignore
    }
    inFlightGets.clear();
    localStorage.removeItem('finops_token');
    localStorage.removeItem('finops_user');
    return { success: true };
  },

  async forgotPassword(email) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to process password recovery');
    }
    return res.json();
  },

  async resetPassword(email, password, token = '') {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, token })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to reset password');
    }
    return res.json();
  }
};

