import React, { useEffect, useState } from "react";
import "./achievement-toast.css";

export default function AchievementToast() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handler = (e) => {
      setMessage(e.detail?.message || "Achievement Unlocked! 🎉");
      setOpen(true);
      clearTimeout(window.__ach_to__);
      window.__ach_to__ = setTimeout(() => setOpen(false), 3000);
    };
    window.addEventListener("achievement:unlock", handler);
    return () => window.removeEventListener("achievement:unlock", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="achievement-notification" data-testid="achievement-notification">
      <span className="achievement-icon">🏆</span>
      <span>{message}</span>
    </div>
  );
}