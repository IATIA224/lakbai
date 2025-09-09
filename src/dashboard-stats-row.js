import { useEffect, useMemo, useState } from 'react';
import {
getFirestore,
collection,
doc,
getDoc,
getDocs,
query,
where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();

/**
 * Fetch dashboard stats for the given user.
 * Returns: { destinations, bookmarked, tripsPlanned, avgRating }
 */
export async function getUserDashboardStats(uidInput) {
const uid = uidInput || getAuth()?.currentUser?.uid;
if (!uid) {
    return { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0 };
}

// ---------- helpers ----------
const safeAvg = (arr) => (arr.length ? arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length : 0);

async function countFirstMatch(queries) {
    for (const fn of queries) {
    try {
        const n = await fn();
        if (typeof n === 'number' && n > 0) return n;
    } catch (_) {}
    }
    return 0;
}

// Destinations authored/owned by user (try common fields)
const destinations = await countFirstMatch([
    async () => (await getDocs(query(collection(db, 'destinations'), where('createdBy', '==', uid)))).size,
    async () => (await getDocs(query(collection(db, 'destinations'), where('ownerId', '==', uid)))).size,
    async () => (await getDocs(query(collection(db, 'destinations'), where('authorId', '==', uid)))).size,
]);

// Bookmarked by user (support multiple shapes)
async function countBookmarks() {
// A) users/{uid}/bookmarks subcollection (authoritative)
try {
    const qs = await getDocs(collection(db, 'users', uid, 'bookmarks'));
    // Return size even if 0 to avoid false positives from fallbacks
    return qs.size;                           // CHANGED: always return, do not fall through
} catch (_) {}

// Fallbacks (kept, only used if the subcollection read fails)
try {
    const snap = await getDoc(doc(db, 'userBookmarks', uid));
    if (snap.exists()) {
    const d = snap.data() || {};
    const arr = Array.isArray(d.destinations) ? d.destinations
                : Array.isArray(d.items) ? d.items
                : [];
    if (arr.length) return arr.length;
    }
} catch (_) {}

try {
    const sub = await getDocs(collection(db, 'userBookmarks', uid, 'items'));
    if (!sub.empty) return sub.size;
} catch (_) {}

try {
    const rows = await getDocs(query(collection(db, 'userBookmarks'), where('userId', '==', uid)));
    if (!rows.empty) return rows.size;
} catch (_) {}

try {
    const rows = await getDocs(query(collection(db, 'bookmarks'), where('userId', '==', uid)));
    if (!rows.empty) return rows.size;
} catch (_) {}

return 0;
}
const bookmarked = await countBookmarks();

// Trips planned by user
async function countTrips() {
// A) users/{uid}/trips subcollection (screenshot shows 'trips' alongside bookmarks/ratings)
try {
    const qs = await getDocs(collection(db, 'users', uid, 'trips'));
    if (!qs.empty) return qs.size;
} catch (_) {}

const candidates = [
    ['Trips', 'userId'],
    ['Trips', 'ownerId'],
    ['itinerary', 'userId'],
    ['itinerary', 'ownerId'],
    ['itineraries', 'userId'],
    ['tripPlans', 'userId'],
];
for (const [coll, field] of candidates) {
    try {
    const qs = await getDocs(query(collection(db, coll), where(field, '==', uid)));
    if (!qs.empty) return qs.size;
    } catch (_) {}
}
return 0;
}
const tripsPlanned = await countTrips();

// Average rating given by the user or of user's destinations/bookmarks
async function computeAvgRating() {
// A) users/{uid}/ratings subcollection
try {
    const rs = await getDocs(collection(db, 'users', uid, 'ratings'));
    if (!rs.empty) {
    const vals = rs.docs
        .map(d => d.data())
        .map(d => d.rating ?? d.score ?? d.value)
        .filter(v => v !== undefined && v !== null)
        .map(Number)
        .filter(n => !Number.isNaN(n));
    if (vals.length) return safeAvg(vals);
    }
} catch (_) {}

// 1) ratings root collection (userId + rating/score)
try {
    const rs = await getDocs(query(collection(db, 'ratings'), where('userId', '==', uid)));
    if (!rs.empty) {
    const vals = rs.docs
        .map(d => d.data())
        .map(d => d.rating ?? d.score ?? d.value)
        .filter(v => v !== undefined && v !== null)
        .map(Number)
        .filter(n => !Number.isNaN(n));
    if (vals.length) return safeAvg(vals);
    }
} catch (_) {}

// 2) average rating of destinations authored by user
try {
    const authored = await getDocs(query(collection(db, 'destinations'), where('createdBy', '==', uid)));
    if (!authored.empty) {
    const vals = authored.docs.map(d => d.data()?.rating).filter(v => v != null).map(Number).filter(n => !Number.isNaN(n));
    if (vals.length) return safeAvg(vals);
    }
} catch (_) {}

// 3) average rating of bookmarked destinations (supports userBookmarks doc/array)
try {
    // Try users/{uid}/bookmarks first
    let ids = [];
    try {
    const qs = await getDocs(collection(db, 'users', uid, 'bookmarks'));
    if (!qs.empty) ids = qs.docs.map(d => d.id);
    } catch (_) {}

    // Fallback to userBookmarks doc with array
    if (!ids.length) {
    const docSnap = await getDoc(doc(db, 'userBookmarks', uid));
    if (docSnap.exists()) {
        const d = docSnap.data() || {};
        ids = Array.isArray(d.destinations) ? d.destinations : Array.isArray(d.items) ? d.items : [];
    }
    }

    if (ids.length) {
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    const ratings = [];
    for (const group of chunks) {
        const reads = await Promise.allSettled(group.map(id => getDoc(doc(db, 'destinations', id))));
        reads.forEach(r => {
        if (r.status === 'fulfilled' && r.value.exists()) {
            const val = r.value.data()?.rating;
            if (val != null && !Number.isNaN(Number(val))) ratings.push(Number(val));
        }
        });
    }
    if (ratings.length) return safeAvg(ratings);
    }
} catch (_) {}

return 0;
}
const avgRating = await computeAvgRating();

return { destinations, bookmarked, tripsPlanned, avgRating: Number(avgRating.toFixed(2)) };
}

/**
 * React hook wrapper for convenience in dashboard.js
 * Usage:
 *   const { loading, error, stats } = useUserDashboardStats();
 *   // or useUserDashboardStats(uid)
 */
export function useUserDashboardStats(uid) {
const [state, setState] = useState({ loading: true, error: null, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0 } });

const stableUid = useMemo(() => uid || getAuth()?.currentUser?.uid || null, [uid]);

useEffect(() => {
    let cancelled = false;
    async function run() {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
        const stats = await getUserDashboardStats(stableUid);
        if (!cancelled) setState({ loading: false, error: null, stats });
    } catch (e) {
        if (!cancelled) setState({ loading: false, error: e, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0 } });
    }
    }
    if (stableUid) run();
    else setState({ loading: false, error: null, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0 } });
    return () => { cancelled = true; };
}, [stableUid]);

return state;
}

export default useUserDashboardStats;