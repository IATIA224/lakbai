import React, { useState, useEffect } from 'react';
import './trip.css';

const Trip = () => {
  const [trips, setTrips] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStatsCard, setShowStatsCard] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    location: '',
    arrivalDate: '',
    departureDate: '',
    budget: '',
    status: 'Upcoming',
    accommodation: '',
    transport: '',
    activities: [],
    notes: ''
  });

  // Load data from localStorage
  useEffect(() => {
    const savedTrips = localStorage.getItem('trips');
    if (savedTrips) {
      setTrips(JSON.parse(savedTrips));
    }
  }, []);

  // Save trips to localStorage
  useEffect(() => {
    localStorage.setItem('trips', JSON.stringify(trips));
  }, [trips]);

  const handleAddDestination = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.location) {
      alert('Please fill in required fields');
      return;
    }

    const newDestination = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString()
    };

    setTrips([...trips, newDestination]);
    setFormData({
      name: '',
      region: '',
      location: '',
      arrivalDate: '',
      departureDate: '',
      budget: '',
      status: 'Upcoming',
      accommodation: '',
      transport: '',
      activities: [],
      notes: ''
    });
    setShowAddModal(false);
  };

  const handleDeleteDestination = (id) => {
    if (window.confirm('Are you sure you want to remove this destination?')) {
      setTrips(trips.filter(trip => trip.id !== id));
    }
  };

  const handleUpdateStatus = (id) => {
    const statusFlow = ['Upcoming', 'Ongoing', 'Completed', 'Upcoming'];
    setTrips(trips.map(trip => {
      if (trip.id === id) {
        const currentIndex = statusFlow.indexOf(trip.status);
        return { ...trip, status: statusFlow[(currentIndex + 1) % statusFlow.length] };
      }
      return trip;
    }));
  };

  const handleMarkAllComplete = () => {
    setTrips(trips.map(trip => ({ ...trip, status: 'Completed' })));
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all destinations? This cannot be undone.')) {
      setTrips([]);
    }
  };

  const filteredTrips = trips.filter(trip => {
    const matchStatus = filterStatus === 'All' || trip.status === filterStatus;
    const matchSearch = trip.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const calculateDuration = (start, end) => {
    if (!start || !end) return 0;
    const diff = new Date(end) - new Date(start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const totalBudget = trips.reduce((sum, trip) => sum + (parseFloat(trip.budget) || 0), 0);
  const upcomingCount = trips.filter(t => t.status === 'Upcoming').length;
  const ongoingCount = trips.filter(t => t.status === 'Ongoing').length;
  const completedCount = trips.filter(t => t.status === 'Completed').length;

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Upcoming': return 'badge-upcoming';
      case 'Ongoing': return 'badge-ongoing';
      case 'Completed': return 'badge-completed';
      default: return '';
    }
  };

  return (
    <div className="trip-container">
      {/* Header */}
      <header className="trip-header">
        <h1>🎯 Trip Planner</h1>
        <p>Plan your next adventure</p>
      </header>

      {/* Stats Card */}
      {showStatsCard && (
        <div className="stats-card">
          <div className="stats-grid">
            <div className="stat-item stat-blue">
              <span className="stat-icon">📍</span>
              <div>
                <p className="stat-label">Destinations</p>
                <p className="stat-value">{trips.length}</p>
              </div>
            </div>
            <div className="stat-item stat-green">
              <span className="stat-icon">💰</span>
              <div>
                <p className="stat-label">Total Budget</p>
                <p className="stat-value">${totalBudget.toFixed(2)}</p>
              </div>
            </div>
            <div className="stat-item stat-purple">
              <span className="stat-icon">✅</span>
              <div>
                <p className="stat-label">Completed</p>
                <p className="stat-value">{completedCount}</p>
              </div>
            </div>
            <div className="stat-item stat-orange">
              <span className="stat-icon">🚀</span>
              <div>
                <p className="stat-label">Ongoing</p>
                <p className="stat-value">{ongoingCount}</p>
              </div>
            </div>
          </div>
          <button className="close-stats" onClick={() => setShowStatsCard(false)}>×</button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="search-filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search destinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-buttons">
          {['All', 'Upcoming', 'Ongoing', 'Completed'].map(status => (
            <button
              key={status}
              className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Add Destination
        </button>
        <button className="btn btn-secondary" onClick={handleMarkAllComplete}>
          ✅ Mark All Complete
        </button>
        <button className="btn btn-danger" onClick={handleClearAll}>
          🗑️ Clear All
        </button>
      </div>

      {/* Add Destination Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Destination</h2>
            <form onSubmit={handleAddDestination}>
              <div className="form-group">
                <label>Destination Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Paris, Tokyo"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Region/Country</label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({...formData, region: e.target.value})}
                    placeholder="e.g., France, Japan"
                  />
                </div>
                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Address or coordinates"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Arrival Date</label>
                  <input
                    type="date"
                    value={formData.arrivalDate}
                    onChange={(e) => setFormData({...formData, arrivalDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Departure Date</label>
                  <input
                    type="date"
                    value={formData.departureDate}
                    onChange={(e) => setFormData({...formData, departureDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated Budget</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    placeholder="$0.00"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option>Upcoming</option>
                    <option>Ongoing</option>
                    <option>Completed</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Accommodation Type</label>
                <input
                  type="text"
                  value={formData.accommodation}
                  onChange={(e) => setFormData({...formData, accommodation: e.target.value})}
                  placeholder="e.g., Hotel, Airbnb, Hostel"
                />
              </div>

              <div className="form-group">
                <label>Transportation Mode</label>
                <select
                  value={formData.transport}
                  onChange={(e) => setFormData({...formData, transport: e.target.value})}
                >
                  <option value="">Select mode...</option>
                  <option>Flight</option>
                  <option>Train</option>
                  <option>Bus</option>
                  <option>Car</option>
                  <option>Ferry</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Add any additional notes..."
                  rows="3"
                />
              </div>

              <div className="modal-buttons">
                <button type="submit" className="btn btn-primary">Save Destination</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destinations List */}
      <div className="destinations-section">
        {filteredTrips.length === 0 ? (
          <div className="empty-state">
            <p>📭 No destinations found</p>
            <p className="empty-subtitle">Start planning by adding your first destination!</p>
          </div>
        ) : (
          <div className="destinations-grid">
            {filteredTrips.map(trip => {
              const duration = calculateDuration(trip.arrivalDate, trip.departureDate);
              return (
                <div key={trip.id} className="destination-card">
                  <div className="card-header">
                    <h3>{trip.name}</h3>
                    <span className={`badge ${getStatusBadgeClass(trip.status)}`}>
                      {trip.status}
                    </span>
                  </div>

                  <div className="card-body">
                    {trip.region && <p><strong>Region:</strong> {trip.region}</p>}
                    {trip.location && <p><strong>📍 Location:</strong> {trip.location}</p>}
                    
                    {trip.arrivalDate && (
                      <p><strong>📅 Arrival:</strong> {new Date(trip.arrivalDate).toLocaleDateString()}</p>
                    )}
                    {trip.departureDate && (
                      <p><strong>📅 Departure:</strong> {new Date(trip.departureDate).toLocaleDateString()}</p>
                    )}
                    {duration > 0 && <p><strong>⏱️ Duration:</strong> {duration} days</p>}
                    
                    {trip.budget && <p><strong>💰 Budget:</strong> ${parseFloat(trip.budget).toFixed(2)}</p>}
                    {trip.accommodation && <p><strong>🏨 Accommodation:</strong> {trip.accommodation}</p>}
                    {trip.transport && <p><strong>✈️ Transport:</strong> {trip.transport}</p>}
                    {trip.notes && <p><strong>📝 Notes:</strong> {trip.notes}</p>}
                  </div>

                  <div className="card-footer">
                    <button 
                      className="btn-small btn-status"
                      onClick={() => handleUpdateStatus(trip.id)}
                      title="Cycle through statuses"
                    >
                      🔄 Change Status
                    </button>
                    <button 
                      className="btn-small btn-danger"
                      onClick={() => handleDeleteDestination(trip.id)}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button 
        className="fab"
        onClick={() => setShowAddModal(true)}
        title="Add new destination"
      >
        ➕
      </button>
    </div>
  );
};

export default Trip;