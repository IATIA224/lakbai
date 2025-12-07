import { useState, useEffect } from 'react';
import { collection, getDocs, query as fsQuery, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setLoading(true);
        try {
          const colRef = collection(db, 'users', user.uid, 'bookmarks');
          const snap = await getDocs(fsQuery(colRef, orderBy('createdAt', 'desc'), limit(2)));
          const rows = await Promise.all(
            snap.docs.map(async (b) => {
              const data = b.data() || {};
              if (data.name && data.description) {
                return { id: b.id, ...data };
              }
              const dref = doc(db, 'destinations', b.id);
              const ddoc = await getDoc(dref);
              return { id: b.id, ...(ddoc.exists() ? ddoc.data() : {}), ...data };
            })
          );
          setBookmarks(rows.filter(Boolean));
        } catch (e) {
          console.error("Failed to fetch bookmarks:", e);
          setBookmarks([]);
        } finally {
          setLoading(false);
        }
      } else {
        setBookmarks([]);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  return { bookmarks, loading, setBookmarks };
}
