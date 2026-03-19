import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StickyHeader from '../header';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

// Mock dependencies
jest.mock('../firebase', () => ({
  auth: {},
  db: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('../Ai', () => ({
  ChatbaseAI: ({ onClose }) => (
    <div data-testid="chatbase-ai">
      <button onClick={onClose}>Close AI</button>
    </div>
  ),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('StickyHeader Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });
  });

  const renderHeader = (initialPath = '/dashboard') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <StickyHeader />
      </MemoryRouter>
    );
  };

  describe('Header Rendering', () => {
    test('renders logo and brand name', () => {
      renderHeader();
      expect(screen.getByAltText('LakbAI Logo')).toBeInTheDocument();
      expect(screen.getByText('LakbAI')).toBeInTheDocument();
    });

    test('renders all navigation tabs', () => {
      renderHeader();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Destinations')).toBeInTheDocument();
      expect(screen.getByText('Bookmarks')).toBeInTheDocument();
      expect(screen.getByText('My Trips')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
    });

    test('renders AI Assistant button', () => {
      renderHeader();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    test('renders Sign in button when not logged in', () => {
      renderHeader();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });
  });

  describe('Navigation Tab Behavior', () => {
    test('navigates to unprotected path when clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Dashboard'));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    test('navigates to Destinations when clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Destinations'));
      expect(mockNavigate).toHaveBeenCalledWith('/bookmarks2');
    });

    test('shows login prompt for protected path when not logged in', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Bookmarks'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
    });

    test('shows login prompt for Community when not logged in', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Community'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
    });

    test('shows login prompt for My Trips when not logged in', () => {
      renderHeader();
      fireEvent.click(screen.getByText('My Trips'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
    });
  });

  describe('AI Assistant Popup', () => {
    test('opens AI popup when AI Assistant button is clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('AI Assistant'));
      expect(screen.getByTestId('chatbase-ai')).toBeInTheDocument();
    });

    test('closes AI popup when close button is clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('AI Assistant'));
      expect(screen.getByTestId('chatbase-ai')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Close AI'));
      expect(screen.queryByTestId('chatbase-ai')).not.toBeInTheDocument();
    });

    test('closes AI popup when clicking outside overlay', () => {
      renderHeader();
      fireEvent.click(screen.getByText('AI Assistant'));
      // The overlay is the second child in the popup container
      const overlays = document.querySelectorAll('div[style*="position: fixed"]');
      // Click the overlay (not the chatbot itself)
      fireEvent.click(overlays[1]);
      expect(screen.queryByTestId('chatbase-ai')).not.toBeInTheDocument();
    });

    test('remains AI popup open when clicking inside chatbot', () => {
      renderHeader();
      fireEvent.click(screen.getByText('AI Assistant'));
      // Click inside the chatbot (the close button is inside)
      fireEvent.click(screen.getByTestId('chatbase-ai'));
      expect(screen.getByTestId('chatbase-ai')).toBeInTheDocument();
    });
  });

  describe('Login Prompt Modal', () => {
    test('shows login prompt when Sign in button is clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Sign in'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
      expect(screen.getByText('You need to be logged in to access this page.')).toBeInTheDocument();
    });

    test('navigates to login page when Login button is clicked in modal', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Sign in'));
      fireEvent.click(screen.getByText('Login'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    test('closes modal when Cancel button is clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Sign in'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
    });

    test('does not render when modal is closed', () => {
      renderHeader();
      expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
    });

    test('renders modal content when Sign in is clicked', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Sign in'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Authenticated User Behavior', () => {
    beforeEach(() => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({
          uid: 'test-user-id',
          photoURL: 'https://example.com/photo.jpg',
          getIdToken: jest.fn().mockResolvedValue('mock-token'),
        });
        return jest.fn();
      });
      getDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });
    });

    test('renders user profile picture when logged in', async () => {
      renderHeader();
      await waitFor(() => {
        expect(screen.getByAltText('User')).toBeInTheDocument();
      });
    });

    test('does not show Sign in button when logged in', async () => {
      renderHeader();
      await waitFor(() => {
        expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
      });
    });

    test('navigates to profile when profile picture is clicked', async () => {
      renderHeader();
      await waitFor(() => {
        const userIcon = screen.getByAltText('User');
        fireEvent.click(userIcon);
        expect(mockNavigate).toHaveBeenCalledWith('/profile');
      });
    });

    test('navigates to protected path when logged in', async () => {
      renderHeader();
      await waitFor(() => {
        expect(screen.getByAltText('User')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Bookmarks'));
      expect(mockNavigate).toHaveBeenCalledWith('/bookmark');
    });

    test('stores token in localStorage when authenticated', async () => {
      renderHeader();
      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('mock-token');
      });
    });
  });

  describe('Profile Picture Loading', () => {
    test('uses Firestore profile picture when available', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({
          uid: 'test-user-id',
          photoURL: 'https://example.com/auth-photo.jpg',
          getIdToken: jest.fn().mockResolvedValue('mock-token'),
        });
        return jest.fn();
      });
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ profilePicture: 'https://example.com/firestore-photo.jpg' }),
      });

      renderHeader();
      await waitFor(() => {
        const userIcon = screen.getByAltText('User');
        expect(userIcon).toHaveAttribute('src', 'https://example.com/firestore-photo.jpg');
      });
    });

    test('uses auth photoURL when Firestore profile is not available', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({
          uid: 'test-user-id',
          photoURL: 'https://example.com/auth-photo.jpg',
          getIdToken: jest.fn().mockResolvedValue('mock-token'),
        });
        return jest.fn();
      });
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      renderHeader();
      await waitFor(() => {
        const userIcon = screen.getByAltText('User');
        expect(userIcon).toHaveAttribute('src', 'https://example.com/auth-photo.jpg');
      });
    });

    test('uses default user.png when no profile picture is available', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({
          uid: 'test-user-id',
          photoURL: null,
          getIdToken: jest.fn().mockResolvedValue('mock-token'),
        });
        return jest.fn();
      });
      getDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });

      renderHeader();
      await waitFor(() => {
        const userIcon = screen.getByAltText('User');
        expect(userIcon).toHaveAttribute('src', '/user.png');
      });
    });
  });

  describe('Auth State Changes', () => {
    test('cleans up localStorage when user logs out', async () => {
      localStorage.setItem('token', 'old-token');
      
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return jest.fn();
      });

      renderHeader();
      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
      });
    });

    test('unsubscribes from auth listener on unmount', () => {
      const unsubscribeMock = jest.fn();
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return unsubscribeMock;
      });

      const { unmount } = renderHeader();
      unmount();
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Active Tab Styling', () => {
    test('highlights Dashboard tab when on dashboard path', () => {
      renderHeader('/dashboard');
      const dashboardTab = screen.getByText('Dashboard');
      expect(dashboardTab).toHaveClass('active');
    });

    test('highlights Destinations tab when on bookmarks2 path', () => {
      renderHeader('/bookmarks2');
      const destinationsTab = screen.getByText('Destinations');
      expect(destinationsTab).toHaveClass('active');
    });
  });

  describe('StickyHeader - Additional Behavior', () => {
    test('active tab changes when navigating', () => {
      renderHeader('/dashboard');
      expect(screen.getByText('Dashboard')).toHaveClass('active');
      fireEvent.click(screen.getByText('Destinations'));
      expect(mockNavigate).toHaveBeenCalledWith('/bookmarks2');
    });

    test('pendingTab is cleared after closing login prompt', () => {
      renderHeader();
      fireEvent.click(screen.getByText('Bookmarks'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
      // Try again to ensure prompt can be reopened
      fireEvent.click(screen.getByText('Bookmarks'));
      expect(screen.getByText('Please login first')).toBeInTheDocument();
    });

    test('does not crash if user.getIdToken throws', async () => {
      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({
          uid: 'test-user-id',
          photoURL: 'https://example.com/photo.jpg',
          getIdToken: jest.fn().mockRejectedValue(new Error('fail')),
        });
        return jest.fn();
      });
      getDoc.mockResolvedValue({
        exists: () => false,
        data: () => null,
      });
      renderHeader();
      await waitFor(() => {
        expect(screen.getByAltText('User')).toBeInTheDocument();
      });
    });

    test('Sign in button is styled correctly', () => {
      renderHeader();
      const signInBtn = screen.getByText('Sign in');
      expect(signInBtn).toHaveStyle('background: #fff');
      expect(signInBtn).toHaveStyle('color: #1976d2');
      expect(signInBtn).toHaveStyle('border-radius: 10px');
    });
  });
});