const axios = require('axios');

const SAM_API_KEY = (process.env.SAM_API_KEY || '').trim();
const SAM_SEARCH_BASE = 'https://sam.gov/api/prod/sgs/v1/search/';
const USASPENDING_BASE = 'https://api.usaspending.gov/api/v2';

// Strip HTML tags from description text
const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '').trim();

// Fetch live opportunities from SAM.gov using internal search API
// Returns { opportunities: [], error: string|null, apiStatus: number|null }
const searchOpportunities = async ({ naics_codes, keywords, agency, set_aside, limit = 50 }) => {
  try {
    const codes = naics_codes ? naics_codes.split(',').map(c => c.trim()).filter(Boolean) : [];

    // Build search query parts
    const queryParts = [];
    if (keywords) queryParts.push(keywords);
    if (codes.length > 0) queryParts.push(codes.join(' '));

    // If no search terms at all, use a broad recent search
    const q = queryParts.length > 0 ? queryParts.join(' ') : '';

    // Build SAM.gov internal search params
    const params = {
      index: 'opp',
      page: 0,
      size: Math.min(limit, 100),
      sort: '-relevance',
      mode: 'search',
      responseType: 'json',
      is_active: 'true',
      random: Date.now(),
    };

    if (q) {
      params.q = q;
      params.qMode = 'ALL';
    } else {
      params.sort = '-modifiedDate';
    }

    // Agency filter — SAM.gov uses organization hierarchy
    if (agency) {
      // Try to filter by adding agency name to the query (SAM.gov internal API filters on org hierarchy)
      if (q) {
        params.q = `${q} ${agency}`;
      } else {
        params.q = agency;
        params.qMode = 'ALL';
      }
    }

    console.log(`SAM.gov search: q="${params.q || '(broad)'}", size=${params.size}`);
    const response = await axios.get(SAM_SEARCH_BASE, { params, timeout: 15000 });
    const results = response.data?._embedded?.results || [];
    const totalRecords = response.data?.page?.totalElements || 0;
    console.log(`SAM.gov returned ${results.length} opportunities (total: ${totalRecords})`);

    // Map to our format
    let mapped = results.map(opp => {
      const orgHierarchy = opp.organizationHierarchy || [];
      const dept = orgHierarchy.find(o => o.level === 1);
      const agencyOrg = orgHierarchy.find(o => o.level === 2);
      const office = orgHierarchy.find(o => o.level >= 4);

      return {
        sam_notice_id: opp._id || opp.parentNoticeId,
        title: opp.title || '',
        agency: dept?.name || 'Unknown Agency',
        sub_agency: agencyOrg?.name || '',
        naics_code: opp.naicsCode || '',
        set_aside: opp.typeOfSetAsideDescription || opp.typeOfSetAside || '',
        posted_date: opp.publishDate ? opp.publishDate.split('T')[0] : '',
        response_deadline: opp.responseDate ? opp.responseDate.split('T')[0] : '',
        description: stripHtml(opp.descriptions?.[0]?.content || '').substring(0, 1000),
        place_of_performance: office?.address ?
          [office.address.city, office.address.state].filter(Boolean).join(', ') : '',
        primary_contact_name: '',
        primary_contact_email: '',
        solicitation_number: opp.solicitationNumber || '',
        opportunity_url: `https://sam.gov/opp/${opp._id || opp.parentNoticeId}/view`,
        notice_type: opp.type?.value || '',
      };
    });

    // Post-filter: NAICS code filtering (if provided, since the search API doesn't have a direct NAICS param)
    if (codes.length > 0 && mapped.length > 0) {
      const naicsFiltered = mapped.filter(opp =>
        codes.some(c => opp.naics_code && opp.naics_code.startsWith(c))
      );
      // Only apply filter if it leaves some results
      if (naicsFiltered.length > 0) {
        mapped = naicsFiltered;
      }
    }

    // Post-filter: set-aside filtering
    if (set_aside && set_aside !== 'all' && mapped.length > 0) {
      const setAsideFiltered = mapped.filter(opp =>
        opp.set_aside && opp.set_aside.toLowerCase().includes(set_aside.toLowerCase())
      );
      if (setAsideFiltered.length > 0) {
        mapped = setAsideFiltered;
      }
    }

    return { opportunities: mapped.slice(0, limit), error: null, apiStatus: 200 };
  } catch (err) {
    const status = err.response?.status;
    console.error('SAM.gov search error:', status, err.message);

    let errorMsg = `SAM.gov returned HTTP ${status || 'timeout'}`;
    if (status === 403) {
      errorMsg = 'SAM.gov search is temporarily restricted.';
    } else if (!status) {
      errorMsg = `SAM.gov connection error: ${err.message}`;
    }

    return { opportunities: [], error: errorMsg, apiStatus: status || null };
  }
};


// Fetch recent prime award winners from USASpending by NAICS
const searchPrimeAwardees = async ({ naics_codes, agency, limit = 20 }) => {
  try {
    const codes = naics_codes ? naics_codes.split(',').map(c => c.trim()).filter(Boolean) : [];

    const payload = {
      filters: {
        time_period: [{ start_date: getDateDaysAgo(365), end_date: getTodayDate() }],
        award_type_codes: ['A', 'B', 'C', 'D'],
        ...(codes.length ? { naics_codes: codes } : {}),
        ...(agency ? { agencies: [{ type: 'awarding', tier: 'toptier', name: agency }] } : {}),
      },
      fields: ['recipient_name', 'award_amount', 'awarding_agency_name', 'naics_code', 'recipient_uei', 'period_of_performance_start_date'],
      sort: 'award_amount',
      order: 'desc',
      limit,
      page: 1,
    };

    const response = await axios.post(`${USASPENDING_BASE}/search/spending_by_award/`, payload, { timeout: 15000 });
    const results = response.data?.results || [];

    // Group by recipient
    const primeMap = {};
    results.forEach(r => {
      const name = r.recipient_name;
      if (!name) return;
      if (!primeMap[name]) {
        primeMap[name] = {
          company_name: name,
          uei: r.recipient_uei,
          agency_focus: r.awarding_agency_name,
          naics_codes: r.naics_code,
          total_awards_value: 0,
          award_count: 0,
          recent_awards: [],
        };
      }
      primeMap[name].total_awards_value += r.award_amount || 0;
      primeMap[name].award_count++;
      primeMap[name].recent_awards.push({
        agency: r.awarding_agency_name,
        amount: r.award_amount,
        date: r.period_of_performance_start_date,
      });
    });

    return Object.values(primeMap).slice(0, limit);
  } catch (err) {
    console.error('USASpending API error:', err.message);
    return [];
  }
};

// Helpers
const getTodayDate = () => new Date().toISOString().split('T')[0];
const getDateDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};


module.exports = { searchOpportunities, searchPrimeAwardees, lookupByUEI };

// Look up a firm by UEI — pulls SAM.gov registration data + USASpending award history
async function lookupByUEI(uei) {
  const result = { sam: null, awards: [], totalAwardsValue: 0, awardCount: 0 };

  // 1. SAM.gov entity registration (try internal API first, fall back to public)
  try {
    // Try SAM.gov internal entity API
    const samRes = await axios.get('https://sam.gov/api/prod/sgs/v1/search/', {
      params: {
        index: 'sam',
        q: uei,
        page: 0,
        size: 1,
        mode: 'search',
        responseType: 'json',
        random: Date.now(),
      },
      timeout: 10000,
    });
    const entity = samRes.data?._embedded?.results?.[0];
    if (entity) {
      result.sam = {
        legalName: entity.legalBusinessName || entity.title,
        dbaName: entity.dbaName || '',
        uei: entity.ueiSAM || uei,
        cageCode: entity.cageCode || '',
        registrationStatus: entity.registrationStatus || '',
        activationDate: entity.registrationDate || '',
        expirationDate: entity.expirationDate || '',
        physicalAddress: entity.physicalAddress || '',
        state: entity.stateCode || '',
        website: entity.website || '',
      };
    }
  } catch (err) {
    console.log('SAM.gov entity lookup failed:', err.message);
    // Fallback to public API if available
    if (SAM_API_KEY) {
      try {
        const samRes = await axios.get('https://api.sam.gov/entity-information/v3/entities', {
          params: {
            api_key: SAM_API_KEY,
            ueiSAM: uei,
            includeSections: 'entityRegistration,coreData,assertions,repsAndCerts',
          },
          timeout: 10000,
        });
        const entity = samRes.data?.entityData?.[0];
        if (entity) {
          const reg = entity.entityRegistration || {};
          const core = entity.coreData || {};
          result.sam = {
            legalName: reg.legalBusinessName,
            dbaName: reg.dbaName,
            uei: reg.ueiSAM,
            cageCode: reg.cageCode,
            registrationStatus: reg.registrationStatus,
            activationDate: reg.registrationDate,
            expirationDate: reg.registrationExpirationDate,
            physicalAddress: [
              core.physicalAddress?.addressLine1,
              core.physicalAddress?.city,
              core.physicalAddress?.stateOrProvinceCode,
              core.physicalAddress?.zipCode,
            ].filter(Boolean).join(', '),
            state: core.physicalAddress?.stateOrProvinceCode,
            website: core.electronicBusinessPOC?.website || '',
          };
        }
      } catch (err2) {
        console.log('SAM.gov public entity API also failed:', err2.message);
      }
    }
  }

  // 2. USASpending — past award history for this UEI
  try {
    const spendRes = await axios.post('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      filters: {
        time_period: [{ start_date: getDateDaysAgo(1825), end_date: getTodayDate() }], // 5 years
        award_type_codes: ['A', 'B', 'C', 'D'],
        recipient_search_text: [uei],
      },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency Name', 'Award Type', 'Description', 'Period of Performance Start Date', 'Period of Performance Current End Date', 'NAICS Code', 'Place of Performance State Code'],
      sort: 'Award Amount',
      order: 'desc',
      limit: 20,
      page: 1,
    }, { timeout: 12000 });

    const awards = spendRes.data?.results || [];
    result.awards = awards.map(a => ({
      awardId: a['Award ID'],
      recipientName: a['Recipient Name'],
      amount: a['Award Amount'],
      agency: a['Awarding Agency Name'],
      type: a['Award Type'],
      description: a['Description'],
      startDate: a['Period of Performance Start Date'],
      endDate: a['Period of Performance Current End Date'],
      naicsCode: a['NAICS Code'],
      state: a['Place of Performance State Code'],
    }));
    result.totalAwardsValue = awards.reduce((s, a) => s + (a['Award Amount'] || 0), 0);
    result.awardCount = awards.length;
  } catch (err) {
    console.log('USASpending UEI lookup failed:', err.message);
  }

  return result;
}
