import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db, auth } from "./firebase";

/**
 * Filter posts based on the active view
 * @param {string} activeView - 'feed' | 'trending' | 'friends' | 'saved' | 'my-posts'
 * @param {Array} allPosts - All posts loaded from Firestore
 * @param {Object} user - Current authenticated user
 * @param {Set} friends - Set of friend UIDs
 * @param {Set} savedSet - Set of saved post IDs
 * @returns {Array} Filtered posts
 */
export function filterPostsByView(activeView, allPosts, user, friends, savedSet) {
  if (!allPosts || allPosts.length === 0) return [];

  switch (activeView) {
    case 'feed':
      // Home Feed: All public posts + user's own posts
      return allPosts;

    case 'trending':
      // Trending: Posts with highest like count (top 20)
      return [...allPosts]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 20);

    case 'friends':
      // Friends Only: Posts from friends or posts with visibility "Friends"
      if (!user) return [];
      return allPosts.filter(post => 
        (post.visibility === "Friends" && post.authorId === user.uid) ||
        (friends.has(post.authorId) && post.authorId !== user.uid)
      );

    case 'saved':
      // Saved Posts: Posts that the user has saved
      if (!user) return [];
      return allPosts.filter(post => savedSet.has(post.id));

    case 'my-posts':
      // My Posts: Posts created by the current user
      if (!user) return [];
      return allPosts.filter(post => post.authorId === user.uid);

    default:
      return allPosts;
  }
}

/**
 * Load all posts from Firestore (public + user's own posts + friends' posts)
 * @param {Object} currentUser - Current authenticated user
 * @param {Set} friendsSet - Set of friend UIDs
 * @returns {Promise<Array>} Array of posts with enhanced data
 */
export async function loadAllPosts(currentUser, friendsSet = new Set()) {
  try {
    const communityRef = collection(db, "community");
    const queries = [];

    // 1. Public posts
    queries.push(getDocs(query(communityRef, where("visibility", "==", "Public"))));

    // 2. User's own posts (all visibility levels)
    if (currentUser) {
      queries.push(getDocs(query(communityRef, where("authorId", "==", currentUser.uid))));
    }

    // 3. Friends' posts with "Friends" visibility
    if (currentUser && friendsSet.size > 0) {
      const friendIds = Array.from(friendsSet);
      // Firestore "in" query supports max 10 items, so we batch
      for (let i = 0; i < friendIds.length; i += 10) {
        const chunk = friendIds.slice(i, i + 10);
        queries.push(
          getDocs(
            query(
              communityRef,
              where("authorId", "in", chunk),
              where("visibility", "==", "Friends")
            )
          )
        );
      }
    }

    const results = await Promise.all(queries);

    // Combine and deduplicate posts
    const postsMap = new Map();
    results.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        postsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    });

    let postsArray = Array.from(postsMap.values());

    // Fetch author profile pictures
    const authorIds = [...new Set(postsArray.map(p => p.authorId).filter(Boolean))];
    const authorProfiles = {};
    const requestedByMe = {};

    if (authorIds.length > 0) {
      const userSnapshots = await Promise.all(
        authorIds.map(uid => import("firebase/firestore").then(({ getDoc, doc }) => 
          getDoc(doc(db, "users", uid))
        ))
      );

      userSnapshots.forEach((snap, i) => {
        const uid = authorIds[i];
        if (snap.exists()) {
          const data = snap.data();
          authorProfiles[uid] = data.profilePicture || "/user.png";
          if (currentUser) {
            requestedByMe[uid] = Array.isArray(data.friendRequests) && 
                                 data.friendRequests.includes(currentUser.uid);
          }
        }
      });
    }

    // Enhance posts with profile pictures
    postsArray = postsArray.map(post => ({
      ...post,
      profilePicture: authorProfiles[post.authorId] || "/user.png",
      requestedByMe: currentUser ? !!requestedByMe[post.authorId] : false,
    }));

    // Sort by creation date (newest first)
    postsArray.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    return postsArray;
  } catch (err) {
    console.error("Failed to load posts:", err);
    return [];
  }
}

/**
 * Load user's friends from Firestore
 * @param {Object} currentUser - Current authenticated user
 * @returns {Promise<Set>} Set of friend UIDs
 */
export async function loadUserFriends(currentUser) {
  if (!currentUser) return new Set();
  
  try {
    const friendsRef = collection(db, "users", currentUser.uid, "friends");
    const friendsSnap = await getDocs(friendsRef);
    const friendIds = friendsSnap.docs.map(doc => doc.id);
    return new Set(friendIds);
  } catch (err) {
    console.error("Failed to load friends:", err);
    return new Set();
  }
}

/**
 * Load user's saved posts from Firestore
 * @param {Object} currentUser - Current authenticated user
 * @returns {Promise<Set>} Set of saved post IDs
 */
export async function loadUserSavedPosts(currentUser) {
  if (!currentUser) return new Set();
  
  try {
    const savedColl = collection(db, "users", currentUser.uid, "savedPosts");
    const snap = await getDocs(savedColl);
    return new Set(snap.docs.map(d => d.id));
  } catch (err) {
    console.error("Failed to load saved posts:", err);
    return new Set();
  }
}