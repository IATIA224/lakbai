import React from 'react';
import './Styles/notfound-cms.css';

export default function NotFoundCMS({ text = 'Destination not found' }) {
  return (
    <div className="notfound-cms">
      <div className="notfound-cms-icon">🔍</div>
      <div className="notfound-cms-text">{text}</div>
    </div>
  );
}