import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
collection,
doc,
getDocs,
onSnapshot,
serverTimestamp,
setDoc,
deleteDoc,
query,
where,
} from "firebase/firestore";
import { db } from "./firebase";

// Normalize itinerary item -> trip doc
function mapItineraryToTripDoc(itemData, itemId, uid) {
const d = itemData || {};
return {
    name: d.name || "Destination",
    region: d.region || "",
    status: d.status || "Upcoming",
    arrival: d.arrival || null,
    departure: d.departure || null,

    // budgets and details
    budget: Number(d.budget || 0),
    accomBudget: Number(d.accomBudget || 0),
    activityBudget: Number(d.activityBudget || 0),
    accomName: d.accomName || "",
    accomType: d.accomType || "",
    activities: Array.isArray(d.activities) ? d.activities : [],

    // traceability
    ownerId: uid,
    fromItineraryItemId: itemId,
    updatedAt: serverTimestamp(),
    createdAt: d.createdAt || serverTimestamp(),
};
}

// One-time backfill existing items
async function backfillUserTrips(uid) {
try {
    const itemsCol = collection(db, "itinerary", uid, "items");
    const snap = await getDocs(itemsCol);
    if (snap.empty) return;

    const writes = [];
    snap.forEach((docSnap) => {
    const data = mapItineraryToTripDoc(docSnap.data(), docSnap.id, uid);
    const tripRef = doc(db, "users", uid, "trips", docSnap.id);
    writes.push(setDoc(tripRef, data, { merge: true }));
    });
    await Promise.all(writes);
    console.log(
    `[TripsMirror] Backfilled ${writes.length} items to users/${uid}/trips`
    );
} catch (e) {
    console.error("[TripsMirror] Backfill failed:", e);
}
}

// remove helper: delete the mirrored trip by item id (with fallback)
async function deleteTripByItemId(uid, itemId) {
try {
    // 1: same id
    await deleteDoc(doc(db, "users", uid, "trips", itemId));
} catch (_) {}
try {
    // 2: fallback if a different id was used; match by fromItineraryItemId
    const q = query(
    collection(db, "users", uid, "trips"),
    where("fromItineraryItemId", "==", itemId)
    );
    const qs = await getDocs(q);
    await Promise.all(qs.docs.map((d) => deleteDoc(d.ref)));
} catch (_) {}
}

// Live mirror for adds/updates/removes
function startUserTripsMirror(uid) {
const itemsCol = collection(db, "itinerary", uid, "items");

// initial backfill (already present in your file)
backfillUserTrips(uid);

return onSnapshot(itemsCol, async (snap) => {
    const upserts = [];
    const removals = [];

    for (const change of snap.docChanges()) {
    if (change.type === "added" || change.type === "modified") {
        const tripRef = doc(db, "users", uid, "trips", change.doc.id);
        const data = mapItineraryToTripDoc(change.doc.data(), change.doc.id, uid);
        upserts.push(setDoc(tripRef, data, { merge: true }));
    } else if (change.type === "removed") {
        removals.push(deleteTripByItemId(uid, change.doc.id));
    }
    }

    if (upserts.length) {
    Promise.all(upserts).catch((e) =>
        console.error("[TripsMirror] Upsert failed:", e)
    );
    }
    if (removals.length) {
    Promise.all(removals).catch((e) =>
        console.error("[TripsMirror] Remove failed:", e)
    );
    }
});
}

/**
 * Start mirroring for the signed-in user. Returns an unsubscribe function.
 * Safe to call once from App.
 */
export function startTripsMirrorForAuth() {
let tripsUnsub = null;
const auth = getAuth();

const stopAll = () => {
    try {
    tripsUnsub && tripsUnsub();
    } catch {}
    tripsUnsub = null;
};

const authUnsub = onAuthStateChanged(auth, (u) => {
    stopAll();
    if (u?.uid) {
    tripsUnsub = startUserTripsMirror(u.uid);
    }
});

return () => {
    stopAll();
    try {
    authUnsub && authUnsub();
    } catch {}
};
}