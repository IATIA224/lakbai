import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StickyHeader from '../header';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

// Mock dependencies
jest.mock('../firebase', () => ({
  auth: {},
  db: {}
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn()
}));

jest.mock('../Ai', () => ({
  ChatbaseAI: ({ onClose }) => (
    <div data-testid="chatbase-ai">
      <button onClick={onClose}>Close AI</button>
    </div>
  )
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/dashboard' })
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' })
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

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <StickyHeader />
      </BrowserRouter>
    );
  };

  test('renders header with logo and brand name', () => {
    renderComponent();
    expect(screen.getByText('LakbAI')).toBeInTheDocument();
    expect(screen.getByAltText('LakbAI Logo')).toBeInTheDocument();
  });

  test('renders all navigation tabs', () => {
    renderComponent();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Destinations')).toBeInTheDocument();
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    expect(screen.getByText('My Trips')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });

  test('renders AI Assistant button', () => {
    renderComponent();
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  test('renders default user profile picture', () => {
    renderComponent();
    const userIcon = screen.getByAltText('User');
    expect(userIcon).toHaveAttribute('src', '/user.png');
  });

  test('opens AI popup when AI Assistant button is clicked', () => {
    renderComponent();
    const aiButton = screen.getByText('AI Assistant');
    fireEvent.click(aiButton);
    expect(screen.getByTestId('chatbase-ai')).toBeInTheDocument();
  });

  test('closes AI popup when close is triggered', () => {
    renderComponent();
    const aiButton = screen.getByText('AI Assistant');
    fireEvent.click(aiButton);
    const closeButton = screen.getByText('Close AI');
    fireEvent.click(closeButton);
    expect(screen.queryByTestId('chatbase-ai')).not.toBeInTheDocument();
  });

  test('shows login prompt when accessing protected path without token', () => {
    renderComponent();
    const bookmarksTab = screen.getByText('Bookmarks');
    fireEvent.click(bookmarksTab);
    expect(screen.getByText('Please login first')).toBeInTheDocument();
  });

  test('navigates to login when accepting login prompt', () => {
    renderComponent();
    const bookmarksTab = screen.getByText('Bookmarks');
    fireEvent.click(bookmarksTab);
    const loginButton = screen.getByText('Login');
    fireEvent.click(loginButton);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('closes login prompt when rejecting', () => {
    renderComponent();
    const bookmarksTab = screen.getByText('Bookmarks');
    fireEvent.click(bookmarksTab);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
  });

  test('allows navigation to protected path with valid token', () => {
    localStorage.setItem('token', 'valid-token');
    renderComponent();
    const bookmarksTab = screen.getByText('Bookmarks');
    fireEvent.click(bookmarksTab);
    expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
  });

  test('navigates to profile when user icon is clicked', () => {
    renderComponent();
    const userIcon = screen.getByAltText('User');
    fireEvent.click(userIcon);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  test('sets profile picture from Firestore when user is authenticated', async () => {
    const mockUser = {
      uid: 'test-uid',
      photoURL: null
    };
    const mockSnapshot = {
      exists: () => true,
      data: () => ({ profilePicture: 'https://example.com/profile.jpg' })
    };
    
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });
    getDoc.mockResolvedValue(mockSnapshot);

    renderComponent();

    await waitFor(() => {
      const userIcon = screen.getByAltText('User');
      expect(userIcon).toHaveAttribute('src', 'https://example.com/profile.jpg');
    });
  });

  test('uses photoURL when Firestore profile picture is not available', async () => {
    const mockUser = {
      uid: 'test-uid',
      photoURL: 'https://example.com/photo.jpg'
    };
    const mockSnapshot = {
      exists: () => true,
      data: () => ({})
    };
    
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });
    getDoc.mockResolvedValue(mockSnapshot);

    renderComponent();

    await waitFor(() => {
      const userIcon = screen.getByAltText('User');
      expect(userIcon).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });
  });

  test('does not show login prompt for non-protected paths', () => {
    renderComponent();
    const dashboardTab = screen.getByText('Dashboard');
    fireEvent.click(dashboardTab);
    expect(screen.queryByText('Please login first')).not.toBeInTheDocument();
  });
});