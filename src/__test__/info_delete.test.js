import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InfoDelete from '../info_delete';

// Mock Firebase
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInWithPopup = jest.fn();
const mockDeleteUser = jest.fn();
const mockSignOut = jest.fn();
const mockReauthenticateWithCredential = jest.fn();
const mockReauthenticateWithPopup = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();

jest.mock('../firebase', () => ({
  auth: {},
  db: {}
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  deleteUser: (...args) => mockDeleteUser(...args),
  signOut: (...args) => mockSignOut(...args),
  reauthenticateWithCredential: (...args) => mockReauthenticateWithCredential(...args),
  reauthenticateWithPopup: (...args) => mockReauthenticateWithPopup(...args),
  GoogleAuthProvider: jest.fn(() => ({})),
  FacebookAuthProvider: jest.fn(() => ({})),
  EmailAuthProvider: {
    credential: jest.fn(() => ({}))
  }
}));

jest.mock('firebase/firestore', () => ({
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args)
}));

// Mock console.log to avoid test noise
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('InfoDelete Component', () => {
  const mockOnClose = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful responses by default
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockDeleteDoc.mockResolvedValue();
    mockSignOut.mockResolvedValue();
    mockDeleteUser.mockResolvedValue();
    mockReauthenticateWithCredential.mockResolvedValue();
    mockReauthenticateWithPopup.mockResolvedValue();
  });

  test('renders account deletion modal', () => {
    render(<InfoDelete onClose={mockOnClose} />);
    
    expect(screen.getByText(/Account Management/i)).toBeInTheDocument();
    expect(screen.getByText(/To delete your account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
  });

  test('closes modal when close button is clicked', () => {
    render(<InfoDelete onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('can enter email and password in text boxes', () => {
    render(<InfoDelete onClose={mockOnClose} />);
    
    const emailInput = screen.getByLabelText(/Email/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  test('can toggle remember me checkbox', () => {
    render(<InfoDelete onClose={mockOnClose} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  test('shows loading state when submitting email/password form', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'test-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    
    const submitButton = screen.getByText(/Delete Account/i);
    fireEvent.click(submitButton);
    
    expect(screen.getByText(/Processing.../i)).toBeInTheDocument();
  });

  test('shows confirmation modal after successful email login', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'test-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
      expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
    });
  });

  test('google login button triggers google sign in', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { uid: 'google-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    const googleButton = screen.getByText(/Google/i);
    fireEvent.click(googleButton);
    
    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });
  });

  test('facebook login button triggers facebook sign in', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { uid: 'facebook-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    const facebookButton = screen.getByText(/Facebook/i);
    fireEvent.click(facebookButton);
    
    await waitFor(() => {
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });
  });

  test('shows confirmation modal after successful google login', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { uid: 'google-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.click(screen.getByText(/Google/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
    });
  });

  test('can cancel deletion from confirmation modal', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: { uid: 'test-uid' }
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText(/Cancel/i);
    fireEvent.click(cancelButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Account Deletion/i)).not.toBeInTheDocument();
    });
  });

  test('confirms account deletion and deletes all user data', async () => {
    const mockUser = { uid: 'test-uid' };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    
    // Mock firestore operations
    mockGetDocs.mockResolvedValue({ 
      docs: [
        { ref: 'doc1', id: 'doc1' },
        { ref: 'doc2', id: 'doc2' }
      ] 
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    // Login first
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    // Wait for confirmation modal
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
    });
    
    // Confirm deletion
    const confirmButton = screen.getByText(/Yes, Delete My Account/i);
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      // Should call reauthentication
      expect(mockReauthenticateWithCredential).toHaveBeenCalled();
      // Should delete user data
      expect(mockDeleteDoc).toHaveBeenCalled();
      // Should delete user account
      expect(mockDeleteUser).toHaveBeenCalledWith(mockUser);
      // Should sign out
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  test('shows success popup after successful deletion', async () => {
    const mockUser = { uid: 'test-uid' };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    // Go through the deletion process
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText(/Yes, Delete My Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
      expect(screen.getByText(/deleted successfully/i)).toBeInTheDocument();
    });
  });

  test('shows error popup when login fails', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue(new Error('Invalid credentials'));
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });

  test('shows permission error message for permission denied errors', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ 
      code: 'permission-denied',
      message: 'Permission denied'
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Missing or insufficient permissions/i)).toBeInTheDocument();
    });
  });

  test('closes popup and calls onClose after successful deletion', async () => {
    const mockUser = { uid: 'test-uid' };
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    
    // Mock window.location.reload
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    // Complete deletion process
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText(/Yes, Delete My Account/i));
    
    await waitFor(() => {
      expect(screen.getByText(/Success!/i)).toBeInTheDocument();
    });
    
    // Close success popup
    fireEvent.click(screen.getByText(/Close/i));
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
  });

  test('disables buttons during loading state', async () => {
    // Mock a slow operation
    mockSignInWithEmailAndPassword.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(<InfoDelete onClose={mockOnClose} />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Delete Account/i));
    
    // Check that buttons are disabled during loading
    expect(screen.getByText(/Facebook/i)).toBeDisabled();
    expect(screen.getByText(/Google/i)).toBeDisabled();
  });

  test('displays warning message about irreversible action', () => {
    render(<InfoDelete onClose={mockOnClose} />);
    
    expect(screen.getByText(/This action is irreversible/i)).toBeInTheDocument();
    expect(screen.getByText(/trips, bookmarks, and profile data will be deleted/i)).toBeInTheDocument();
  });
});