import React from 'react';

export default function DestinationCard({
  name,
  region,
  rating,
  price,
  priceTier,
  description,
  tags,
  image,
  onDetails,
  isBookmarked,
  onBookmarkClick
}) {
  return (
    <div className="grid-card" style={{ position: 'relative' }}>
      <div className="card-image">
        {/* Optional: sun and wave decorations */}
        <div className="sun-decoration" />
        <div className="wave-decoration" />
        <button
          className={`bookmark-bubble${isBookmarked ? ' active' : ''}`}
          onClick={onBookmarkClick}
          aria-label="Toggle bookmark"
          title="Bookmark"
        >
          {isBookmarked ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="card-header">
        <h2>{name}</h2>
        <div className="mini-rating" title="Average Rating">
          <span>⭐</span> {rating}
        </div>
      </div>

      <div className="bp2-region-line">{region}</div>
      <p className="description">{description}</p>

      <div className="tag-container">
        {(tags || []).map((t, i) => (
          <span key={i} className="tag">
            {t}
          </span>
        ))}
      </div>

      <div className="card-footer">
        <div
          className={`price-pill ${priceTier === 'less' ? 'pill-green' : 'pill-gray'}`}
          title={priceTier === 'less' ? 'Less Expensive tier' : 'Expensive tier'}
        >
          {price}
        </div>
        <button className="details-btn" onClick={onDetails}>
          View Details
        </button>
      </div>
    </div>
  );
}
