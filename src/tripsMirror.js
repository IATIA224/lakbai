import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  query,
  where,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

// Helper: slugify a name to match trip doc IDs like "banaue" / "el-nido"
function slugifyName(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Normalize itinerary item -> trip doc
function mapItineraryToTripDoc(itemData, itemId, uid) {
  const d = itemData || {};
  return {
    name: d.name || "Destination",
    region: d.region || "",
    status: d.status || "Upcoming",
    arrival: d.arrival || null,
    departure: d.departure || null,
    budget: Number(d.budget || 0),
    accomBudget: Number(d.accomBudget || 0),
    activityBudget: Number(d.activityBudget || 0),
    accomName: d.accomName || "",
    accomType: d.accomType || "",
    activities: Array.isArray(d.activities) ? d.activities : [],
    ownerId: uid,
    fromItineraryItemId: itemId,
    updatedAt: serverTimestamp(),
    createdAt: d.createdAt || serverTimestamp(),
  };
}

// Backfill existing itinerary items once
async function backfillUserTrips(uid) {
  const itemsCol = collection(db, "itinerary", uid, "items");
  const snap = await getDocs(itemsCol);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((s) => {
    const data = mapItineraryToTripDoc(s.data(), s.id, uid);
    batch.set(doc(db, "users", uid, "trips", s.id), data, { merge: true });
  });
  await batch.commit();
  console.log(`[TripsMirror] Backfilled ${snap.size} trips for ${uid}`);
}

// Live mirror with delete support
function startUserTripsMirror(uid) {
  const itemsCol = collection(db, "itinerary", uid, "items");

  // initial backfill
  backfillUserTrips(uid).catch(() => {});

  return onSnapshot(itemsCol, async (snap) => {
    const upserts = [];
    const deletes = [];

    for (const change of snap.docChanges()) {
      const itemId = change.doc.id;

      if (change.type === "added" || change.type === "modified") {
        const tripRef = doc(db, "users", uid, "trips", itemId);
        const data = mapItineraryToTripDoc(change.doc.data(), itemId, uid);
        upserts.push(setDoc(tripRef, data, { merge: true }));
      } else if (change.type === "removed") {
        // 1) delete by identical id
        deletes.push(deleteDoc(doc(db, "users", uid, "trips", itemId)).catch(() => {}));

        // 2) delete by link field
        deletes.push(
          (async () => {
            try {
              const q1 = query(
                collection(db, "users", uid, "trips"),
                where("fromItineraryItemId", "==", itemId)
              );
              const qs = await getDocs(q1);
              if (!qs.empty) {
                const b = writeBatch(db);
                qs.forEach((d) => b.delete(d.ref));
                await b.commit();
              }
            } catch {}
          })()
        );

        // 3) delete by name/slug (covers trips created with name-based IDs)
        deletes.push(
          (async () => {
            try {
              const prevName =
                change.doc.get?.("name") ||
                change.doc.get?.("destination") ||
                change.doc.data()?.name ||
                "";
              if (!prevName) return;

              // a) name equality
              const qByName = query(
                collection(db, "users", uid, "trips"),
                where("name", "==", prevName)
              );
              const byName = await getDocs(qByName);
              if (!byName.empty) {
                const b = writeBatch(db);
                byName.forEach((d) => b.delete(d.ref));
                await b.commit();
              }

              // b) slug id match (e.g., "el-nido")
              const slugId = slugifyName(prevName);
              if (slugId) {
                await deleteDoc(doc(db, "users", uid, "trips", slugId)).catch(() => {});
              }
            } catch {}
          })()
        );
      }
    }

    if (upserts.length) {
      Promise.all(upserts).catch((e) => console.error("[TripsMirror] Upsert failed:", e));
    }
    if (deletes.length) {
      Promise.all(deletes).catch((e) => console.error("[TripsMirror] Delete failed:", e));
    }
  });
}

/**
 * Start mirroring for the signed-in user. Call once (e.g., in App useEffect).
 */
export function startTripsMirrorForAuth() {
  let tripsUnsub = null;
  const auth = getAuth();

  const stopAll = () => {
    try { tripsUnsub && tripsUnsub(); } catch {}
    tripsUnsub = null;
  };

  const authUnsub = onAuthStateChanged(auth, (u) => {
    stopAll();
    if (u?.uid) tripsUnsub = startUserTripsMirror(u.uid);
  });

  return () => {
    stopAll();
    try { authUnsub && authUnsub(); } catch {}
  };
}