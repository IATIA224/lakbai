import React, { useEffect, useMemo } from "react";

export default function Achievements({ isOpen, onClose, achievementsData = [] }) {
  if (!isOpen) return null;

  // Lock body scroll while open + close on ESC
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of achievementsData) {
      const key = a.category || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return Array.from(map.entries());
  }, [achievementsData]);

  return (
    <div className="achv-backdrop" onClick={onClose}>
      <div className="achv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="achv-header">
          <div className="achv-title">
            <img className="achv-title-icon" src="/achievement.png" alt="" />
            <span>All Achievements</span>
          </div>
          <button
            className="achv-close"
            aria-label="Close achievements"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="achv-body">
          {grouped.map(([category, items]) => (
            <section key={category} className="achv-section">
              <h3 className="achv-section-title">{category}</h3>
              <div className="achv-divider" />
              <div className="achv-grid">
                {items.map((a) => (
                  <div
                    key={a.id || a.title}
                    className={`achv-item ${a.unlocked ? "is-unlocked" : "is-locked"}`}
                  >
                    <div className="achv-item-icon">{a.icon || "🏆"}</div>
                    <div className="achv-item-main">
                      <div className="achv-item-title">{a.title}</div>
                      <div className="achv-item-desc">{a.description}</div>
                    </div>
                    {a.unlocked ? (
                      <span className="achv-badge ok">Unlocked</span>
                    ) : (
                      <span className="achv-badge">Locked</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {grouped.length === 0 && (
            <div style={{ color: "#64748b" }}>No achievements to display.</div>
          )}
        </div>
      </div>
    </div>
  );
}