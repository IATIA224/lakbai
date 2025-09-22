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
 * Returns: { destinations, bookmarked, tripsPlanned, avgRating, ratedCount }
 */
export async function getUserDashboardStats(uidInput) {
const uid = uidInput || getAuth()?.currentUser?.uid;
if (!uid) {
    return { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0, ratedCount: 0 };
}

// ---------- helpers ----------
const safeAvg = (arr) => (arr.length ? arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length : 0);

// --- ACTUAL number of destinations available on destination tab ---
async function countActualDestinations() {
    try {
    const qs = await getDocs(collection(db, 'destinations'));
    return qs.size;
    } catch (_) {
    return 0;
    }
}
const destinations = await countActualDestinations();

// --- ACTUAL number of bookmarked destinations for current user ---
async function countActualBookmarks() {
    try {
    const qs = await getDocs(collection(db, 'users', uid, 'bookmarks'));
    return qs.size;
    } catch (_) {
    return 0;
    }
}
const bookmarked = await countActualBookmarks();

// --- ACTUAL number of trips planned from My Trips of current user ---
async function countActualTrips() {
    try {
    const qs = await getDocs(collection(db, 'users', uid, 'trips'));
    return qs.size;
    } catch (_) {
    return 0;
    }
}
const tripsPlanned = await countActualTrips();

// --- Count of destinations rated by current user ---
async function countRatedDestinations() {
    try {
        const qs = await getDocs(collection(db, 'users', uid, 'ratings'));
        return qs.size;
    } catch (_) {
        return 0;
    }
}
const ratedCount = await countRatedDestinations();

// --- Average rating logic remains unchanged ---
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

return { destinations, bookmarked, tripsPlanned, avgRating: Number(avgRating.toFixed(2)), ratedCount };
}

/**
 * React hook wrapper for convenience in dashboard.js
 * Usage:
 *   const { loading, error, stats } = useUserDashboardStats();
 *   // or useUserDashboardStats(uid)
 */
export function useUserDashboardStats(uid) {
const [state, setState] = useState({ loading: true, error: null, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0, ratedCount: 0 } });

const stableUid = useMemo(() => uid || getAuth()?.currentUser?.uid || null, [uid]);

useEffect(() => {
    let cancelled = false;
    async function run() {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
        const stats = await getUserDashboardStats(stableUid);
        if (!cancelled) setState({ loading: false, error: null, stats });
    } catch (e) {
        if (!cancelled) setState({ loading: false, error: e, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0, ratedCount: 0 } });
    }
    }
    if (stableUid) run();
    else setState({ loading: false, error: null, stats: { destinations: 0, bookmarked: 0, tripsPlanned: 0, avgRating: 0, ratedCount: 0 } });
    return () => { cancelled = true; };
}, [stableUid]);

return state;
}

export default useUserDashboardStats;