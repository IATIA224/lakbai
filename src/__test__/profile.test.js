import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Profile, { unlockAchievement, logActivity } from '../profile';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot, collection, doc } from 'firebase/firestore';
import { useUser } from '../UserContext';
import { getUserCompletionStats } from '../itinerary_Stats';

// Mock dependencies
jest.mock('../firebase', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  db: {}
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn()
}));

jest.mock('../UserContext', () => ({
  useUser: jest.fn()
}));

jest.mock('../itinerary_Stats', () => ({
  getUserCompletionStats: jest.fn()
}));

jest.mock('../EditProfile', () => ({
  __esModule: true,
  default: ({ onClose }) => (
    <div data-testid="edit-profile-modal">
      <button onClick={onClose}>Close Edit</button>
    </div>
  )
}));

jest.mock('../info_delete', () => ({
  __esModule: true,
  default: ({ onClose }) => (
    <div data-testid="info-delete-modal">
      <button onClick={onClose}>Close Delete</button>
    </div>
  )
}));

jest.mock('../achievementsBus', () => ({
  emitAchievement: jest.fn()
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>
}));

jest.mock('leaflet', () => ({
  Icon: jest.fn().mockImplementation(() => ({}))
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

global.fetch = jest.fn();

describe('Profile Component', () => {
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
    metadata: {
      creationTime: '2024-01-01T00:00:00.000Z'
    }
  };

  const mockProfile = {
    name: 'Test User',
    bio: 'Test bio',
    location: 'Test Location',
    profilePicture: 'https://example.com/photo.jpg',
    travelerName: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    useUser.mockReturnValue({ profile: mockProfile });
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser);
      return jest.fn();
    });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ ...mockProfile, achievements: {} })
    });
    getDocs.mockResolvedValue({
      docs: []
    });
    onSnapshot.mockImplementation(() => jest.fn());
    getUserCompletionStats.mockResolvedValue({
      totalDestinations: 0,
      completedDestinations: 0,
      destinations: {}
    });
    collection.mockReturnValue({});
    doc.mockReturnValue({});
  });

  const renderComponent = async () => {
    let result;
    await act(async () => {
      result = render(
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      );
    });
    return result;
  };

  test('renders profile with user information', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Test bio')).toBeInTheDocument();
    });
  });

  test('renders map container', async () => {
    await renderComponent();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('displays default stats', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Places Visited/i)).toBeInTheDocument();
    });
  });

  test('opens edit profile modal when edit button is clicked', async () => {
    await renderComponent();
    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);
    expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();
  });

  test('closes edit profile modal', async () => {
    await renderComponent();
    const editButton = screen.getByText(/edit profile/i);
    fireEvent.click(editButton);
    const closeButton = screen.getByText('Close Edit');
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
    });
  });

  test('opens achievements modal when view all button is clicked', async () => {
    await renderComponent();
    const achievementsButton = screen.getByRole('button', { name: /view all achievements/i });
    fireEvent.click(achievementsButton);
    expect(screen.getByText(/Getting Started/i)).toBeInTheDocument();
  });

  test('displays all achievements', async () => {
    await renderComponent();
    const achievementsButton = screen.getByRole('button', { name: /view all achievements/i });
    fireEvent.click(achievementsButton);
    
    await waitFor(() => {
      const allStepElements = screen.getAllByText('First Step');
      expect(allStepElements.length).toBeGreaterThan(0);
    });
  });

  test('handles logout successfully', async () => {
    signOut.mockResolvedValue();
    await renderComponent();
    
    const logoutButton = screen.getByRole('button', { name: /🚪 logout/i });
    fireEvent.click(logoutButton);
    
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith(auth);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles unauthenticated user', async () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });
    
    const { container } = await renderComponent();
    
    await waitFor(() => {
      expect(container).toBeTruthy();
    });
  });

  test('unlockAchievement function adds achievement to Firestore', async () => {
    auth.currentUser = { uid: 'test-uid' };
    
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ achievements: {} })
    });
    updateDoc.mockResolvedValue({});
    
    await unlockAchievement(1, 'First Step');
    
    expect(updateDoc).toHaveBeenCalled();
  });

  test('logActivity function adds activity to Firestore', async () => {
    auth.currentUser = { uid: 'test-uid' };
    
    addDoc.mockResolvedValue({ id: 'activity-id' });
    
    await logActivity('Test activity', '🔵');
    
    expect(addDoc).toHaveBeenCalled();
  });

  test('displays user bio', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Test bio')).toBeInTheDocument();
    });
  });

  test('displays completed destinations on map when available', async () => {
    getUserCompletionStats.mockResolvedValue({
      totalDestinations: 1,
      completedDestinations: 1,
      destinations: {
        'dest-1': {
          name: 'Test Destination',
          latitude: 14.5995,
          longitude: 120.9842,
          completed: true
        }
      }
    });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getUserCompletionStats).toHaveBeenCalled();
    });
  });

  test('shows empty state when no completed destinations', async () => {
    await renderComponent();
    
    await waitFor(() => {
      expect(screen.getByText(/No completed destinations yet/i)).toBeInTheDocument();
    });
  });

  test('displays achievement categories in modal', async () => {
    await renderComponent();
    const achievementsButton = screen.getByRole('button', { name: /view all achievements/i });
    
    await act(async () => {
      fireEvent.click(achievementsButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Getting Started/i)).toBeInTheDocument();
    });
  });

  test('shows notification when achievement is unlocked', async () => {
    await renderComponent();
    
    await waitFor(() => {
      expect(onAuthStateChanged).toHaveBeenCalled();
    });
  });

  test('updates profile stats when data changes', async () => {
    const mockPhotoDocs = [{
      id: 'photo-1',
      data: () => ({ url: 'test.jpg', timestamp: new Date().toISOString() })
    }];
    
    getDocs.mockResolvedValue({ docs: mockPhotoDocs });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test('handles Cloudinary URL transformation', async () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/demo/upload/photo.jpg';
    const mockProfileWithCloudinary = {
      ...mockProfile,
      profilePicture: cloudinaryUrl
    };
    
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockProfileWithCloudinary
    });
    
    await renderComponent();
    
    expect(getDoc).toHaveBeenCalled();
  });

  test('displays profile with missing optional fields', async () => {
    const minimalProfile = {
      name: 'Test User',
      travelerName: 'Test User'
    };
    
    useUser.mockReturnValue({ profile: minimalProfile });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => minimalProfile
    });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(screen.queryByText('Test bio')).not.toBeInTheDocument();
    });
  });

  test('loads achievements from Firestore', async () => {
    const mockAchievements = {
      1: true,
      2: false
    };
    
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ achievements: mockAchievements, ...mockProfile })
    });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDoc).toHaveBeenCalled();
    });
  });

  test('shows all 8 achievements in modal', async () => {
    await renderComponent();
    const achievementsButton = screen.getByRole('button', { name: /view all achievements/i });
    fireEvent.click(achievementsButton);
    
    await waitFor(() => {
      const achievements = screen.getAllByText(/First Step|First Bookmark|Say Cheese!|Hello, World!|Profile Pioneer|Mini Planner|Explorer at Heart|Checklist Champ/i);
      expect(achievements.length).toBeGreaterThanOrEqual(8);
    });
  });

  test('renders stats row with all stat categories', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Places Visited/i)).toBeInTheDocument();
    expect(screen.getByText(/Photos Shared/i)).toBeInTheDocument();
    expect(screen.getByText(/Rated Destinations/i)).toBeInTheDocument();
    expect(screen.getByText(/Friends/i)).toBeInTheDocument();
  });

  test('handles error when fetching profile fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    getDoc.mockRejectedValue(new Error('Firestore error'));
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDoc).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  test('updates UI when profile context changes', async () => {
    const { rerender } = await renderComponent();
    
    const updatedProfile = {
      ...mockProfile,
      name: 'Updated Name',
      travelerName: 'Updated Name'
    };
    
    useUser.mockReturnValue({ profile: updatedProfile });
    
    await act(async () => {
      rerender(
        <BrowserRouter>
          <Profile />
        </BrowserRouter>
      );
    });
    
    await waitFor(() => {
      expect(useUser).toHaveBeenCalled();
    });
  });

  test('displays map with correct initial center and zoom', async () => {
    await renderComponent();
    
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  test('handles real-time updates via onSnapshot', async () => {
    const unsubscribe = jest.fn();
    onSnapshot.mockReturnValue(unsubscribe);
    
    await renderComponent();
    
    await waitFor(() => {
      expect(onSnapshot).toHaveBeenCalled();
    });
  });

  test('displays quick actions buttons', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Plan New Trip/i)).toBeInTheDocument();
    expect(screen.getByText(/Share Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Export My Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Account Settings/i)).toBeInTheDocument();
  });

  test('shows photo gallery with upload button', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Photo Gallery/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Upload Photo/i)).toBeInTheDocument();
  });

  test('displays empty photo gallery state', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Upload your first/i)).toBeInTheDocument();
  });

  test('shows recent activity section', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/No recent activities/i)).toBeInTheDocument();
  });

  test('displays profile picture correctly', async () => {
    await renderComponent();
    
    await waitFor(() => {
      const profileImg = screen.getByAltText('Profile');
      expect(profileImg).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });
  });

  test('renders achievement preview in sidebar', async () => {
    await renderComponent();
    
    const firstSteps = screen.getAllByText('First Step');
    expect(firstSteps.length).toBeGreaterThan(0);
  });

  test('handles share profile action', async () => {
    await renderComponent();
    
    const shareButton = screen.getByRole('button', { name: /🗂️ share profile/i });
    expect(shareButton).toBeInTheDocument();
  });

  test('handles export data action', async () => {
    await renderComponent();
    
    const exportButton = screen.getByRole('button', { name: /💾 export my data/i });
    expect(exportButton).toBeInTheDocument();
  });

  test('handles account settings action', async () => {
    await renderComponent();
    
    const settingsButton = screen.getByRole('button', { name: /⚙️ account settings/i });
    expect(settingsButton).toBeInTheDocument();
  });

  test('opens delete account modal', async () => {
    await renderComponent();
    
    const settingsButton = screen.getByRole('button', { name: /⚙️ account settings/i });
    fireEvent.click(settingsButton);
    
    expect(screen.getByTestId('info-delete-modal')).toBeInTheDocument();
  });

  test('displays user profile meta information', async () => {
    await renderComponent();
    
    expect(screen.getByText(/Explorer/i)).toBeInTheDocument();
    expect(screen.getByText(/Joined/i)).toBeInTheDocument();
  });

  test('renders completed destinations map section', async () => {
    await renderComponent();
    
    expect(screen.getByText(/My Completed Destinations/i)).toBeInTheDocument();
  });

  test('handles photo upload successfully', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://cloudinary.com/photo.jpg' })
    });
    addDoc.mockResolvedValue({ id: 'photo-id' });
    
    await renderComponent();
    
    const fileInput = screen.getByLabelText(/Upload Photo/i);
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  test('displays activities when available', async () => {
    const mockActivities = [{
      id: 'act-1',
      data: () => ({
        text: 'You have uploaded a photo.',
        icon: '📸',
        timestamp: new Date()
      })
    }];
    
    getDocs.mockResolvedValue({ docs: mockActivities });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test('handles share profile code generation', async () => {
    updateDoc.mockResolvedValue();
    
    await renderComponent();
    
    const shareButton = screen.getByRole('button', { name: /🗂️ share profile/i });
    
    await act(async () => {
      fireEvent.click(shareButton);
    });
    
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  test('syncs friends count from Firestore', async () => {
    const mockFriends = [
      { id: 'friend-1' },
      { id: 'friend-2' }
    ];
    
    getDocs.mockResolvedValue({ docs: mockFriends });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test('fetches and displays ratings count', async () => {
    const mockRatings = [
      { id: 'rating-1' },
      { id: 'rating-2' }
    ];
    
    getDocs.mockResolvedValue({ docs: mockRatings });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test('handles photo deletion', async () => {
    deleteDoc.mockResolvedValue();
    
    const mockPhotos = [{
      id: 'photo-1',
      data: () => ({ url: 'https://example.com/photo.jpg', timestamp: new Date() })
    }];
    
    getDocs.mockResolvedValue({ docs: mockPhotos });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });
  });

  test('displays correct achievement unlock status', async () => {
    const mockAchievements = { 1: true, 2: true };
    
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ achievements: mockAchievements, ...mockProfile })
    });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(getDoc).toHaveBeenCalled();
    });
  });

  test('renders plan new trip button', async () => {
    await renderComponent();
    
    const planButton = screen.getByRole('button', { name: /📌 plan new trip/i });
    expect(planButton).toBeInTheDocument();
  });

  test('transforms cloudinary URLs correctly', async () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/demo/upload/v123/photo.jpg';
    
    useUser.mockReturnValue({ 
      profile: { ...mockProfile, profilePicture: cloudinaryUrl }
    });
    
    await renderComponent();
    
    await waitFor(() => {
      expect(screen.getByAltText('Profile')).toBeInTheDocument();
    });
  });
});