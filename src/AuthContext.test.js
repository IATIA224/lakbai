import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from './AuthContext';

// Mock firebase auth
jest.mock('./firebase', () => ({
  auth: {
    currentUser: null
  }
}));

// Create a proper mock that ensures unsubscribe function is always returned
let mockUnsubscribe = jest.fn();

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Immediately call callback with null user for initial state
    if (callback) {
      setTimeout(() => callback(null), 0);
    }
    
    // Always return the mock unsubscribe function
    return mockUnsubscribe;
  })
}));

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock unsubscribe function
    mockUnsubscribe = jest.fn();
    const { onAuthStateChanged } = require('firebase/auth');
    onAuthStateChanged.mockReturnValue(mockUnsubscribe);
  });

  describe('AuthProvider', () => {
    test('renders children without crashing', () => {
      const TestChild = () => <div>Test Child</div>;
      
      const { getByText } = render(
        <AuthProvider>
          <TestChild />
        </AuthProvider>
      );

      expect(getByText('Test Child')).toBeInTheDocument();
    });

    test('sets up auth state listener on mount', () => {
      const { onAuthStateChanged } = require('firebase/auth');
      
      render(
        <AuthProvider>
          <div>Test</div>
        </AuthProvider>
      );

      expect(onAuthStateChanged).toHaveBeenCalledWith(
        expect.any(Object), // auth object
        expect.any(Function) // callback function
      );
    });

    test('provides user data to children through context', async () => {
      const TestConsumer = () => {
        const user = useAuth();
        return (
          <div>
            <span data-testid="user-uid">{user?.uid || 'no-uid'}</span>
            <span data-testid="user-email">{user?.email || 'no-email'}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Initially should be null, then updated by the mocked onAuthStateChanged
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(getByTestId('user-uid')).toBeInTheDocument();
      expect(getByTestId('user-email')).toBeInTheDocument();
    });
  });

  describe('useAuth', () => {
    test('returns user from context', () => {
      let userFromHook = null;

      const TestConsumer = () => {
        userFromHook = useAuth();
        return <div>Consumer</div>;
      };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Initially should be null (before Firebase auth resolves)
      expect(userFromHook).toBeNull();
    });

    test('can be used without provider (returns undefined)', () => {
      let userFromHook = 'not-set';

      const TestConsumer = () => {
        userFromHook = useAuth();
        return <div>Consumer</div>;
      };

      render(<TestConsumer />);

      expect(userFromHook).toBeUndefined();
    });

    test('works with multiple consumers', () => {
      const users = [];

      const Consumer1 = () => {
        const user = useAuth();
        users.push(user);
        return <span data-testid="consumer1">Consumer 1</span>;
      };

      const Consumer2 = () => {
        const user = useAuth();
        users.push(user);
        return <span data-testid="consumer2">Consumer 2</span>;
      };

      const { getByTestId } = render(
        <AuthProvider>
          <Consumer1 />
          <Consumer2 />
        </AuthProvider>
      );

      expect(getByTestId('consumer1')).toBeInTheDocument();
      expect(getByTestId('consumer2')).toBeInTheDocument();
      
      // Both consumers should receive the same initial value
      expect(users[0]).toBe(users[1]);
    });
  });

  test('cleans up auth listener on unmount', () => {
    const mockUnsubscribe = jest.fn();
    const { onAuthStateChanged } = require('firebase/auth');
    
    // Update the mock to return our mock unsubscribe function
    onAuthStateChanged.mockReturnValue(mockUnsubscribe);

    const { unmount } = render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    );

    // Verify the listener was set up
    expect(onAuthStateChanged).toHaveBeenCalled();

    // Unmount the component
    unmount();

    // Verify cleanup was called
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('handles auth state changes', async () => {
    const { onAuthStateChanged } = require('firebase/auth');
    let authCallback = null;

    // Capture the callback function
    onAuthStateChanged.mockImplementation((auth, callback) => {
      authCallback = callback;
      return jest.fn(); // mock unsubscribe
    });

    const TestConsumer = () => {
      const user = useAuth();
      return (
        <div>
          <span data-testid="auth-status">
            {user ? `authenticated:${user.uid}` : 'not-authenticated'}
          </span>
        </div>
      );
    };

    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially should show not authenticated
    expect(getByTestId('auth-status')).toHaveTextContent('not-authenticated');

    // Simulate user login
    if (authCallback) {
      authCallback({ uid: 'new-user-123', email: 'newuser@example.com' });
    }

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getByTestId('auth-status')).toHaveTextContent('authenticated:new-user-123');

    // Simulate user logout
    if (authCallback) {
      authCallback(null);
    }

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(getByTestId('auth-status')).toHaveTextContent('not-authenticated');
  });
});