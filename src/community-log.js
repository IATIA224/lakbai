import { addDoc, collection, serverTimestamp, getDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

// Helper to get browser info
function getBrowser() {
  if (navigator.userAgentData?.brands?.length) {
    return navigator.userAgentData.brands.map(b => b.brand).join(", ");
  }
  if (navigator.userAgent) {
    if (navigator.userAgent.includes("Chrome")) return "Chrome";
    if (navigator.userAgent.includes("Firefox")) return "Firefox";
    if (navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome")) return "Safari";
    if (navigator.userAgent.includes("Edg")) return "Edge";
    if (navigator.userAgent.includes("OPR")) return "Opera";
    return navigator.userAgent;
  }
  return "Unknown";
}

// Helper to get platform/OS
function getPlatform() {
  return navigator.userAgentData?.platform || navigator.platform || "Unknown";
}

// Helper to get session
function getSession() {
  return localStorage.getItem("session") || "—";
}

// Helper to get user agent string
function getUserAgent() {
  return navigator.userAgent || "—";
}

// Helper to get user role from Firestore users collection
async function getUserRole(uid) {
  if (!uid) return "—";
  try {
    // Try to get role from users collection first
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists() && userDoc.data().role) {
      return userDoc.data().role;
    }
    // Fallback: check Admin collection for admin role
    const adminDoc = await getDoc(doc(db, "Admin", uid));
    if (adminDoc.exists() && adminDoc.data().role) {
      return adminDoc.data().role;
    }
    return "user";
  } catch {
    return "—";
  }
}

// Log a community post creation event to auditLogs
export async function logCommunityShareAdventure({ postId, postTitle, location, user }) {
  try {
    const uid = user?.uid || "—";
    const userName = user?.displayName || user?.name || "—";
    const userEmail = user?.email || "—";
    const session = getSession();
    const userAgent = getUserAgent();
    const role = await getUserRole(uid);

    await addDoc(collection(db, "auditLogs"), {
      action: "share adventure",
      category: "CONTENT CREATION",
      target: `community_post${postId ? ` (${postId})` : ""}`,
      details: postTitle || "—",
      location: location || "—",
      outcome: "SUCCESS",
      userId: uid,
      userEmail,
      userName,
      role,
      device: getPlatform(),
      browser: getBrowser(),
      os: getPlatform(),
      timestamp: serverTimestamp(), // Firestore server timestamp
      clientTime: Date.now(),       // Client-side timestamp (ms since epoch)
      session,
      userAgent,
      uid
    });
  } catch (err) {
    // Non-blocking: log error to console
    console.error("Failed to log community share adventure:", err);
  }
}

// Log a community post deletion event to auditLogs
export async function logCommunityDeleteAdventure({ postId, postTitle, location, deletedBy }) {
  try {
    const uid = deletedBy?.uid || "—";
    const userName = deletedBy?.displayName || deletedBy?.name || "—";
    const userEmail = deletedBy?.email || "—";
    const session = getSession();
    const userAgent = getUserAgent();
    const role = await getUserRole(uid);

    await addDoc(collection(db, "auditLogs"), {
      action: "delete adventure",
      category: "CONTENT DELETION", // Changed category here
      target: `community_post${postId ? ` (${postId})` : ""}`,
      details: postTitle || "—",
      location: location || "—",
      outcome: "SUCCESS",
      userId: uid,
      userEmail,
      userName,
      role,
      device: getPlatform(),
      browser: getBrowser(),
      os: getPlatform(),
      timestamp: serverTimestamp(),
      clientTime: Date.now(),
      session,
      userAgent,
      uid
    });
  } catch (err) {
    console.error("Failed to log community delete adventure:", err);
  }
}