import { getFirestore, doc, onSnapshot, collection, getDocs } from "firebase/firestore";

/**
 * Listen for user stats: Places on Trips, Photos Shared, Rated Destinations, Friends.
 * @param {string} userId - The user's UID.
 * @param {(stats: {placesOnTrips: number, photosShared: number, ratedDestinations: number, friends: number}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function listenUserStats(userId, callback) {
    const db = getFirestore();
    const userRef = doc(db, "users", userId);

    // Listen for changes to the user document
    const unsubscribe = onSnapshot(userRef, async (userSnap) => {
        if (!userSnap.exists()) {
            callback({
                placesOnTrips: 0,
                photosShared: 0,
                ratedDestinations: 0,
                friends: 0,
            });
            return;
        }
        const stats = userSnap.data().stats || {};

        // Count ratings subcollection
        const ratingsCol = collection(db, "users", userId, "ratings");
        const ratingsSnap = await getDocs(ratingsCol);
        const ratedDestinations = ratingsSnap.size;

        // Count trips subcollection
        const tripsCol = collection(db, "users", userId, "trips");
        const tripsSnap = await getDocs(tripsCol);
        const placesOnTrips = tripsSnap.size;

        // Count friends subcollection
        const friendsCol = collection(db, "users", userId, "friends");
        const friendsSnap = await getDocs(friendsCol);
        const friends = friendsSnap.size;

        callback({
            placesOnTrips,
            photosShared: stats.photosShared ?? stats.photos ?? 0,
            ratedDestinations,
            friends,
        });
    });

    return unsubscribe;
}