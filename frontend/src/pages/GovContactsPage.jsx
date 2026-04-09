import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ContactCard = ({ contact, onEdit, onDelete, onInteraction }) => {
  const [expanded, setExpanded] = useState(false);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16, fontWeight: 600 }}>{contact.name}</h3>
          {contact.title && <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>{contact.title}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(contact);
            }}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contact.id);
            }}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'var(--danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: 13 }}>
        {contact.agency && (
          <div>
            <span style={{ color: 'var(--text3)' }}>Agency: </span>
            <strong style={{ color: 'var(--text)' }}>{contact.agency}</strong>
          </div>
        )}
        {contact.office && (
          <div>
            <span style={{ color: 'var(--text3)' }}>Office: </span>
            <strong style={{ color: 'var(--text)' }}>{contact.office}</strong>
          </div>
        )}
        {contact.email && (
          <div>
            <span style={{ color: 'var(--text3)' }}>Email: </span>
            <a href={`mailto:${contact.email}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div>
            <span style={{ color: 'var(--text3)' }}>Phone: </span>
            <a href={`tel:${contact.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              {contact.phone}
            </a>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: 12, color: 'var(--text3)', marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <div>
          <span>Last Interaction:</span> <br />
          <strong style={{ color: 'var(--text2)' }}>{formatDate(contact.last_interaction)}</strong>
        </div>
        <div>
          <span>Interaction Count:</span> <br />
          <strong style={{ color: 'var(--text2)' }}>{contact.interaction_count}</strong>
        </div>
      </div>

      {expanded && (
        <>
          {contact.linkedin && (
            <div style={{ marginBottom: '1rem' }}>
              <a
                href={contact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
              >
                LinkedIn Profile →
              </a>
            </div>
          )}
          {contact.notes && (
            <div style={{ marginBottom: '1rem', fontSize: 12, color: 'var(--text2)', background: 'var(--bg3)', padding: '0.75rem', borderRadius: 'var(--radius)' }}>
              <strong>Notes:</strong> <br />
              {contact.notes}
            </div>
          )}
          {contact.tags && contact.tags.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {contact.tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    padding: '0.25rem 0.5rem',
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    marginRight: '0.5rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              onInteraction(contact.id);
            }}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Log Interaction
          </button>
        </>
      )}
    </div>
  );
};

const ContactModal = ({ visible, onClose, onSave, loading, initial = null }) => {
  const [form, setForm] = useState(
    initial || {
      name: '',
      title: '',
      agency: '',
      office: '',
      email: '',
      phone: '',
      linkedin: '',
      notes: '',
      tags: [],
    }
  );

  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (initial) {
      setForm(initial);
    }
  }, [initial]);

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('Please enter contact name');
      return;
    }
    onSave(form);
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    setForm({ ...form, tags: form.tags.filter((_, i) => i !== index) });
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
          maxWidth: 600,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: 20, fontWeight: 600 }}>
          {initial ? 'Edit' : 'Add'} Contact
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              Title
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
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Agency
            </label>
            <input
              type="text"
              value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
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
            Office
          </label>
          <input
            type="text"
            value={form.office}
            onChange={(e) => setForm({ ...form, office: e.target.value })}
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
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              Phone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            LinkedIn URL
          </label>
          <input
            type="url"
            value={form.linkedin}
            onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
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
            Tags
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag..."
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={addTag}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
          {form.tags.length > 0 && (
            <div>
              {form.tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    padding: '0.25rem 0.5rem',
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    borderRadius: 'var(--radius)',
                    marginRight: '0.5rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  {tag}
                  <button
                    onClick={() => removeTag(idx)}
                    style={{
                      marginLeft: '0.25rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Notes
          </label>
          <textarea
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
              minHeight: 80,
              fontFamily: 'inherit',
              resize: 'vertical',
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
            {loading ? 'Saving...' : initial ? 'Update' : 'Add'} Contact
          </button>
        </div>
      </div>
    </>
  );
};

export default function GovContactsPage() {
  const { addToast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/gov-contacts');
      setContacts(res.data || []);
    } catch (err) {
      addToast('Failed to load contacts', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      fetchContacts();
      return;
    }
    try {
      const res = await api.get(`/gov-contacts/search?q=${encodeURIComponent(query)}`);
      setContacts(res.data || []);
    } catch (err) {
      addToast('Search failed', 'error');
      console.error(err);
    }
  };

  const handleAddEdit = async (form) => {
    try {
      setLoading(true);
      if (editingContact) {
        await api.put(`/gov-contacts/${editingContact.id}`, form);
        addToast('Contact updated', 'success');
      } else {
        await api.post('/gov-contacts', form);
        addToast('Contact added', 'success');
      }
      setModalOpen(false);
      setEditingContact(null);
      fetchContacts();
    } catch (err) {
      addToast('Failed to save contact', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try {
      await api.delete(`/gov-contacts/${id}`);
      addToast('Contact deleted', 'success');
      fetchContacts();
    } catch (err) {
      addToast('Failed to delete contact', 'error');
      console.error(err);
    }
  };

  const handleInteraction = async (id) => {
    try {
      const contact = contacts.find((c) => c.id === id);
      await api.put(`/gov-contacts/${id}`, {
        ...contact,
        last_interaction: new Date().toISOString().split('T')[0],
        interaction_count: (contact.interaction_count || 0) + 1,
      });
      addToast('Interaction logged', 'success');
      fetchContacts();
    } catch (err) {
      addToast('Failed to log interaction', 'error');
      console.error(err);
    }
  };

  // Get unique agencies
  const agencies = [...new Set(contacts.map((c) => c.agency).filter(Boolean))];

  // Filter contacts
  let filtered = contacts;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }
  if (agencyFilter) {
    filtered = filtered.filter((c) => c.agency === agencyFilter);
  }

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>Government Contacts</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>Decision-maker database and relationship tracking</p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />

          <select
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
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

          <button
            onClick={() => {
              setEditingContact(null);
              setModalOpen(true);
            }}
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
            + Add Contact
          </button>
        </div>

        <div>
          {filtered.length > 0 ? (
            <>
              {filtered.map((c) => (
                <ContactCard
                  key={c.id}
                  contact={c}
                  onEdit={(contact) => {
                    setEditingContact(contact);
                    setModalOpen(true);
                  }}
                  onDelete={handleDelete}
                  onInteraction={handleInteraction}
                />
              ))}
            </>
          ) : (
            <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '2rem' }}>No contacts found.</p>
          )}
        </div>

        <ContactModal
          visible={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingContact(null);
          }}
          onSave={handleAddEdit}
          loading={loading}
          initial={editingContact}
        />
      </div>
    </Layout>
  );
}
