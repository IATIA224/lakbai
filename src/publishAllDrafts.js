import { db } from './firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function publishAllDrafts() {
    const colRef = collection(db, 'destinations');
    const snapshot = await getDocs(colRef);
    const batchPromises = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (String(data.status).toLowerCase() === 'draft') {
            batchPromises.push(
                updateDoc(doc(db, 'destinations', docSnap.id), {
                    status: 'published',
                    statusDisplay: 'PUBLISHED', // add a display field if needed
                    updatedAt: new Date()
                })
            );
            // Also update the main status field to 'PUBLISHED' for UI compatibility
            batchPromises.push(
                updateDoc(doc(db, 'destinations', docSnap.id), {
                    status: 'PUBLISHED',
                    updatedAt: new Date()
                })
            );
        }
    });

    await Promise.all(batchPromises);
    return batchPromises.length;
}