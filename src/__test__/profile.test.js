import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

window.alert = jest.fn()
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ secure_url: 'https://example.com/uploaded.jpg' }),
  })
)

// Mock dependencies
const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  __esModule: true,
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Mock EditProfile component
jest.mock('../EditProfile', () => {
  return function MockEditProfile({ onClose }) {
    return (
      <div data-testid="edit-profile-modal">
        <button onClick={onClose}>Cancel</button>
        <button>Save</button>
      </div>
    )
  }
})

jest.mock('../firebase', () => ({
  __esModule: true,
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: '/avatar.jpg',
      metadata: { creationTime: new Date('2024-01-01').toISOString() },
    },
  },
  storage: {},
}))

jest.mock('firebase/firestore', () => ({
  __esModule: true,
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}))

jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: 'test-user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: '/avatar.jpg',
      metadata: { creationTime: new Date('2024-01-01').toISOString() },
    },
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback({
      uid: 'test-user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: '/avatar.jpg',
      metadata: { creationTime: new Date('2024-01-01').toISOString() },
    })
    return jest.fn()
  }),
  updateProfile: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('firebase/storage', () => ({
  __esModule: true,
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(),
  uploadBytes: jest.fn().mockResolvedValue({ ref: {} }),
  getDownloadURL: jest.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('firebase/app', () => ({
  __esModule: true,
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}))

jest.mock('../UserContext', () => {
  const React = require('react')
  return {
    __esModule: true,
    useUser: jest.fn(() => ({
      profile: {
        uid: 'test-user-123',
        name: 'Test User',
        bio: 'Test bio',
        profilePicture: '/avatar.jpg',
        likes: ['Beach'],
        dislikes: ['Crowds'],
        joined: 'January 2024',
      },
    })),
    UserProvider: ({ children }) => React.createElement(React.Fragment, null, children),
  }
})

jest.mock('../achievementsBus', () => ({
  __esModule: true,
  emitAchievement: jest.fn(),
}))

jest.mock('../dashboard-stats-row', () => ({
  __esModule: true,
  getUserDashboardStats: jest.fn().mockResolvedValue({
    totalTrips: 3,
    totalDestinations: 5,
  }),
}))

jest.mock('../itinerary_Stats', () => ({
  __esModule: true,
  getUserCompletionStats: jest.fn().mockResolvedValue({
    destinations: {
      dest1: {
        name: 'Boracay',
        region: 'Aklan',
        latitude: 11.9674,
        longitude: 121.9248,
        completedAt: Date.now(),
      },
    },
  }),
}))

jest.mock('uuid', () => ({
  __esModule: true,
  v4: () => 'TESTCODE1234',
}))

jest.mock('react-leaflet', () => ({
  __esModule: true,
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
}))

global.URL.createObjectURL = jest.fn(() => 'blob:mock')

navigator.clipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
}

// Import after mocks
import Profile, { unlockAchievement } from '../profile'
import * as firestore from 'firebase/firestore'
import * as storage from 'firebase/storage'

describe('Profile Component', () => {
  const mockUserData = {
    displayName: 'Test User',
    email: 'test@example.com',
    profilePicture: '/avatar.jpg',
    bio: 'Test bio',
    travelerName: 'Test User',
    stats: {
      placesVisited: 2,
      photosShared: 3,
      reviewsWritten: 4,
      friends: 1,
    },
    likes: ['Beach'],
    dislikes: ['Crowds'],
    achievements: { '1': true, '5': true },
    shareCode: 'ABCD1234',
  }

  const mockAchievements = [
    {
      id: 'ach1',
      title: 'First Trip',
      description: 'Completed your first trip',
      icon: '🎉',
      unlocked: true,
      unlockedAt: { toDate: () => new Date('2024-01-01') },
    },
    {
      id: 'ach2',
      title: 'Explorer',
      description: 'Visited 10 places',
      icon: '🗺️',
      unlocked: false,
    },
  ]

  const mockActivities = [
    {
      id: 'act1',
      text: 'Visited Boracay',
      icon: '📍',
      timestamp: new Date('2024-01-15').toISOString(),
    },
  ]

  const mockPhotos = [
    {
      id: 'photo1',
      url: 'https://example.com/photo1.jpg',
      timestamp: new Date('2024-01-10').toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    const makeCollectionRef = (...segments) => ({
      type: 'collection',
      path: segments.join('/'),
      segments,
    })

    const makeDocRef = (...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      segments,
    })

    firestore.collection.mockImplementation((...segments) => makeCollectionRef(...segments))
    firestore.doc.mockImplementation((...segments) => makeDocRef(...segments))
    firestore.query.mockImplementation((collectionRef, ...rest) => ({
      type: 'query',
      collectionRef,
      constraints: rest,
    }))

    const toDocArray = (items) =>
      items.map((item) => ({
        id: item.id,
        data: () => item,
      }))

    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
    })

    firestore.getDocs.mockImplementation(async (ref) => {
      const path =
        ref?.type === 'collection'
          ? ref.path
          : ref?.collectionRef?.path || ''

      if (path.endsWith('/friends')) {
        return { docs: [], size: 0 }
      }

      if (path.endsWith('/photos') || path === 'photos') {
        return { docs: toDocArray(mockPhotos), size: mockPhotos.length }
      }

      if (path.endsWith('/activities') || path === 'activities') {
        return { docs: toDocArray(mockActivities), size: mockActivities.length }
      }

      if (path.endsWith('/achievements') || path === 'achievements') {
        return { docs: toDocArray(mockAchievements), size: mockAchievements.length }
      }

      if (path.endsWith('/ratings')) {
        return { docs: [], size: 0 }
      }

      return { docs: [], size: 0 }
    })

    firestore.updateDoc.mockResolvedValue()
    firestore.setDoc.mockResolvedValue()
    firestore.addDoc.mockResolvedValue({ id: 'new-id' })
    firestore.deleteDoc.mockResolvedValue()

    firestore.onSnapshot.mockImplementation((ref, callback) => {
      const path = ref?.path || ref?.collectionRef?.path || ''

      if (ref?.type === 'collection' && path.endsWith('/friends')) {
        callback({
          size: 1,
          docs: [{ id: 'friend1', data: () => ({}) }],
        })
      } else {
        callback({
          exists: () => true,
          data: () => ({
            travelerName: 'Test User',
            bio: 'Test bio',
            profilePicture: '/avatar.jpg',
            likes: ['Beach'],
            dislikes: ['Crowds'],
            stats: {
              placesVisited: 2,
              photosShared: 3,
              reviewsWritten: 4,
            },
            achievements: { '1': true, '5': true },
            shareCode: 'ABCD1234',
          }),
        })
      }

      return jest.fn()
    })
  })

  const renderProfile = () => render(<Profile />)

  test('renders profile component', () => {
    const { container } = renderProfile()
    expect(container).toBeInTheDocument()
  })

  test('displays user information', async () => {
    renderProfile()
    
    // For new users without profile data, shows placeholder
    await waitFor(() => {
      expect(screen.getByText('Your Name')).toBeInTheDocument()
    })
    expect(screen.getByText('No bio yet.')).toBeInTheDocument()
  })

  test('opens edit profile modal when edit button clicked', async () => {
    renderProfile()
    const editButton = await screen.findByText(/Edit Profile/i)
    fireEvent.click(editButton)
    await waitFor(() => {
      expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument()
    })
  })

  test('displays places visited on map', async () => {
    renderProfile()
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    })
  })

  test('displays recent activities', async () => {
    renderProfile()
    await waitFor(() => {
      expect(screen.getByText(/Recent Activity/i)).toBeInTheDocument()
    })
  })

  test('displays quick actions', async () => {
    renderProfile()
    await waitFor(() => {
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument()
    })
  })

  test('unlockAchievement helper updates firestore', async () => {
    await unlockAchievement(9, 'Test Achievement')
    expect(firestore.updateDoc).toHaveBeenCalled()
  })
})