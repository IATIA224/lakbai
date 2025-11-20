import { writeBatch, doc } from "firebase/firestore";import { db } from "../../firebase";/** * Mark all selected itinerary items as Completed. * This uses Firestore writeBatch to update all documents in one commit. */export async function markAllCompleted(items, user) {  if (!user) return;  if (!Array.isArray(items) || items.length === 0) {    alert("No destinations to mark.");    return;  }  const confirmed = window.confirm(`Mark all ${items.length} destination(s) as Completed?`);  if (!confirmed) return;  try {    const batch = writeBatch(db);    items.forEach((item) => {      const ref = doc(db, "itinerary", user.uid, "items", item.id);      batch.update(ref, { status: "Completed" });
    });
    await batch.commit();
    alert("✅ All destinations marked as completed!");
  } catch (err) {
    console.error("Failed to mark all completed:", err);
    alert("Failed to update destinations");
  }
}