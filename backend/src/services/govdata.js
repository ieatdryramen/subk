const axios = require('axios');

const SAM_API_KEY = process.env.SAM_API_KEY;
const SAM_BASE = 'https://api.sam.gov/opportunities/v2/search';
const USASPENDING_BASE = 'https://api.usaspending.gov/api/v2';

// Fetch live opportunities from SAM.gov
const searchOpportunities = async ({ naics_codes, keywords, agency, set_aside, limit = 50 }) => {
  try {
    const codes = naics_codes ? naics_codes.split(',').map(c => c.trim()).filter(Boolean) : [];

    // If multiple NAICS codes provided, run parallel searches (up to 3 codes)
    if (codes.length > 1) {
      const codesToSearch = codes.slice(0, 3);
      const searchPromises = codesToSearch.map(code =>
        searchOpportunitiesForCode({ code, keywords, agency, set_aside, limit })
      );

      const results = await Promise.all(searchPromises);
      const allOpps = results.flat();

      // Deduplicate by sam_notice_id
      const dedupMap = {};
      allOpps.forEach(opp => {
        if (!dedupMap[opp.sam_notice_id]) {
          dedupMap[opp.sam_notice_id] = opp;
        }
      });

      return Object.values(dedupMap).slice(0, limit);
    }

    // Single NAICS code or no NAICS
    const singleResult = await searchOpportunitiesForCode({
      code: codes[0] || null,
      keywords,
      agency,
      set_aside,
      limit,
    });

    // If no results and we had an agency filter, try broader search without agency
    if (singleResult.length === 0 && agency) {
      console.log(`No results with agency filter. Retrying broader search without agency...`);
      return await searchOpportunitiesForCode({
        code: codes[0] || null,
        keywords,
        agency: null,
        set_aside,
        limit,
      });
    }

    return singleResult;
  } catch (err) {
    console.error('SAM.gov API error:', err.message);
    // Return mock data if SAM API is unavailable/key not set
    return getMockOpportunities(naics_codes);
  }
};

// Helper: search opportunities for a single NAICS code
const searchOpportunitiesForCode = async ({ code, keywords, agency, set_aside, limit = 50 }) => {
  try {
    const params = {
      api_key: SAM_API_KEY,
      limit,
      offset: 0,
      postedFrom: getDateDaysAgo(90),
      postedTo: getTodayDate(),
      active: 'true',
    };

    if (code) params.naicsCode = code;
    if (keywords) params.keyword = keywords;
    if (agency) params.organizationName = agency;
    if (set_aside && set_aside !== 'all') params.typeOfSetAsideDescription = set_aside;

    const response = await axios.get(SAM_BASE, { params, timeout: 15000 });
    const opps = response.data?.opportunitiesData || [];

    return opps.map(opp => ({
      sam_notice_id: opp.noticeId,
      title: opp.title,
      agency: opp.fullParentPathName?.split('.')[0] || opp.organizationHierarchy?.[0]?.name || 'Unknown Agency',
      sub_agency: opp.fullParentPathName?.split('.')?.[1] || '',
      naics_code: opp.naicsCode,
      set_aside: opp.typeOfSetAsideDescription || '',
      posted_date: opp.postedDate,
      response_deadline: opp.responseDeadLine,
      description: opp.description?.substring(0, 1000) || '',
      place_of_performance: [
        opp.placeOfPerformance?.city?.name,
        opp.placeOfPerformance?.state?.name
      ].filter(Boolean).join(', '),
      primary_contact_name: opp.pointOfContact?.[0]?.fullName || '',
      primary_contact_email: opp.pointOfContact?.[0]?.email || '',
      solicitation_number: opp.solicitationNumber || '',
      opportunity_url: `https://sam.gov/opp/${opp.noticeId}/view`,
    }));
  } catch (err) {
    console.error(`SAM.gov API error for NAICS ${code}:`, err.message);
    return [];
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
    return getMockPrimes(naics_codes);
  }
};

// Helpers
const getTodayDate = () => new Date().toISOString().split('T')[0];
const getDateDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

// Mock data for demo/dev when API keys aren't set
const getMockOpportunities = (naics_codes) => [
  {
    sam_notice_id: 'MOCK-001',
    title: 'IT Support Services for Department of Defense',
    agency: 'Department of Defense',
    sub_agency: 'Defense Information Systems Agency',
    naics_code: naics_codes?.split(',')[0]?.trim() || '541512',
    set_aside: 'Small Business Set-Aside',
    posted_date: getDateDaysAgo(5),
    response_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'The Government requires IT support services including help desk, network management, and cybersecurity monitoring.',
    place_of_performance: 'Arlington, VA',
    primary_contact_name: 'Jane Smith',
    primary_contact_email: 'jane.smith@disa.mil',
    solicitation_number: 'DISA-2026-001',
    opportunity_url: 'https://sam.gov',
  },
  {
    sam_notice_id: 'MOCK-002',
    title: 'Cloud Migration and DevSecOps Support',
    agency: 'Department of Homeland Security',
    sub_agency: 'CISA',
    naics_code: naics_codes?.split(',')[0]?.trim() || '541512',
    set_aside: '8(a) Set-Aside',
    posted_date: getDateDaysAgo(12),
    response_deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    description: 'CISA seeks cloud migration support, DevSecOps implementation, and ongoing operations for mission-critical systems.',
    place_of_performance: 'Washington, DC',
    primary_contact_name: 'Mike Johnson',
    primary_contact_email: 'm.johnson@cisa.dhs.gov',
    solicitation_number: 'CISA-2026-IT-003',
    opportunity_url: 'https://sam.gov',
  },
];

const getMockPrimes = (naics_codes) => [
  {
    company_name: 'Leidos Holdings Inc',
    uei: 'MOCK001',
    agency_focus: 'Department of Defense',
    naics_codes: naics_codes?.split(',')[0]?.trim() || '541512',
    total_awards_value: 4500000000,
    award_count: 47,
    recent_awards: [{ agency: 'DoD', amount: 450000000, date: getDateDaysAgo(30) }],
  },
  {
    company_name: 'SAIC Inc',
    uei: 'MOCK002',
    agency_focus: 'Department of Defense',
    naics_codes: naics_codes?.split(',')[0]?.trim() || '541512',
    total_awards_value: 2100000000,
    award_count: 23,
    recent_awards: [{ agency: 'Army', amount: 210000000, date: getDateDaysAgo(45) }],
  },
  {
    company_name: 'Booz Allen Hamilton',
    uei: 'MOCK003',
    agency_focus: 'Intelligence Community',
    naics_codes: naics_codes?.split(',')[0]?.trim() || '541690',
    total_awards_value: 3800000000,
    award_count: 38,
    recent_awards: [{ agency: 'NSA', amount: 380000000, date: getDateDaysAgo(60) }],
  },
];

module.exports = { searchOpportunities, searchPrimeAwardees, lookupByUEI };

// Look up a firm by UEI — pulls SAM.gov registration data + USASpending award history
async function lookupByUEI(uei) {
  const result = { sam: null, awards: [], totalAwardsValue: 0, awardCount: 0 };

  // 1. SAM.gov entity registration
  try {
    const samRes = await axios.get('https://api.sam.gov/entity-information/v3/entities', {
      params: {
        api_key: SAM_API_KEY || 'DEMO_KEY',
        ueiSAM: uei,
        includeSections: 'entityRegistration,coreData,assertions,repsAndCerts',
      },
      timeout: 10000,
    });
    const entity = samRes.data?.entityData?.[0];
    if (entity) {
      const reg = entity.entityRegistration || {};
      const core = entity.coreData || {};
      const assertions = entity.assertions || {};
      result.sam = {
        legalName: reg.legalBusinessName,
        dbaName: reg.dbaName,
        uei: reg.ueiSAM,
        cageCode: reg.cageCode,
        registrationStatus: reg.registrationStatus,
        activationDate: reg.registrationDate,
        expirationDate: reg.registrationExpirationDate,
        purposeOfRegistration: reg.purposeOfRegistrationDesc,
        naicsCode: core.businessTypes?.primaryNaics,
        naicsList: assertions.goodsAndServices?.naicsList?.map(n => n.naicsCode).join(', '),
        certifications: (() => {
          const certs = [];
          const types = core.businessTypes?.businessTypeList || [];
          const typeMap = {
            '8A': '8(a)', 'HZ': 'HUBZone', '27': 'SDVOSB', 'A5': 'VOSB',
            'OW': 'WOSB', 'WU': 'EDWOSB', 'XS': 'Small Business',
          };
          types.forEach(t => { if (typeMap[t.businessTypeCode]) certs.push(typeMap[t.businessTypeCode]); });
          return certs.join(', ');
        })(),
        physicalAddress: [
          core.physicalAddress?.addressLine1,
          core.physicalAddress?.city,
          core.physicalAddress?.stateOrProvinceCode,
          core.physicalAddress?.zipCode,
        ].filter(Boolean).join(', '),
        state: core.physicalAddress?.stateOrProvinceCode,
        entityStructure: core.businessTypes?.entityStructureDesc,
        congressionalDistrict: core.physicalAddress?.congressionalDistrict,
        website: core.electronicBusinessPOC?.website || '',
      };
    }
  } catch (err) {
    console.log('SAM.gov entity lookup failed:', err.message);
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
