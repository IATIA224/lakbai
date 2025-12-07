import { useState, useEffect } from 'react';
import { collection, onSnapshot, query as fsQuery, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeTrips = () => {};

    const handleAuth = (user) => {
      unsubscribeTrips(); // Unsubscribe from previous user's trips
      if (user) {
        const colRef = collection(db, 'itinerary', user.uid, 'items');
        const q = fsQuery(colRef, orderBy('createdAt', 'desc'), limit(2));
        unsubscribeTrips = onSnapshot(q, (snap) => {
          const rows = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrips(rows);
          setLoading(false);
        }, () => {
          setTrips([]);
          setLoading(false);
        });
      } else {
        setTrips([]);
        setLoading(false);
      }
    };

    const unsubAuth = auth.onAuthStateChanged(handleAuth);
    
    return () => {
      unsubAuth();
      unsubscribeTrips();
    };
  }, []);

  return { trips, loading, setTrips };
}