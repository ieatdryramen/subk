const axios = require('axios');

const BASE_URL = 'https://api.usaspending.gov/api/v2';

// Simple in-memory cache with TTL
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  clear() {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager();

/**
 * Search awards by keyword, agency, NAICS, PSC, date range, and amount
 */
async function searchAwards({
  keyword,
  agency,
  naics,
  psc,
  dateRange,
  minAmount,
  maxAmount,
  page = 1,
  limit = 25,
} = {}) {
  try {
    const cacheKey = `searchAwards_${JSON.stringify({ keyword, agency, naics, psc, dateRange, minAmount, maxAmount, page, limit })}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const payload = {
      filters: {},
      page,
      limit,
    };

    if (keyword) {
      payload.filters.keyword = keyword;
    }
    if (agency) {
      payload.filters.agencies = [{ type: 'awarding', name: agency }];
    }
    if (naics) {
      payload.filters.naics_code = [naics];
    }
    if (psc) {
      payload.filters.psc_code = [psc];
    }
    if (minAmount || maxAmount) {
      payload.filters.award_amount = {};
      if (minAmount) payload.filters.award_amount.lower_bound = minAmount;
      if (maxAmount) payload.filters.award_amount.upper_bound = maxAmount;
    }
    if (dateRange && dateRange.start) {
      if (!payload.filters.date_signed) payload.filters.date_signed = {};
      payload.filters.date_signed.start_date = dateRange.start;
    }
    if (dateRange && dateRange.end) {
      if (!payload.filters.date_signed) payload.filters.date_signed = {};
      payload.filters.date_signed.end_date = dateRange.end;
    }

    const response = await axios.post(
      `${BASE_URL}/search/spending_by_award/`,
      payload,
      { timeout: 10000 }
    );

    const data = {
      total: response.data.total_rows || 0,
      results: response.data.results || [],
    };

    cacheManager.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('USASpending searchAwards error:', err.message);
    return { total: 0, results: [] };
  }
}

/**
 * Get spending by agency for a fiscal year
 */
async function getSpendingByAgency({ fiscalYear, limit = 20 } = {}) {
  try {
    const cacheKey = `spendingByAgency_${fiscalYear}_${limit}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const payload = {
      filters: {},
      limit,
    };

    if (fiscalYear) {
      payload.filters.time_period = [{ fiscal_year: fiscalYear.toString() }];
    }

    const response = await axios.post(
      `${BASE_URL}/spending/`,
      payload,
      { timeout: 10000 }
    );

    const data = {
      total: response.data.total_rows || 0,
      results: response.data.results || [],
    };

    cacheManager.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('USASpending getSpendingByAgency error:', err.message);
    return { total: 0, results: [] };
  }
}

/**
 * Get spending by NAICS code
 */
async function getSpendingByNaics({ fiscalYear, naics, limit = 20 } = {}) {
  try {
    const cacheKey = `spendingByNaics_${fiscalYear}_${naics}_${limit}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const payload = {
      filters: {},
      limit,
    };

    if (fiscalYear) {
      payload.filters.time_period = [{ fiscal_year: fiscalYear.toString() }];
    }
    if (naics) {
      payload.filters.naics_code = [naics];
    }

    const response = await axios.post(
      `${BASE_URL}/spending/`,
      payload,
      { timeout: 10000 }
    );

    const data = {
      total: response.data.total_rows || 0,
      results: response.data.results || [],
    };

    cacheManager.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('USASpending getSpendingByNaics error:', err.message);
    return { total: 0, results: [] };
  }
}

/**
 * Get spending trends across multiple fiscal years
 */
async function getSpendingTrends({ agency, naics, years = 5 } = {}) {
  try {
    const cacheKey = `spendingTrends_${agency}_${naics}_${years}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years;
    const results = [];

    for (let year = startYear; year <= currentYear; year++) {
      try {
        const payload = {
          filters: {
            time_period: [{ fiscal_year: year.toString() }],
          },
          limit: 100,
        };

        if (agency) {
          payload.filters.agencies = [{ type: 'awarding', name: agency }];
        }
        if (naics) {
          payload.filters.naics_code = [naics];
        }

        const response = await axios.post(
          `${BASE_URL}/spending/`,
          payload,
          { timeout: 10000 }
        );

        results.push({
          fiscal_year: year,
          total_rows: response.data.total_rows || 0,
          results: response.data.results || [],
        });
      } catch (err) {
        console.error(`Error fetching trends for year ${year}:`, err.message);
        results.push({
          fiscal_year: year,
          total_rows: 0,
          results: [],
        });
      }
    }

    cacheManager.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error('USASpending getSpendingTrends error:', err.message);
    return [];
  }
}

/**
 * Get agency budget information
 */
async function getAgencyBudget({ agencyCode } = {}) {
  try {
    if (!agencyCode) {
      return { agency_code: null, budgetary_resources: [] };
    }

    const cacheKey = `agencyBudget_${agencyCode}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const response = await axios.get(
      `${BASE_URL}/agency/${agencyCode}/budgetary_resources/`,
      { timeout: 10000 }
    );

    const data = {
      agency_code: agencyCode,
      budgetary_resources: response.data.results || [],
    };

    cacheManager.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('USASpending getAgencyBudget error:', err.message);
    return { agency_code: agencyCode || null, budgetary_resources: [] };
  }
}

module.exports = {
  searchAwards,
  getSpendingByAgency,
  getSpendingByNaics,
  getSpendingTrends,
  getAgencyBudget,
  cacheManager,
};
