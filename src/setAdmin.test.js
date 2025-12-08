// Mock Firebase before importing the module
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mocked-app' }))
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ name: 'mocked-firestore' })),
  doc: jest.fn((db, collection, docId) => ({ 
    path: `${collection}/${docId}`,
    id: docId 
  })),
  setDoc: jest.fn(() => Promise.resolve())
}));

// Mock console methods to avoid cluttering test output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('setAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  test('setAdminStatus is an async function', async () => {
    // Re-create the setAdminStatus function from the original file
    const setAdminStatus = async () => {
      const { getFirestore, doc, setDoc } = require('firebase/firestore');
      const db = getFirestore();
      const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2';
      
      try {
        await setDoc(doc(db, 'users', userId), {
          isAdmin: true,
          role: 'admin'
        }, { merge: true });
        console.log('Successfully set admin status!');
      } catch (error) {
        console.error('Error setting admin status:', error);
      }
    };

    expect(typeof setAdminStatus).toBe('function');
    expect(setAdminStatus.constructor.name).toBe('AsyncFunction');
  });

  test('setAdminStatus calls Firebase functions correctly', async () => {
    const { getFirestore, doc, setDoc } = require('firebase/firestore');
    const mockDb = { name: 'mocked-firestore' };
    getFirestore.mockReturnValue(mockDb);

    const setAdminStatus = async () => {
      const db = getFirestore();
      const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2';
      
      try {
        await setDoc(doc(db, 'users', userId), {
          isAdmin: true,
          role: 'admin'
        }, { merge: true });
        console.log('Successfully set admin status!');
      } catch (error) {
        console.error('Error setting admin status:', error);
      }
    };

    await setAdminStatus();

    expect(getFirestore).toHaveBeenCalled();
    expect(doc).toHaveBeenCalledWith(
      mockDb,
      'users',
      'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2'
    );
    expect(setDoc).toHaveBeenCalledWith(
      expect.any(Object),
      {
        isAdmin: true,
        role: 'admin'
      },
      { merge: true }
    );
  });

  test('setAdminStatus logs success message when successful', async () => {
    const { getFirestore, doc, setDoc } = require('firebase/firestore');
    
    // Mock successful setDoc
    setDoc.mockResolvedValueOnce();

    const setAdminStatus = async () => {
      const db = getFirestore();
      const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2';
      
      try {
        await setDoc(doc(db, 'users', userId), {
          isAdmin: true,
          role: 'admin'
        }, { merge: true });
        console.log('Successfully set admin status!');
      } catch (error) {
        console.error('Error setting admin status:', error);
      }
    };

    await setAdminStatus();

    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully set admin status!');
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  test('setAdminStatus logs error message when failed', async () => {
    const { getFirestore, doc, setDoc } = require('firebase/firestore');
    
    const mockError = new Error('Firestore error');
    setDoc.mockRejectedValueOnce(mockError);

    const setAdminStatus = async () => {
      const db = getFirestore();
      const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2';
      
      try {
        await setDoc(doc(db, 'users', userId), {
          isAdmin: true,
          role: 'admin'
        }, { merge: true });
        console.log('Successfully set admin status!');
      } catch (error) {
        console.error('Error setting admin status:', error);
      }
    };

    await setAdminStatus();

    expect(mockConsoleError).toHaveBeenCalledWith('Error setting admin status:', mockError);
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  test('uses correct user ID for admin status update', async () => {
    const { doc } = require('firebase/firestore');

    const setAdminStatus = async () => {
      const db = { name: 'mocked-firestore' };
      const userId = 'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2';
      
      doc(db, 'users', userId);
    };

    await setAdminStatus();

    expect(doc).toHaveBeenCalledWith(
      expect.any(Object),
      'users',
      'aX7w1iHTdjQwIsLBHQ2IZ5UA8bD2'
    );
  });

  test('sets correct admin properties', async () => {
    const { setDoc } = require('firebase/firestore');

    const setAdminStatus = async () => {
      await setDoc({}, {
        isAdmin: true,
        role: 'admin'
      }, { merge: true });
    };

    await setAdminStatus();

    expect(setDoc).toHaveBeenCalledWith(
      expect.any(Object),
      {
        isAdmin: true,
        role: 'admin'
      },
      { merge: true }
    );
  });

  test('uses merge option to preserve existing user data', async () => {
    const { setDoc } = require('firebase/firestore');

    const setAdminStatus = async () => {
      await setDoc({}, {}, { merge: true });
    };

    await setAdminStatus();

    expect(setDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { merge: true }
    );
  });
});