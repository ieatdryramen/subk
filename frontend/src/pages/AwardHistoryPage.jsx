import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Skeleton loader for cards
const SkeletonCard = () => (
  <div
    style={{
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      animation: 'pulse 2s infinite',
    }}
  >
    <div style={{ height: 20, background: 'var(--bg3)', borderRadius: 4, marginBottom: 12 }} />
    <div style={{ height: 16, background: 'var(--bg3)', borderRadius: 4, marginBottom: 8 }} />
    <div style={{ height: 16, background: 'var(--bg3)', borderRadius: 4, width: '80%' }} />
  </div>
);

export default function AwardHistoryPage() {
  const { addToast } = useToast();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalResults, setTotalResults] = useState(0);

  // Filter states
  const [keyword, setKeyword] = useState('');
  const [agency, setAgency] = useState('');
  const [naics, setNaics] = useState('');
  const [psc, setPsc] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const handleSearch = async () => {
    // Validate at least one filter is filled
    if (!keyword && !agency && !naics && !psc && !dateFrom && !dateTo && !minAmount && !maxAmount) {
      addToast('Please enter at least one search filter', 'warning');
      return;
    }
    try {
      setLoading(true);
      setPage(1);

      const res = await api.get('/awards/search', {
        params: {
          keyword,
          agency,
          naics,
          psc,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          page: 1,
          limit,
        },
      });

      setResults(res.data.awards || []);
      setTotalResults(res.data.total || 0);
    } catch (err) {
      addToast('Search failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadContractorDetails = async (contractorName) => {
    try {
      const res = await api.get(`/awards/contractor/${encodeURIComponent(contractorName)}`);
      // This would show more detailed info in an expanded view
      addToast(`Loaded details for ${contractorName}`, 'success');
    } catch (err) {
      addToast('Failed to load contractor details', 'error');
    }
  };

  const handlePaginationChange = async (newPage) => {
    try {
      setLoading(true);
      const res = await api.get('/awards/search', {
        params: {
          keyword,
          agency,
          naics,
          psc,
          dateFrom,
          dateTo,
          minAmount,
          maxAmount,
          page: newPage,
          limit,
        },
      });
      setResults(res.data.awards || []);
      setPage(newPage);
    } catch (err) {
      addToast('Failed to load page', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalResults / limit);

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
            Award History
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
            Federal contract award database powered by USASpending
          </p>
        </div>

        {/* Search Bar */}
        <div
          style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Keyword / Contractor
              </label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="e.g., Acme Corp"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Agency
              </label>
              <input
                type="text"
                value={agency}
                onChange={e => setAgency(e.target.value)}
                placeholder="e.g., DoD"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                NAICS Code
              </label>
              <input
                type="text"
                value={naics}
                onChange={e => setNaics(e.target.value)}
                placeholder="e.g., 541330"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                PSC Code
              </label>
              <input
                type="text"
                value={psc}
                onChange={e => setPsc(e.target.value)}
                placeholder="e.g., J001"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Min Amount
              </label>
              <input
                type="number"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                placeholder="$0"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                Max Amount
              </label>
              <input
                type="number"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                placeholder="$10M"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'var(--accent)',
              color: '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => !loading && (e.target.style.opacity = '0.9')}
            onMouseLeave={e => !loading && (e.target.style.opacity = '1')}
          >
            {loading ? 'Searching...' : 'Search Awards'}
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : results.length === 0 && keyword === '' ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--bg2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 8 }}>
              Enter search criteria and click "Search Awards" to find contract awards
            </div>
          </div>
        ) : results.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--bg2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 16, color: 'var(--text2)' }}>
              No awards found matching your search
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: 16,
                marginBottom: '2rem',
              }}
            >
              {results.map((award, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setExpandedId(expandedId === idx ? null : idx)}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(20,184,166,0.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>
                    {award.contractor_name}
                  </h3>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Agency:</span> {award.agency}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Amount:</span>{' '}
                      <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{formatCurrency(award.award_amount)}</span>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>Date:</span> {formatDate(award.award_date)}
                    </div>
                    {award.contract_type && (
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>Type:</span> {award.contract_type}
                      </div>
                    )}
                  </div>

                  {award.set_aside && (
                    <div
                      style={{
                        padding: '6px 10px',
                        background: 'var(--accent-bg)',
                        borderRadius: 'var(--radius)',
                        fontSize: 11,
                        color: 'var(--accent2)',
                        fontWeight: 600,
                        marginBottom: 12,
                        display: 'inline-block',
                      }}
                    >
                      Set-Aside: {award.set_aside}
                    </div>
                  )}

                  {expandedId === idx && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {award.naics && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>
                            NAICS:
                          </span>{' '}
                          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{award.naics}</span>
                        </div>
                      )}
                      {award.psc && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>
                            PSC:
                          </span>{' '}
                          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{award.psc}</span>
                        </div>
                      )}
                      {award.period_of_performance && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase' }}>
                            Period:
                          </span>{' '}
                          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{award.period_of_performance}</span>
                        </div>
                      )}
                      {award.description && (
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                            Description:
                          </span>
                          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
                            {award.description}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                marginTop: '2rem',
              }}
            >
              <button
                onClick={() => handlePaginationChange(page - 1)}
                disabled={page === 1}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: page === 1 ? 'var(--bg3)' : 'var(--bg2)',
                  color: 'var(--text2)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Previous
              </button>

              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
                Page {page} of {totalPages} ({totalResults} results)
              </div>

              <button
                onClick={() => handlePaginationChange(page + 1)}
                disabled={page >= totalPages}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: page >= totalPages ? 'var(--bg3)' : 'var(--bg2)',
                  color: 'var(--text2)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Next
              </button>

              <select
                value={limit}
                onChange={e => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
