import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAuthed(true);
        try {
          const token = await user.getIdToken();
          localStorage.setItem('token', token);
        } catch (e) {
          console.warn('Failed to get token', e);
        }
      } else {
        setAuthed(false);
        localStorage.removeItem('token');
      }
      setChecking(false);
    });
    return unsubscribe;
  }, []);

  if (checking) return null; // or a small spinner
  if (!authed && !localStorage.getItem('token')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}