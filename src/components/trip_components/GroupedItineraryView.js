import React, { useState } from "react";
import "./GroupedItineraryView.css";

export default function GroupedItineraryView({ group, items, onEditGroup }) {
  const [expandedDays, setExpandedDays] = useState(new Set([1]));

  // Get destinations for a specific day
  const getDestinationsForDay = (dayNum) => {
    const destIds = Object.entries(group.assignments || {})
      .filter(([, day]) => day === dayNum)
      .map(([id]) => id);
    return items.filter((item) => destIds.includes(item.id));
  };

  // Calculate total budget
  const totalBudget = items
    .filter((item) => (group.destinationIds || []).includes(item.id))
    .reduce((sum, item) => sum + (Number(item.estimatedExpenditure) || 0), 0);

  // Generate day labels
  const getDayLabels = () => {
    if (!group.startDate || !group.dayCount) return [];
    const labels = [];
    const start = new Date(group.startDate);
    for (let i = 0; i < group.dayCount; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      labels.push({
        day: i + 1,
        date: date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        }),
        fullDate: date.toISOString().split("T")[0],
      });
    }
    return labels;
  };

  const dayLabels = getDayLabels();

  const toggleDay = (dayNum) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dayNum)) {
        newSet.delete(dayNum);
      } else {
        newSet.add(dayNum);
      }
      return newSet;
    });
  };

  return (
    <div className="grouped-itinerary">
      {/* Trip Header */}
      <div className="grouped-header">
        <div className="grouped-header-content">
          <h2 className="grouped-title">{group.name}</h2>
          <div className="grouped-meta">
            <span className="grouped-dates">
              📅 {new Date(group.startDate).toLocaleDateString()} -{" "}
              {new Date(group.endDate).toLocaleDateString()}
            </span>
            <span className="grouped-duration">
              🗓️ {group.dayCount} day{group.dayCount !== 1 ? "s" : ""}
            </span>
            <span className="grouped-destinations">
              📍 {(group.destinationIds || []).length} destination
              {(group.destinationIds || []).length !== 1 ? "s" : ""}
            </span>
            <span className="grouped-budget">
              💰 ₱{totalBudget.toLocaleString()}
            </span>
          </div>
        </div>
        <button className="grouped-edit-btn" onClick={() => onEditGroup(group)}>
          ✏️ Edit Trip
        </button>
      </div>

      {/* Day-by-Day Timeline */}
      <div className="grouped-timeline">
        {dayLabels.map((dayInfo) => {
          const destinations = getDestinationsForDay(dayInfo.day);
          const isExpanded = expandedDays.has(dayInfo.day);
          const dayBudget = destinations.reduce(
            (sum, d) => sum + (Number(d.estimatedExpenditure) || 0),
            0
          );

          return (
            <div
              key={dayInfo.day}
              className={`grouped-day ${isExpanded ? "expanded" : ""}`}
            >
              <div
                className="grouped-day-header"
                onClick={() => toggleDay(dayInfo.day)}
              >
                <div className="grouped-day-info">
                  <span className="grouped-day-number">Day {dayInfo.day}</span>
                  <span className="grouped-day-date">{dayInfo.date}</span>
                </div>
                <div className="grouped-day-summary">
                  <span className="grouped-day-count">
                    {destinations.length} stop
                    {destinations.length !== 1 ? "s" : ""}
                  </span>
                  {dayBudget > 0 && (
                    <span className="grouped-day-budget">
                      ₱{dayBudget.toLocaleString()}
                    </span>
                  )}
                  <span className={`grouped-day-toggle ${isExpanded ? "open" : ""}`}>
                    ▼
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="grouped-day-content">
                  {destinations.length === 0 ? (
                    <div className="grouped-day-empty">
                      <span>🌴</span>
                      <p>Free day - No planned destinations</p>
                    </div>
                  ) : (
                    <div className="grouped-day-destinations">
                      {destinations.map((dest, idx) => (
                        <div key={dest.id} className="grouped-destination-card">
                          <div className="grouped-dest-order">{idx + 1}</div>
                          <div className="grouped-dest-content">
                            <div className="grouped-dest-header">
                              <h4 className="grouped-dest-name">{dest.name}</h4>
                              <span
                                className={`grouped-dest-status ${dest.status?.toLowerCase()}`}
                              >
                                {dest.status}
                              </span>
                            </div>
                            {dest.region && (
                              <p className="grouped-dest-region">
                                📍 {dest.region}
                              </p>
                            )}
                            {dest.activities?.length > 0 && (
                              <div className="grouped-dest-activities">
                                {dest.activities.slice(0, 3).map((act, i) => (
                                  <span key={i} className="grouped-activity-tag">
                                    {act}
                                  </span>
                                ))}
                                {dest.activities.length > 3 && (
                                  <span className="grouped-activity-more">
                                    +{dest.activities.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            {dest.estimatedExpenditure > 0 && (
                              <p className="grouped-dest-budget">
                                💰 ₱
                                {Number(dest.estimatedExpenditure).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}