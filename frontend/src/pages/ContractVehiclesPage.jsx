import { useState, useEffect } from 'react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const VEHICLE_TYPES = [
  { value: 'GWAC', label: 'GWAC' },
  { value: 'BPA', label: 'BPA' },
  { value: 'IDIQ', label: 'IDIQ' },
  { value: 'GSA_Schedule', label: 'GSA Schedule' },
  { value: 'Other', label: 'Other' },
];

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
};

const getStatusColor = (status, endDate) => {
  if (status === 'expired' || (endDate && new Date(endDate) < new Date())) {
    return 'var(--danger)';
  }
  if (endDate) {
    const daysUntilExpiry = Math.floor((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 180) return 'var(--warning)';
  }
  return 'var(--success)';
};

const VehicleCard = ({ vehicle, onEdit, onDelete }) => {
  const status = vehicle.end_date && new Date(vehicle.end_date) < new Date() ? 'expired' : 'active';
  const statusColor = getStatusColor(status, vehicle.end_date);
  const ceiling = parseFloat(vehicle.ceiling_value) || 0;
  const current = parseFloat(vehicle.current_value) || 0;
  const remaining = ceiling - current;
  const utilization = ceiling > 0 ? Math.round((current / ceiling) * 100) : 0;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: 16, fontWeight: 600 }}>{vehicle.name}</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
              {vehicle.vehicle_type}
            </span>
            {vehicle.agency && (
              <span
                style={{
                  fontSize: 12,
                  padding: '0.25rem 0.75rem',
                  background: 'var(--bg3)',
                  color: 'var(--text2)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {vehicle.agency}
              </span>
            )}
            <span
              style={{
                fontSize: 12,
                padding: '0.25rem 0.75rem',
                background: statusColor,
                color: '#fff',
                borderRadius: 'var(--radius)',
                fontWeight: 500,
              }}
            >
              {status === 'expired' ? 'Expired' : 'Active'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onEdit(vehicle)}
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
            onClick={() => onDelete(vehicle.id)}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: 13 }}>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: '0.25rem' }}>Ceiling Value</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(ceiling)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: '0.25rem' }}>Current Value</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(current)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text3)', marginBottom: '0.25rem' }}>Remaining</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{formatCurrency(remaining)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Utilization</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{utilization}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: utilization > 90 ? 'var(--danger)' : utilization > 70 ? 'var(--warning)' : 'var(--success)',
              width: `${utilization}%`,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: 12, color: 'var(--text3)' }}>
        {vehicle.contract_number && <div><strong>Contract:</strong> {vehicle.contract_number}</div>}
        {vehicle.start_date && <div><strong>Start:</strong> {new Date(vehicle.start_date).toLocaleDateString()}</div>}
        {vehicle.end_date && <div><strong>End:</strong> {new Date(vehicle.end_date).toLocaleDateString()}</div>}
      </div>

      {vehicle.notes && <p style={{ margin: '0.75rem 0 0 0', fontSize: 12, color: 'var(--text3)' }}>{vehicle.notes}</p>}
    </div>
  );
};

const VehicleModal = ({ visible, onClose, onSave, loading, initial = null }) => {
  const [form, setForm] = useState(
    initial || {
      name: '',
      vehicle_type: 'GWAC',
      contract_number: '',
      agency: '',
      ceiling_value: '',
      current_value: '',
      start_date: '',
      end_date: '',
      option_years: 0,
      naics_codes: [],
      status: 'active',
      notes: '',
    }
  );

  useEffect(() => {
    if (initial) {
      // Format dates for date input (YYYY-MM-DD)
      const formatDate = (d) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      };
      setForm({
        ...initial,
        start_date: formatDate(initial.start_date),
        end_date: formatDate(initial.end_date),
      });
    }
  }, [initial]);

  const handleSave = () => {
    if (!form.name.trim()) {
      alert('Please enter vehicle name');
      return;
    }
    onSave(form);
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
          {initial ? 'Edit' : 'Add'} Contract Vehicle
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
            Vehicle Name *
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
              Type
            </label>
            <select
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
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
              {VEHICLE_TYPES.map((t) => (
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
            Contract Number
          </label>
          <input
            type="text"
            value={form.contract_number}
            onChange={(e) => setForm({ ...form, contract_number: e.target.value })}
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
              Ceiling Value
            </label>
            <input
              type="number"
              value={form.ceiling_value}
              onChange={(e) => setForm({ ...form, ceiling_value: e.target.value })}
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
              Current Value
            </label>
            <input
              type="number"
              value={form.current_value}
              onChange={(e) => setForm({ ...form, current_value: e.target.value })}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text2)' }}>
              Start Date
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
            {loading ? 'Saving...' : initial ? 'Update' : 'Add'} Vehicle
          </button>
        </div>
      </div>
    </>
  );
};

export default function ContractVehiclesPage() {
  const { addToast } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contract-vehicles');
      setVehicles(res.data?.data || res.data || []);
    } catch (err) {
      addToast('Failed to load vehicles', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEdit = async (form) => {
    try {
      setLoading(true);
      if (editingVehicle) {
        await api.put(`/contract-vehicles/${editingVehicle.id}`, form);
        addToast('Vehicle updated', 'success');
      } else {
        await api.post('/contract-vehicles', form);
        addToast('Vehicle added', 'success');
      }
      setModalOpen(false);
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err) {
      addToast('Failed to save vehicle', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      await api.delete(`/contract-vehicles/${id}`);
      addToast('Vehicle deleted', 'success');
      fetchVehicles();
    } catch (err) {
      addToast('Failed to delete vehicle', 'error');
      console.error(err);
    }
  };

  // Calculate stats
  const totalCeiling = vehicles.reduce((sum, v) => sum + (parseFloat(v.ceiling_value) || 0), 0);
  const activeVehicles = vehicles.filter((v) => !v.end_date || new Date(v.end_date) >= new Date()).length;

  return (
    <Layout>
      <div style={{ padding: '2rem 2.5rem', maxWidth: 1400 }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: 28, fontWeight: 700 }}>Contract Vehicles</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text2)' }}>Track GWACs, BPAs, IDIQs, and GSA Schedules</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Total Vehicles</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{vehicles.length}</div>
          </div>
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Active</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{activeVehicles}</div>
          </div>
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: '0.5rem' }}>Total Ceiling Value</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(totalCeiling)}</div>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => {
              setEditingVehicle(null);
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
            + Add Vehicle
          </button>
        </div>

        <div>
          {vehicles.length > 0 ? (
            <>
              {vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onEdit={(vehicle) => {
                    setEditingVehicle(vehicle);
                    setModalOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </>
          ) : (
            <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '2rem' }}>No vehicles yet. Add your first contract vehicle.</p>
          )}
        </div>

        <VehicleModal
          visible={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingVehicle(null);
          }}
          onSave={handleAddEdit}
          loading={loading}
          initial={editingVehicle}
        />
      </div>
    </Layout>
  );
}
