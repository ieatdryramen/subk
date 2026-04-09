import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const EVENT_TYPES = [
  { value: 'industry_day', label: 'Industry Day' },
  { value: 'conference', label: 'Conference' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'networking', label: 'Networking' },
];

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const EventCard = ({ event, onRsvp, onDelete }) => {
  const [rsvpDropdown, setRsvpDropdown] = useState(false);

  const eventTypeObj = EVENT_TYPES.find((t) => t.value === event.event_type);
  const eventTypeLabel = eventTypeObj?.label || event.event_type || 'Event';

  const rsvpColor =
    event.rsvp_status === 'going'
      ? 'var(--success)'
      : event.rsvp_status === 'maybe'
        ? 'var(--warning)'
        : 'var(--text2)';

  return (
    <div
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16, fontWeight: 600 }}>{event.title}</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span
              style={{
                fontSize: 12,
                padding: '0.25rem 0.75rem',
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                borderRadius: 'var(--radius)',
                fontWeight: 500,
              }}
            >
              {eventTypeLabel}
            </span>
            {event.agency && (
              <span
                style={{
                  fontSize: 12,
                  padding: '0.25rem 0.75rem',
                  background: 'var(--bg3)',
                  color: 'var(--text2)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {event.agency}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
          <button
            onClick={() => setRsvpDropdown(!rsvpDropdown)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              color: rsvpColor,
              fontWeight: 500,
            }}
          >
            {event.rsvp_status === 'going' ? '✓ Going' : event.rsvp_status === 'maybe' ? '? Maybe' : 'RSVP'}
          </button>
          {rsvpDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                zIndex: 10,
                minWidth: 120,
              }}
            >
              {['going', 'maybe', 'not_going'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onRsvp(event.id, status);
                    setRsvpDropdown(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--text)',
                  }}
                >
                  {status === 'going' ? '✓ Going' : status === 'maybe' ? '? Maybe' : 'Not Going'}
                </button>
              ))}
            </div>
          )}
          {!event.is_global && (
            <button
              onClick={() => onDelete(event.id)}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--danger)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          fontSize: 13,
          color: 'var(--text2)',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <strong>Date:</strong> {formatDate(event.start_date)}
          {event.end_date && event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
        </div>
        {event.location && (
          <div>
            <strong>Location:</strong> {event.location}
          </div>
        )}
      </div>

      {event.description && (
        <p style={{ margin: '0.75rem 0', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{event.description}</p>
      )}

      {event.notes && (
        <p style={{ margin: '0.5rem 0 0 0', fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Notes: {event.notes}</p>
      )}

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
        >
          View Event →
        </a>
      )}
    </div>
  );
};

const AddEventModal = ({ visible, onClose, onSave, loading }) => {
  const [form, setForm] = useState({
    title: '',
    event_type: 'conference',
    agency: '',
    location: '',
    start_date: '',
    end_date: '',
    url: '',
    description: '',
    notes: '',
  });

  const handleSave = () => {
    if (!form.title.trim() || !form.start_date) {
      alert('Please enter event title and start date');
      return;
    }
    onSave(form);
    setForm({
      title: '',
      event_type: 'conference',
      agency: '',
      location: '',
      start_date: '',
      end_date: '',
      url: '',
      description: '',
      notes: '',
    });
  };

  if (!visible) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          zIndex: 1000,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 600 }}>Add Event</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Event Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Type
            </label>
            <select
              value={form.event_type}
              onChange={(e) => setForm({ ...form, event_type: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Agency
            </label>
            <input
              type="text"
              value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
              placeholder="e.g., Army, Air Force"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g., Washington, DC"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Start Date *
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              End Date
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Event URL
          </label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
              minHeight: 80,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Notes
          </label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Add Event'}
          </button>
        </div>
      </div>
    </>
  );
};

export default function GovConEventsPage() {
  const { addToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState({ type: '', agency: '', month: '' });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/events');
      setEvents(res.data || []);
    } catch (err) {
      addToast('Failed to load events', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (form) => {
    try {
      setLoading(true);
      await api.post('/events', form);
      addToast('Event added successfully', 'success');
      setModalOpen(false);
      fetchEvents();
    } catch (err) {
      addToast('Failed to add event', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (eventId, status) => {
    try {
      const event = events.find((e) => e.id === eventId);
      await api.put(`/events/${eventId}`, { ...event, rsvp_status: status });
      addToast('RSVP updated', 'success');
      fetchEvents();
    } catch (err) {
      addToast('Failed to update RSVP', 'error');
      console.error(err);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    try {
      await api.delete(`/events/${eventId}`);
      addToast('Event deleted', 'success');
      fetchEvents();
    } catch (err) {
      addToast('Failed to delete event', 'error');
      console.error(err);
    }
  };

  const handleSeedEvents = async () => {
    try {
      setLoading(true);
      await api.post('/events/seed', {});
      addToast('Common GovCon events seeded', 'success');
      fetchEvents();
    } catch (err) {
      addToast('Failed to seed events', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (filter.type && event.event_type !== filter.type) return false;
    if (filter.agency && !event.agency?.includes(filter.agency)) return false;
    return true;
  });

  const agencies = [...new Set(events.map((e) => e.agency).filter(Boolean))];
  const types = [...new Set(events.map((e) => e.event_type).filter(Boolean))];

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>GovCon Events</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>Industry days, conferences, and networking opportunities</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setModalOpen(true)}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            + Add Event
          </button>

          <button
            onClick={handleSeedEvents}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Seed Events
          </button>

          <select
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
            style={{
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPES.find((x) => x.value === t)?.label || t}
              </option>
            ))}
          </select>

          <select
            value={filter.agency}
            onChange={(e) => setFilter({ ...filter, agency: e.target.value })}
            style={{
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="">All Agencies</option>
            {agencies.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div>{filteredEvents.length > 0 ? <>{filteredEvents.map((e) => (
          <EventCard key={e.id} event={e} onRsvp={handleRsvp} onDelete={handleDelete} />
        ))}</> : <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '2rem' }}>No events found</p>}</div>

        <AddEventModal visible={modalOpen} onClose={() => setModalOpen(false)} onSave={handleAddEvent} loading={loading} />
      </div>
    </Layout>
  );
}
