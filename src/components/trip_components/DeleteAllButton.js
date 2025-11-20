import { writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase";

/**
 * Delete all itinerary items for user using batched deletes.
 * Uses the `items` array passed from Itinerary instead of refetching the collection.
 */
export async function deleteAllItinerary(items, user) {
  if (!user) return;
  if (!Array.isArray(items) || items.length === 0) {
    alert("No destinations to delete.");
    return;
  }

  const confirmed = window.confirm(
    `⚠️ Delete all ${items.length} destination(s)? This action cannot be undone!`
  );
  if (!confirmed) return;

  try {
    // Firestore batched writes have a limit (500). Split into chunks.
    const CHUNK_SIZE = 450;
    let index = 0;

    while (index < items.length) {
      const batch = writeBatch(db);
      const chunk = items.slice(index, index + CHUNK_SIZE);
      chunk.forEach((item) =>
        batch.delete(doc(db, "itinerary", user.uid, "items", item.id))
      );
      await batch.commit();
      index += CHUNK_SIZE;
    }

    alert("🗑️ All destinations have been deleted");
  } catch (err) {
    console.error("Failed to delete all:", err);
    alert("Failed to delete destinations");
  }
}