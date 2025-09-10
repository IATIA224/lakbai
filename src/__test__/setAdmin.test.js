// setAdmin.js runs side effects immediately upon import.
// We can mock firebase/firestore functions BEFORE requiring it.
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({}))
}));

const setDocMock = jest.fn(() => Promise.resolve());
const docMock = jest.fn(() => ({}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: (...args) => docMock(...args),
  setDoc: (...args) => setDocMock(...args),
}));

describe('setAdmin script', () => {
  test('invokes setDoc on import', async () => {
    await import('../setAdmin'); // triggers side-effect
    expect(setDocMock).toHaveBeenCalled();
  });
});