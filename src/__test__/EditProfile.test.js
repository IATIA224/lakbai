import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EditProfile from '../EditProfile';
import { auth, db } from '../firebase';
import { doc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';

// Mock Firebase
jest.mock('../firebase', () => ({
  auth: {
    currentUser: { uid: 'test-uid' },
    onAuthStateChanged: jest.fn()
  },
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  arrayRemove: jest.fn()
}));

// Mock fetch for Cloudinary
global.fetch = jest.fn();
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.alert = jest.fn();

describe('EditProfile Component', () => {
  const mockOnClose = jest.fn();
  const mockOnProfileUpdate = jest.fn();
  
  const defaultProps = {
    onClose: mockOnClose,
    onProfileUpdate: mockOnProfileUpdate,
    initialData: {
      name: 'Test User',
      bio: 'Test bio',
      interests: [],
      profilePicture: '/user.png'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = { uid: 'test-uid' };
    auth.onAuthStateChanged.mockImplementation((callback) => {
      callback({ uid: 'test-uid' });
      return jest.fn();
    });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ interests: [] })
    });
    updateDoc.mockResolvedValue();
    arrayRemove.mockImplementation((val) => `REMOVE_${val}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    test('renders edit profile modal', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByText('Edit Travel Profile')).toBeInTheDocument();
      expect(screen.getByText('Customize your adventure identity')).toBeInTheDocument();
    });

    test('displays initial name and bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
    });

    test('renders all 19 travel interests', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByText('Surfer')).toBeInTheDocument();
      expect(screen.getByText('Backpacker')).toBeInTheDocument();
      expect(screen.getByText('Foodie Traveler')).toBeInTheDocument();
      expect(screen.getByText('Culture Seeker')).toBeInTheDocument();
      expect(screen.getByText('Adventure Junkie')).toBeInTheDocument();
      expect(screen.getByText('Nature Enthusiast')).toBeInTheDocument();
      expect(screen.getByText('Digital Nomad')).toBeInTheDocument();
      expect(screen.getByText('Road Tripper')).toBeInTheDocument();
      expect(screen.getByText('Beach Lover')).toBeInTheDocument();
      expect(screen.getByText('City Explorer')).toBeInTheDocument();
      expect(screen.getByText('Photographer')).toBeInTheDocument();
      expect(screen.getByText('Historian')).toBeInTheDocument();
      expect(screen.getByText('Festival Hopper')).toBeInTheDocument();
      expect(screen.getByText('Hiker')).toBeInTheDocument();
      expect(screen.getByText('Luxury Traveler')).toBeInTheDocument();
      expect(screen.getByText('Eco-Traveler')).toBeInTheDocument();
      expect(screen.getByText('Cruise Lover')).toBeInTheDocument();
      expect(screen.getByText('Winter Sports Enthusiast')).toBeInTheDocument();
      expect(screen.getByText('Solo Wanderer')).toBeInTheDocument();
    });

    test('displays default avatar with first letter when no photo', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    test('displays profile picture from initialData', async () => {
      const props = {
        ...defaultProps,
        initialData: {
          ...defaultProps.initialData,
          profilePicture: 'https://example.com/profile.jpg'
        }
      };
      await act(async () => {
        render(<EditProfile {...props} />);
      });
      const img = screen.getByAltText('Profile');
      expect(img).toHaveAttribute('src', 'https://example.com/profile.jpg');
    });

    test('renders cancel and save buttons', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save Profile')).toBeInTheDocument();
    });

    test('displays character count for bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      expect(screen.getByText('8/300 characters')).toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    test('updates name input', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const nameInput = screen.getByPlaceholderText('John Doe');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      expect(nameInput.value).toBe('New Name');
    });

    test('updates bio textarea', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      fireEvent.change(bioTextarea, { target: { value: 'New bio content' } });
      expect(bioTextarea.value).toBe('New bio content');
    });

    test('enforces max length on bio (300 characters)', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      const longBio = 'a'.repeat(350);
      fireEvent.change(bioTextarea, { target: { value: longBio } });
      expect(bioTextarea.value.length).toBe(300);
    });

    test('enforces max length on traveler name (40 characters)', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const nameInput = screen.getByPlaceholderText('John Doe');
      // The input has maxlength="40" HTML attribute, so it will only accept 40 chars
      expect(nameInput).toHaveAttribute('maxlength', '40');
    });

    test('handles empty name gracefully', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const nameInput = screen.getByPlaceholderText('John Doe');
      fireEvent.change(nameInput, { target: { value: '' } });
      expect(nameInput.value).toBe('');
    });

    test('updates bio character count dynamically', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      fireEvent.change(bioTextarea, { target: { value: 'Hello World' } });
      expect(screen.getByText('11/300 characters')).toBeInTheDocument();
    });
  });

  describe('Photo Upload', () => {
    test('handles photo selection', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByTestId('photo-input');
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    test('handles empty file input', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const input = screen.getByTestId('photo-input');
      
      fireEvent.change(input, { target: { files: [] } });
      
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    test('handles null file input', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      const input = screen.getByTestId('photo-input');
      
      fireEvent.change(input, { target: { files: null } });
      
      expect(screen.getByText('T')).toBeInTheDocument();
    });

    test('displays existing profile picture before new upload', async () => {
      const props = {
        ...defaultProps,
        initialData: {
          ...defaultProps.initialData,
          profilePicture: 'https://example.com/existing.jpg'
        }
      };
      
      await act(async () => {
        render(<EditProfile {...props} />);
      });
      
      const img = screen.getByAltText('Profile');
      expect(img).toHaveAttribute('src', 'https://example.com/existing.jpg');
    });

    test('ignores default /user.png avatar', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      // Should show letter avatar, not img tag
      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.queryByAltText('Profile')).not.toBeInTheDocument();
    });

    test('handles multiple file selections', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const input = screen.getByTestId('photo-input');
      
      // First selection
      const file1 = new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file1] } });
      });
      
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file1);
      
      // Second selection (overwrites first)
      const file2 = new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' });
      await act(async () => {
        fireEvent.change(input, { target: { files: [file2] } });
      });
      
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file2);
    });

    test('accepts various image formats', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const input = screen.getByTestId('photo-input');
      expect(input).toHaveAttribute('accept', 'image/*');
    });
  });

  describe('Additional Rendering Tests', () => {
    test('renders modal backdrop', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const backdrop = screen.getByText('Edit Travel Profile').closest('.edit-profile-backdrop');
      expect(backdrop).toBeInTheDocument();
    });

    test('displays upload instructions', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      expect(screen.getByText('Click to change photo')).toBeInTheDocument();
    });

    test('displays interest selection instructions', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      expect(screen.getByText('Travel Interests')).toBeInTheDocument();
      expect(screen.getByText('Click each interest to like (green) or dislike (red)')).toBeInTheDocument();
    });

    test('renders interests in grid layout', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const interestsList = screen.getByText('Surfer').closest('.edit-profile-interests-list');
      expect(interestsList).toHaveStyle('display: grid');
      expect(interestsList).toHaveStyle('grid-template-columns: 1fr 1fr');
    });

    test('displays all interest icons', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      expect(screen.getByText('🏄‍♂️')).toBeInTheDocument();
      expect(screen.getByText('🎒')).toBeInTheDocument();
      expect(screen.getByText('🍜')).toBeInTheDocument();
      expect(screen.getByText('🥾')).toBeInTheDocument();
    });
  });

  describe('Additional Input Validation Tests', () => {
    test('allows exactly 300 characters in bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      const exactBio = 'a'.repeat(300);
      
      fireEvent.change(bioTextarea, { target: { value: exactBio } });
      
      expect(bioTextarea.value.length).toBe(300);
      expect(screen.getByText('300/300 characters')).toBeInTheDocument();
    });

    test('allows exactly 40 characters in name', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const nameInput = screen.getByPlaceholderText('John Doe');
      const exactName = 'a'.repeat(40);
      
      fireEvent.change(nameInput, { target: { value: exactName } });
      
      expect(nameInput.value.length).toBe(40);
    });

    test('handles empty bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      
      fireEvent.change(bioTextarea, { target: { value: '' } });
      
      expect(bioTextarea.value).toBe('');
      expect(screen.getByText('0/300 characters')).toBeInTheDocument();
    });

    test('preserves line breaks in bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      const multilineBio = 'Line 1\nLine 2\nLine 3';
      
      fireEvent.change(bioTextarea, { target: { value: multilineBio } });
      
      expect(bioTextarea.value).toBe(multilineBio);
    });

    test('handles unicode characters in name', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const nameInput = screen.getByPlaceholderText('John Doe');
      const unicodeName = 'José García 日本';
      
      fireEvent.change(nameInput, { target: { value: unicodeName } });
      
      expect(nameInput.value).toBe(unicodeName);
    });
  });

  describe('Additional Interest Tests', () => {
    test('displays tooltip for active interests', async () => {
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ interests: ['Surfer'] })
      });

      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });

      await waitFor(() => {
        const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
        expect(surferButton).toHaveAttribute('title', 'Click to remove from your interests');
      });
    });

    test('displays tooltip for inactive interests', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });

      const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
      expect(surferButton).toHaveAttribute('title', 'Click to like (green) or dislike (red)');
    });

    test('applies correct colors to different interests', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });

      const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
      const backpackerButton = screen.getByRole('button', { name: /🎒 Backpacker/i });
      
      expect(surferButton).toHaveStyle('background: rgb(224, 247, 250)');
      expect(backpackerButton).toHaveStyle('background: rgb(243, 232, 255)');
    });

    test('maintains interest state across multiple clicks', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
      
      // Click 5 times
      await act(async () => {
        fireEvent.click(surferButton);
        fireEvent.click(surferButton);
        fireEvent.click(surferButton);
        fireEvent.click(surferButton);
        fireEvent.click(surferButton);
      });
      
      // Should be disliked (5 clicks: null->like->dislike->null->like->dislike)
      expect(surferButton).toHaveStyle('background: #fee2e2');
    });

    test('allows selecting multiple interests', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
      const backpackerButton = screen.getByRole('button', { name: /🎒 Backpacker/i });
      const foodieButton = screen.getByRole('button', { name: /🍜 Foodie Traveler/i });
      
      await act(async () => {
        fireEvent.click(surferButton);
        fireEvent.click(backpackerButton);
        fireEvent.click(foodieButton);
      });
      
      expect(surferButton).toHaveStyle('background: #d1fae5');
      expect(backpackerButton).toHaveStyle('background: #d1fae5');
      expect(foodieButton).toHaveStyle('background: #d1fae5');
    });
  });

  describe('Additional Save Tests', () => {
    test('does not upload photo if not changed', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const nameInput = screen.getByPlaceholderText('John Doe');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Profile'));
      });

      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    test('saves empty bio', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const bioTextarea = screen.getByDisplayValue('Test bio');
      fireEvent.change(bioTextarea, { target: { value: '' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Profile'));
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          undefined,
          expect.objectContaining({
            bio: ''
          })
        );
      });
    });

    test('re-enables save button after save completes', async () => {
      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const nameInput = screen.getByPlaceholderText('John Doe');
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Profile'));
      });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Profile');
        expect(saveButton).not.toBeDisabled();
      });
    });

    test('saves all changes at once', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ secure_url: 'https://cloudinary.com/new.jpg' })
      });

      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      // Change everything
      const nameInput = screen.getByPlaceholderText('John Doe');
      const bioTextarea = screen.getByPlaceholderText(/Share something about your travel style/i);
      const surferButton = screen.getByRole('button', { name: /🏄‍♂️ Surfer/i });
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      const photoInput = screen.getByTestId('photo-input');
      
      fireEvent.change(nameInput, { target: { value: 'Complete Name' } });
      fireEvent.change(bioTextarea, { target: { value: 'Complete bio' } });
      fireEvent.change(photoInput, { target: { files: [file] } });
      
      await act(async () => {
        fireEvent.click(surferButton);
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Profile'));
      });

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          undefined,
          expect.objectContaining({
            travelerName: 'Complete Name',
            bio: 'Complete bio',
            profilePicture: 'https://cloudinary.com/new.jpg',
            interests: expect.arrayContaining(['Surfer'])
          })
        );
      });
    });
  });

  describe('Additional Edge Cases', () => {
    test('handles network timeout on photo upload', async () => {
      jest.setTimeout(10000);
      
      global.fetch.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await act(async () => {
        render(<EditProfile {...defaultProps} />);
      });
      
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      const input = screen.getByTestId('photo-input');
      
      fireEvent.change(input, { target: { files: [file] } });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Profile'));
      });

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to save profile'));
      }, { timeout: 5000 });
    });

    test('handles rapid modal open/close', async () => {
      const { unmount } = await act(async () => {
        return render(<EditProfile {...defaultProps} />);
      });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });
      
      unmount();
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});