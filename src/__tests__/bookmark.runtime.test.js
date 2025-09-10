import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Bookmark from '../bookmark';

// Mock Firebase modules to prevent authentication calls
jest.mock('../firebase', () => ({
  db: {},
  auth: {
    onAuthStateChanged: jest.fn((callback) => {
      // Simulate immediate auth state change to test setter functions
      const unsubscribe = jest.fn();
      setTimeout(() => {
        callback(null); // No user logged in
      }, 0);
      return unsubscribe; // Return unsubscribe function
    }),
    currentUser: null
  }
}));

// Mock Firebase Firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  orderBy: jest.fn(),
  query: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn()
}));

// Mock the profile module to avoid dependency issues
jest.mock('../profile', () => ({
  unlockAchievement: jest.fn()
}));

// Mock the Itinerary module
jest.mock('../Itinerary', () => ({
  addTripForCurrentUser: jest.fn()
}));

// Mock CSS import
jest.mock('../Styles/bookmark.css', () => ({}));

describe('Bookmark Component Runtime Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset console.warn spy
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.warn
    console.warn.mockRestore();
  });

  test('should render without throwing "setLoading is not a function" error', () => {
    expect(() => {
      render(
        <MemoryRouter>
          <Bookmark />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  test('should not log warnings about missing useState setters', async () => {
    render(
      <MemoryRouter>
        <Bookmark />
      </MemoryRouter>
    );

    // Wait for auth state change to process
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check that no warnings were logged about missing setters
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('setLoading is not a function')
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('setCurrentUser is not a function')
    );
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('setItems is not a function')
    );
  });

  test('should handle auth state changes without errors', async () => {
    const { container } = render(
      <MemoryRouter>
        <Bookmark />
      </MemoryRouter>
    );

    // Wait for initial render and auth state processing
    await new Promise(resolve => setTimeout(resolve, 10));

    // Component should render successfully
    expect(container).toBeInTheDocument();
    
    // Should contain the bookmark page structure
    expect(container.querySelector('.App.bm-page')).toBeInTheDocument();
  });

  test('should have properly scoped useState setters', () => {
    // This test ensures the component structure doesn't change in a way that would break setter scope
    const mockAuth = require('../firebase').auth;
    
    render(
      <MemoryRouter>
        <Bookmark />
      </MemoryRouter>
    );

    // Verify that auth.onAuthStateChanged was called (meaning component mounted successfully)
    expect(mockAuth.onAuthStateChanged).toHaveBeenCalled();
    
    // Verify the callback function exists and can be called without errors
    const authCallback = mockAuth.onAuthStateChanged.mock.calls[0][0];
    expect(() => {
      authCallback(null); // Test with no user
    }).not.toThrow();
  });
});