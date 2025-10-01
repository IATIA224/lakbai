import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Create an audit log entry for a destination import.
 * @param {Object} params
 * @param {Object} params.destination - The imported destination object.
 * @param {string} params.userId - The user ID performing the import.
 * @param {string} params.userEmail - The user's email.
 * @param {string} params.userRole - The user's role.
 * @param {string} [params.sessionId] - Optional session ID.
 * @param {string} [params.device] - Optional device info.
 * @param {string} [params.browser] - Optional browser info.
 * @param {string} [params.os] - Optional OS info.
 * @param {string} [params.userAgent] - Optional user agent string.
 * @param {string} [params.outcome] - Optional outcome (e.g., "success (200)").
 */
export async function logDestinationImport({
    destination,
    userId,
    userEmail,
    userRole,
    sessionId,
    device,
    browser,
    os,
    userAgent,
    outcome = 'success (200)'
}) {
    if (!destination) return;

const log = {
    eventType: 'destination import',
    timestamp: serverTimestamp(),
    action: 'destination import',
    category: 'destinations',
    target: destination.name || '',
    outcome,
    eventDetails: {
    importedData: {
        name: destination.name,
        region: destination.region,
        categories: destination.categories,
        // Add more fields as needed
    }
    },
    user: {
    id: userId || '',
    email: userEmail || '',
    role: userRole || '',
    session: sessionId || '',
    },
    source: {
    device: device || '',
    browser: browser || '',
    os: os || '',
    userAgent: userAgent || '',
    },
    securityFlags: [],
};

await addDoc(collection(db, 'auditLogs'), log);
}