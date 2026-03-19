import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useUserDashboardStats(userId) {
  const [stats, setStats] = useState({
    destinations: null,
    bookmarked: null,
    tripsPlanned: null,
    ratedCount: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribes = [];

    const fetchGlobalStats = async () => {
      try {
        const destsSnap = await getDocs(collection(db, 'destinations'));
        if (isMounted) {
    setStats(prev => ({ ...prev, destinations: destsSnap.size }));
        }
      } catch (err) {
        if (isMounted) setError(err);
      }
    };

    const setupUserListeners = (uid) => {
      const listeners = [
        { ref: collection(db, 'users', uid, 'bookmarks'), key: 'bookmarked' },
        { ref: collection(db, 'itinerary', uid, 'items'), key: 'tripsPlanned' },
        { ref: collection(db, 'users', uid, 'ratings'), key: 'ratedCount' },
      ];

      listeners.forEach(({ ref, key }) => {
        const unsubscribe = onSnapshot(ref, 
          (snap) => {
            if (isMounted) setStats(prev => ({ ...prev, [key]: snap.size }));
          },
          (err) => {
            if (isMounted) setError(err);
          }
        );
        unsubscribes.push(unsubscribe);
      });
    };

    const handleAuthChange = (user) => {
      unsubscribes.forEach(unsub => unsub());
      unsubscribes = [];
      
      const uidToFetch = userId || user?.uid;

      if (isMounted) {
        setLoading(true);
        // Reset user-specific stats when user changes
  setStats(prev => ({ ...prev, bookmarked: null, tripsPlanned: null, ratedCount: null }));
      }

      if (uidToFetch) {
        setupUserListeners(uidToFetch);
      }
      
      if (isMounted) {
        setLoading(false);
      }
    };

    fetchGlobalStats();
    const unsubAuth = auth.onAuthStateChanged(handleAuthChange);
    unsubscribes.push(unsubAuth);

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [userId]);

  return { stats, loading, error };
}
