import {
  collection,
  doc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Geocode a location name to get coordinates using Nominatim
 * @param {string} locationName - The name or region to geocode
 * @returns {Promise<{lat: number, lon: number}|null>}
 */
async function geocodeLocation(locationName) {
  if (!locationName || locationName.trim() === "") return null;
  
  try {
    const query = `${locationName}, Philippines`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(url, {
      headers: { "Accept-Language": "en" }
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    
    if (results && results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error("❌ Geocoding error:", error);
    return null;
  }
}

/**
 * Get coordinates for a destination (with fallback to region)
 * @param {object} destination - The destination object
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function getDestinationCoordinates(destination) {
  // First, check if coordinates already exist
  if (destination.latitude && destination.longitude) {
    return {
      latitude: destination.latitude,
      longitude: destination.longitude
    };
  }
  
  if (destination.lat && (destination.lon || destination.lng)) {
    return {
      latitude: destination.lat,
      longitude: destination.lon || destination.lng
    };
  }
  
  // Try geocoding the full name first
  let coords = await geocodeLocation(destination.name);
  
  // If that fails, try the region
  if (!coords && destination.region) {
    coords = await geocodeLocation(destination.region);
  }
  
  // If still no coords, try combining name + region
  if (!coords && destination.name && destination.region) {
    coords = await geocodeLocation(`${destination.name}, ${destination.region}`);
  }
  
  if (coords) {
    return {
      latitude: coords.lat,
      longitude: coords.lon
    };
  }
  
  return null;
}

/**
 * Update stats when a destination is added to itinerary
 * @param {string} userId - The user's ID
 * @param {object} destination - The destination object
 */
export async function trackDestinationAdded(userId, destination) {
  if (!userId || !destination) return;

  try {
    // Get coordinates if not already present
    const coords = await getDestinationCoordinates(destination);
    
    // 1. Update global "addedDestinations" document (all users)
    const globalAddedRef = doc(db, "Stats", "addedDestinations");
    await setDoc(
      globalAddedRef,
      {
        totalDestinations: increment(1),
        lastUpdated: serverTimestamp(),
        destinations: {
          [destination.id || destination.name]: {
            name: destination.name || "Unknown",
            region: destination.region || "",
            addedBy: userId,
            addedAt: serverTimestamp(),
            latitude: coords?.latitude || null,
            longitude: coords?.longitude || null,
          },
        },
      },
      { merge: true }
    );

    console.log("✅ Global added destinations stats updated");
  } catch (error) {
    console.error("❌ Error tracking destination added:", error);
  }
}

/**
 * Update stats when a destination is marked as completed
 * @param {string} userId - The user's ID
 * @param {object} destination - The destination object
 */
export async function trackDestinationCompleted(userId, destination) {
  if (!userId || !destination) return;

  try {
    // Get coordinates if not already present
    const coords = await getDestinationCoordinates(destination);
    
    // 1. Update global "completedDestinations" document (all users)
    const globalCompletedRef = doc(db, "Stats", "completedDestinations");
    await setDoc(
      globalCompletedRef,
      {
        totalCompleted: increment(1),
        lastUpdated: serverTimestamp(),
        destinations: {
          [destination.id || destination.name]: {
            name: destination.name || "Unknown",
            region: destination.region || "",
            location: destination.location || "", // Include location field
            completedBy: userId,
            completedAt: serverTimestamp(),
            latitude: coords?.latitude || null,
            longitude: coords?.longitude || null,
          },
        },
      },
      { merge: true }
    );

    // 2. Update user-specific completed destinations document
    const userCompletedRef = doc(db, "Stats", `completed_${userId}`);
    await setDoc(
      userCompletedRef,
      {
        userId: userId,
        totalCompleted: increment(1),
        lastUpdated: serverTimestamp(),
        destinations: {
          [destination.id || destination.name]: {
            name: destination.name || "Unknown",
            region: destination.region || "",
            completedAt: serverTimestamp(),
            arrival: destination.arrival || null,
            departure: destination.departure || null,
            latitude: coords?.latitude || null,
            longitude: coords?.longitude || null,
          },
        },
      },
      { merge: true }
    );

    console.log("✅ Completed destination stats updated for user:", userId);
  } catch (error) {
    console.error("❌ Error tracking destination completed:", error);
  }
}

/**
 * Update stats when a destination status changes from Completed to something else
 * @param {string} userId - The user's ID
 * @param {object} destination - The destination object
 */
export async function trackDestinationUncompleted(userId, destination) {
  if (!userId || !destination) return;

  try {
    // 1. Update global "completedDestinations" document
    const globalCompletedRef = doc(db, "Stats", "completedDestinations");
    const globalDoc = await getDoc(globalCompletedRef);
    
    if (globalDoc.exists()) {
      await setDoc(
        globalCompletedRef,
        {
          totalCompleted: increment(-1),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    }

    // 2. Update user-specific completed destinations document
    const userCompletedRef = doc(db, "Stats", `completed_${userId}`);
    const userDoc = await getDoc(userCompletedRef);
    
    if (userDoc.exists()) {
      await setDoc(
        userCompletedRef,
        {
          totalCompleted: increment(-1),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    }

    console.log("✅ Uncompleted destination stats updated for user:", userId);
  } catch (error) {
    console.error("❌ Error tracking destination uncompleted:", error);
  }
}

/**
 * Update stats when a destination is removed from itinerary
 * @param {string} userId - The user's ID
 * @param {object} destination - The destination object
 * @param {boolean} wasCompleted - Whether the destination was completed
 */
export async function trackDestinationRemoved(userId, destination, wasCompleted = false) {
  if (!userId || !destination) return;

  try {
    // 1. Update global "addedDestinations" document
    const globalAddedRef = doc(db, "Stats", "addedDestinations");
    await setDoc(
      globalAddedRef,
      {
        totalDestinations: increment(-1),
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    // 2. If it was completed, also update completed stats
    if (wasCompleted) {
      await trackDestinationUncompleted(userId, destination);
    }

    console.log("✅ Removed destination stats updated");
  } catch (error) {
    console.error("❌ Error tracking destination removed:", error);
  }
}

/**
 * Get user's completion statistics
 * @param {string} userId - The user's ID
 * @returns {Promise<object>} User's stats
 */
export async function getUserCompletionStats(userId) {
  if (!userId) return null;

  try {
    const userCompletedRef = doc(db, "Stats", `completed_${userId}`);
    const userDoc = await getDoc(userCompletedRef);

    if (userDoc.exists()) {
      return userDoc.data();
    }
    
    return {
      userId,
      totalCompleted: 0,
      destinations: {},
    };
  } catch (error) {
    console.error("❌ Error getting user completion stats:", error);
    return null;
  }
}

/**
 * Get global statistics
 * @returns {Promise<object>} Global stats
 */
export async function getGlobalStats() {
  try {
    const addedRef = doc(db, "Stats", "addedDestinations");
    const completedRef = doc(db, "Stats", "completedDestinations");

    const [addedDoc, completedDoc] = await Promise.all([
      getDoc(addedRef),
      getDoc(completedRef),
    ]);

    return {
      totalAdded: addedDoc.exists() ? addedDoc.data().totalDestinations || 0 : 0,
      totalCompleted: completedDoc.exists() ? completedDoc.data().totalCompleted || 0 : 0,
    };
  } catch (error) {
    console.error("❌ Error getting global stats:", error);
    return {
      totalAdded: 0,
      totalCompleted: 0,
    };
  }
}