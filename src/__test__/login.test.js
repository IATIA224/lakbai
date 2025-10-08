import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// helper mocks
const mockNavigate = jest.fn()
const mockSetUser = jest.fn()

// module mocks (must come BEFORE importing Login component)
jest.mock('../header_2', () => () => <div data-testid="header2" />)

jest.mock('../UserContext', () => ({
  useUser: () => ({ setUser: mockSetUser }),
}))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, ...rest }) => <a {...rest}>{children}</a>,
  }
})

// Firebase Auth mocks
jest.mock('firebase/auth', () => {
  const mockSignInWithEmailAndPassword = jest.fn()
  const mockSignInWithPopup = jest.fn()
  const mockSendPasswordResetEmail = jest.fn()
  const mockSignInWithRedirect = jest.fn()
  
  class MockGoogleAuthProvider {
    constructor() {
      this.addScope = jest.fn()
      this.setCustomParameters = jest.fn()
    }
  }

  class MockFacebookAuthProvider {
    constructor() {
      this.addScope = jest.fn()
      this.setCustomParameters = jest.fn()
    }
  }

  return {
    signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
    signInWithPopup: mockSignInWithPopup,
    sendPasswordResetEmail: mockSendPasswordResetEmail,
    signInWithRedirect: mockSignInWithRedirect,
    GoogleAuthProvider: MockGoogleAuthProvider,
    FacebookAuthProvider: MockFacebookAuthProvider,
    getAuth: jest.fn(() => ({})),
  }
})

// Firebase Firestore mocks
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn().mockResolvedValue({ exists: () => true }),
  collection: jest.fn(() => 'collection'),
  addDoc: jest.fn().mockResolvedValue({}),
  getDocs: jest.fn().mockResolvedValue({ empty: true }),
  query: jest.fn(() => 'query'),
  limit: jest.fn(() => 'limit'),
  serverTimestamp: jest.fn(() => 'timestamp'),
}))

jest.mock('../firebase', () => ({
  auth: {},
  db: {},
  rtdb: {},
}))

// Import after all mocks are set up
import Login from '../login'
import * as firebaseAuth from 'firebase/auth'
import * as firestore from 'firebase/firestore'

Object.defineProperty(window, 'localStorage', {
  value: {
    store: {},
    getItem(key) {
      return this.store[key] || null
    },
    setItem(key, value) {
      this.store[key] = value
    },
    removeItem(key) {
      delete this.store[key]
    },
    clear() {
      this.store = {}
    },
  },
  configurable: true,
})

// tests
describe('Login component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    firestore.getDocs.mockResolvedValue({ empty: true })
    firestore.addDoc.mockResolvedValue({})
    firestore.getDoc.mockResolvedValue({ exists: () => true })
  })

  test('logs in with email/password', async () => {
    firebaseAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: 'uid-123', email: 'user@test.com' },
    })

    render(<Login />)

    fireEvent.change(screen.getByPlaceholderText(/your@email/i), {
      target: { value: 'user@test.com' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByText(/Sign In to LakbAI/i))

    await waitFor(() =>
      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'user@test.com',
        'password123',
      ),
    )
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard'),
    )
  })

  test('logs in with Google popup', async () => {
    firebaseAuth.signInWithPopup.mockResolvedValueOnce({
      user: {
        uid: 'google-uid',
        email: 'google@test.com',
        getIdToken: () => Promise.resolve('token'),
      },
    })

    render(<Login />)

    const googleButton = screen.getByText(/Sign in with Google/i)
    fireEvent.click(googleButton)

    await waitFor(() => expect(firebaseAuth.signInWithPopup).toHaveBeenCalled(), {
      timeout: 3000
    })
    
    await waitFor(() =>
      expect(mockSetUser).toHaveBeenCalledWith({
        uid: 'google-uid',
        email: 'google@test.com',
      }),
    )
    
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', {
        replace: true,
      }),
    )
  })

  test('logs in with Facebook popup', async () => {
    firebaseAuth.signInWithPopup.mockResolvedValueOnce({
      user: { 
        uid: 'fb-uid', 
        email: 'fb@test.com',
        displayName: 'Test User' 
      },
    })

    render(<Login />)

    const facebookButton = screen.getByText(/Facebook/i)
    fireEvent.click(facebookButton)

    await waitFor(() => expect(firebaseAuth.signInWithPopup).toHaveBeenCalled(), {
      timeout: 3000
    })
    
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard'),
    )
  })

  test('handles Google login errors gracefully', async () => {
    firebaseAuth.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
      message: 'User closed popup'
    })

    render(<Login />)

    const googleButton = screen.getByText(/Sign in with Google/i)
    fireEvent.click(googleButton)

    await waitFor(() => {
      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled()
    })
    
    // Should not show error popup for user-cancelled actions
    expect(screen.queryByText(/Error/i)).not.toBeInTheDocument()
  })

  test('handles Facebook login errors gracefully', async () => {
    firebaseAuth.signInWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
      message: 'User closed popup'
    })

    render(<Login />)

    const facebookButton = screen.getByText(/Facebook/i)
    fireEvent.click(facebookButton)

    await waitFor(() => {
      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled()
    })
    
    // Should not show error popup for user-cancelled actions
    expect(screen.queryByText(/Error/i)).not.toBeInTheDocument()
  })
})
