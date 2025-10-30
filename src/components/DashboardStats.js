import React, { useEffect, useState } from 'react';
import { useUserDashboardStats } from '../hooks/useDashboardStats';

function DashboardStats() {
  const { loading: statsLoading, error: statsError, stats } = useUserDashboardStats();
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  return (
    <div className={`dashboard-stats-row${animateIn ? ' fade-in-pop' : ''}`}>
      <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
        {stats.destinations === null ? (
          <span className="loading-spinner" />
        ) : (
          <span className="dashboard-stat-number blue">{stats.destinations}</span>
        )}
        <span className="dashboard-stat-label">Destinations</span>
      </div>
      <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
        {stats.bookmarked === null ? (
          <span className="loading-spinner" />
        ) : (
          <span className="dashboard-stat-number green">{stats.bookmarked}</span>
        )}
        <span className="dashboard-stat-label">Bookmarked</span>
      </div>
      <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
        {stats.tripsPlanned === null ? (
          <span className="loading-spinner" />
        ) : (
          <span className="dashboard-stat-number purple">{stats.tripsPlanned}</span>
        )}
        <span className="dashboard-stat-label">Trips Planned</span>
      </div>
      <div className="dashboard-stat" title={statsError ? String(statsError) : undefined}>
        {stats.ratedCount === null ? (
          <span className="loading-spinner" />
        ) : (
          <span className="dashboard-stat-number orange">{stats.ratedCount}</span>
        )}
        <span className="dashboard-stat-label">Rated Destinations</span>
      </div>
    </div>
  );
}

export default DashboardStats;
