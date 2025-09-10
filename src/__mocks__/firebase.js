// Generic firebase mock used by modules that import from './firebase'
export const auth = {
    currentUser: { uid: 'test-user' },
};

export const db = {
    __mock: true
};

// Firestore functions (mock no-ops)
export const collection = jest.fn(() => ({}));
export const doc = jest.fn(() => ({}));
export const setDoc = jest.fn(() => Promise.resolve());
export const getDocs = jest.fn(() => Promise.resolve({ empty: true, forEach: () => {} }));
export const writeBatch = jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn(() => Promise.resolve())
}));
export const onSnapshot = jest.fn((_ref, cb) => {
  // Return unsubscribe
    return () => {};
});
export const deleteDoc = jest.fn(() => Promise.resolve());
export const query = jest.fn();
export const where = jest.fn();
export const serverTimestamp = jest.fn(() => ({ seconds: Date.now() / 1000 }));