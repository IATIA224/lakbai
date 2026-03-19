import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock ReactDOM.createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node) => node,
}));

// Mock rules - FIX: Correct path from __test__ folder
jest.mock('../rules', () => ({
  breakdown: {
    'P5000': ['Transport: ₱1,500', 'Food: ₱2,000', 'Activities: ₱1,500'],
    'P10000': ['Transport: ₱3,000', 'Food: ₱4,000', 'Accommodation: ₱3,000'],
  },
  category: {
    beach: ['Sunscreen', 'Swimsuit', 'Towel', 'Sunglasses'],
    hiking: ['Hiking boots', 'Backpack', 'Water bottle', 'First aid kit'],
    adventure: ['Camera', 'Comfortable shoes', 'Hat'],
  },
}));

// Mock Firebase - FIX: Correct path from __test__ folder
jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-id', email: 'test@test.com', displayName: 'Test User' } },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
}));

// Mock ItinerarySuggestion - FIX: Correct path from __test__ folder
jest.mock('../ItinerarySuggestion', () => ({
  HotelSuggestion: ({ onSelect }) => (
    <div data-testid="hotel-suggestion">
      <button onClick={() => onSelect({ name: 'Test Hotel', type: 'Hotel', address: '123 Test St' })}>
        Select Hotel
      </button>
    </div>
  ),
  AgencySuggestion: ({ onSelect }) => (
    <div data-testid="agency-suggestion">
      <button onClick={() => onSelect({ name: 'Test Agency', type: 'Tour', location: 'Manila' })}>
        Select Agency
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

// Import after mocks
import ItineraryCard from '../components/trip_components/ItineraryCard';

describe('ItineraryCard Component', () => {
  const mockItem = {
    id: 'test-item-1',
    name: 'Boracay Beach Trip',
    location: 'Boracay, Aklan',
    description: 'A beautiful beach destination',
    region: 'Visayas',
    status: 'upcoming',
    rating: '4.5',
    estimatedExpenditure: 5000,
    activities: ['Swimming', 'Snorkeling', 'Island Hopping'],
    dateFrom: '2024-06-01',
    dateUntil: '2024-06-05',
    accomType: 'Resort',
    accomName: 'Beach Resort',
    accomNotes: 'Address: 123 Beach Road',
    agency: 'Travel Tours',
    agencyDetails: 'Phone: 123-456',
    notes: 'Bring extra cash',
    bestTime: 'March to May',
    arrival: '10:00 AM',
    departure: '5:00 PM',
    categories: ['beach'],
    packingSelected: ['Sunscreen', 'Swimsuit'],
    breakdown: ['Transport: ₱1,500', 'Food: ₱2,000', 'Activities: ₱1,500'],
  };

  const mockOnEdit = jest.fn();
  const mockOnRemove = jest.fn();
  const mockOnShowPriceBadge = jest.fn();
  const mockOnHidePriceBadge = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.classList.remove('itn-modal-open');
  });

  describe('Rendering', () => {
    it('should render null when item is not provided', () => {
      const { container } = render(
        <ItineraryCard
          item={null}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render the itinerary row with item name', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByText('Boracay Beach Trip')).toBeInTheDocument();
    });

    it('should render the correct step number based on index', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={2}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render View details button', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByText('View details')).toBeInTheDocument();
    });

    it('should render status button when onEdit is provided', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByText('upcoming')).toBeInTheDocument();
    });

    it('should render delete button when onRemove is provided', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      expect(screen.getByTitle('Remove')).toBeInTheDocument();
    });

    it('should not render delete button when onRemove is not provided', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
    });
  });

  describe('Modal Open/Close', () => {
    it('should open modal when View details is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
          onShowPriceBadge={mockOnShowPriceBadge}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(document.body.classList.contains('itn-modal-open')).toBe(true);
    });

    it('should call onShowPriceBadge when modal opens', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
          onShowPriceBadge={mockOnShowPriceBadge}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(mockOnShowPriceBadge).toHaveBeenCalledWith(5000);
    });

    it('should close modal when close button is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
          onHidePriceBadge={mockOnHidePriceBadge}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByLabelText('Close'));
      
      expect(mockOnHidePriceBadge).toHaveBeenCalledWith(5000);
    });

    it('should close modal when ESC key is pressed', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.keyDown(window, { key: 'Escape' });
      
      expect(document.body.classList.contains('itn-modal-open')).toBe(false);
    });

    it('should display item details in modal', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('A beautiful beach destination')).toBeInTheDocument();
      expect(screen.getByText('Boracay, Aklan')).toBeInTheDocument();
    });
  });

  describe('Status Toggle', () => {
    it('should toggle status from upcoming to ongoing', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('upcoming');
      await act(async () => {
        fireEvent.click(statusButton);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ongoing' })
      );
    });

    it('should toggle status from ongoing to completed', async () => {
      const itemOngoing = { ...mockItem, status: 'ongoing' };
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={itemOngoing}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('ongoing');
      await act(async () => {
        fireEvent.click(statusButton);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });

    it('should toggle status from completed to upcoming', async () => {
      const itemCompleted = { ...mockItem, status: 'completed' };
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={itemCompleted}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('completed');
      await act(async () => {
        fireEvent.click(statusButton);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'upcoming' })
      );
    });
  });

  describe('Delete Confirmation', () => {
    it('should show delete confirmation modal when delete button is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByTitle('Remove'));
      
      expect(screen.getByText('Remove item')).toBeInTheDocument();
      // Fixed: Use more specific selector instead of regex that matches multiple elements
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should call onRemove when delete is confirmed', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByTitle('Remove'));
      fireEvent.click(screen.getByText('Delete'));
      
      expect(mockOnRemove).toHaveBeenCalledWith('test-item-1');
    });

    it('should close delete modal when cancel is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByTitle('Remove'));
      fireEvent.click(screen.getByText('Cancel'));
      
      expect(screen.queryByText('Remove item')).not.toBeInTheDocument();
    });

    it('should close delete modal when ESC is pressed', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByTitle('Remove'));
      fireEvent.keyDown(window, { key: 'Escape' });
      
      expect(screen.queryByText('Remove item')).not.toBeInTheDocument();
    });
  });

  describe('Activities Display', () => {
    it('should display activities in modal', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      // Fixed: Use getAllByText to handle multiple elements and check length
      const swimmingElements = screen.getAllByText('Swimming');
      expect(swimmingElements.length).toBeGreaterThan(0);
      
      const snorkelingElements = screen.getAllByText('Snorkeling');
      expect(snorkelingElements.length).toBeGreaterThan(0);
      
      const islandHoppingElements = screen.getAllByText('Island Hopping');
      expect(islandHoppingElements.length).toBeGreaterThan(0);
    });

    it('should show toggle button when activities exceed 6', () => {
      const itemManyActivities = {
        ...mockItem,
        activities: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
      };

      render(
        <ItineraryCard
          item={itemManyActivities}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Show all (8)')).toBeInTheDocument();
    });

    it('should toggle show all activities', () => {
      const itemManyActivities = {
        ...mockItem,
        activities: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],
      };

      render(
        <ItineraryCard
          item={itemManyActivities}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByText('Show all (8)'));
      
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('should handle comma-separated activities string', () => {
      const itemStringActivities = {
        ...mockItem,
        activities: 'Swimming, Snorkeling, Diving',
      };

      render(
        <ItineraryCard
          item={itemStringActivities}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      // Fixed: Use getAllByText to handle multiple elements
      const swimmingElements = screen.getAllByText('Swimming');
      expect(swimmingElements.length).toBeGreaterThan(0);
      
      const snorkelingElements = screen.getAllByText('Snorkeling');
      expect(snorkelingElements.length).toBeGreaterThan(0);
      
      const divingElements = screen.getAllByText('Diving');
      expect(divingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accommodation Editing', () => {
    it('should display accommodation details', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Resort')).toBeInTheDocument();
      expect(screen.getByText('Beach Resort')).toBeInTheDocument();
    });

    it('should open accommodation edit modal when edit button is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Accommodation'));
      
      expect(screen.getByText('🏨 Edit Accommodation')).toBeInTheDocument();
    });

    it('should save accommodation when save button is clicked', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Accommodation'));
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should select hotel from suggestions', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Accommodation'));
      fireEvent.click(screen.getByText('Select Hotel'));
      
      // The hotel selection should update the form values
      expect(screen.getByTestId('hotel-suggestion')).toBeInTheDocument();
    });
  });

  describe('Agency Editing', () => {
    it('should display agency details', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Travel Tours')).toBeInTheDocument();
    });

    it('should open agency edit modal when edit button is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Agency'));
      
      expect(screen.getByText('🏢 Edit Agency')).toBeInTheDocument();
    });

    it('should save agency when save button is clicked', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Agency'));
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });
  });

  describe('Activities Editing', () => {
    it('should open activities edit modal', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Activities'));
      
      expect(screen.getByText('🎯 Edit Activities')).toBeInTheDocument();
    });

    it('should save activities when save button is clicked', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Activities'));
      
      const textarea = screen.getByPlaceholderText('e.g., Hiking, Swimming, Sightseeing');
      fireEvent.change(textarea, { target: { value: 'New Activity 1, New Activity 2' } });
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          activities: ['New Activity 1', 'New Activity 2'],
        })
      );
    });
  });

  describe('Notes Editing', () => {
    it('should display notes', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Bring extra cash')).toBeInTheDocument();
    });

    it('should open notes edit modal', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Notes'));
      
      expect(screen.getByText('📝 Edit Notes')).toBeInTheDocument();
    });

    it('should save notes when save button is clicked', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Notes'));
      
      const textarea = screen.getByPlaceholderText('Add your notes here...');
      fireEvent.change(textarea, { target: { value: 'Updated notes' } });
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'Updated notes' })
      );
    });
  });

  describe('Packing Functionality', () => {
    it('should display packing suggestions', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Sunscreen')).toBeInTheDocument();
      expect(screen.getByText('Swimsuit')).toBeInTheDocument();
    });

    it('should toggle packing item selection', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      await act(async () => {
        fireEvent.click(screen.getByText('Towel'));
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should show add custom packing item input', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByText('Add item'));
      
      expect(screen.getByPlaceholderText('Enter item...')).toBeInTheDocument();
    });

    it('should add custom packing item', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByText('Add item'));
      
      const input = screen.getByPlaceholderText('Enter item...');
      fireEvent.change(input, { target: { value: 'Custom Item' } });
      
      await act(async () => {
        fireEvent.click(screen.getByText('Add'));
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should add custom packing item on Enter key', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByText('Add item'));
      
      const input = screen.getByPlaceholderText('Enter item...');
      fireEvent.change(input, { target: { value: 'Custom Item' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 13, charCode: 13 });
      
      await waitFor(() => {
        expect(mockOnEdit).toHaveBeenCalled();
      });
    });
  });

  describe('Breakdown Display and Editing', () => {
    it('should display breakdown items', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Food')).toBeInTheDocument();
    });

    it('should open breakdown edit modal', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Breakdown'));
      
      expect(screen.getByText('💰 Edit Breakdown')).toBeInTheDocument();
    });

    it('should add breakdown line', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Breakdown'));
      fireEvent.click(screen.getByText('+ Add line'));
      
      // Should have additional input field
      const labelInputs = screen.getAllByPlaceholderText('Label');
      expect(labelInputs.length).toBeGreaterThan(3);
    });

    it('should save breakdown', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Breakdown'));
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[saveButtons.length - 1]);
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should cancel breakdown edit', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Breakdown'));
      
      const cancelButtons = screen.getAllByText('Cancel');
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);
      
      expect(screen.queryByText('💰 Edit Breakdown')).not.toBeInTheDocument();
    });
  });

  describe('Date Handling', () => {
    it('should display date summary', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      // Date format varies by locale but should show dates
      expect(screen.getByText(/Jun/)).toBeInTheDocument();
    });

    it('should save dates on blur', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      const dateInputs = screen.getAllByDisplayValue('2024-06-01');
      fireEvent.change(dateInputs[0], { target: { value: '2024-07-01' } });
      
      await act(async () => {
        fireEvent.blur(dateInputs[0]);
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });
  });

  describe('Mobile Menu', () => {
    it('should show mobile menu when burger button is clicked', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const burgerButton = screen.getByText('⋮');
      fireEvent.click(burgerButton);
      
      expect(screen.getByText(/Change Status/)).toBeInTheDocument();
    });

    it('should close mobile menu when clicking outside', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const burgerButton = screen.getByText('⋮');
      fireEvent.click(burgerButton);
      fireEvent.mouseDown(document.body);
      
      // Menu should close
      expect(screen.queryByText(/Change Status/)).not.toBeInTheDocument();
    });

    it('should toggle status from mobile menu', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const burgerButton = screen.getByText('⋮');
      fireEvent.click(burgerButton);
      
      await act(async () => {
        fireEvent.click(screen.getByText(/Change Status/));
      });
      
      expect(mockOnEdit).toHaveBeenCalled();
    });

    it('should open details from mobile menu', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const burgerButton = screen.getByText('⋮');
      fireEvent.click(burgerButton);
      fireEvent.click(screen.getByText('View Details'));
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should open delete confirmation from mobile menu', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const burgerButton = screen.getByText('⋮');
      fireEvent.click(burgerButton);
      fireEvent.click(screen.getByText('Remove'));
      
      expect(screen.getByText('Remove item')).toBeInTheDocument();
    });
  });

  describe('Status Badge Styling', () => {
    it('should apply correct style for upcoming status', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('upcoming');
      expect(statusButton).toHaveStyle({ background: '#dbeafe' });
    });

    it('should apply correct style for ongoing status', () => {
      const itemOngoing = { ...mockItem, status: 'ongoing' };
      render(
        <ItineraryCard
          item={itemOngoing}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('ongoing');
      expect(statusButton).toHaveStyle({ background: '#fef3c7' });
    });

    it('should apply correct style for completed status', () => {
      const itemCompleted = { ...mockItem, status: 'completed' };
      render(
        <ItineraryCard
          item={itemCompleted}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('completed');
      expect(statusButton).toHaveStyle({ background: '#d1fae5' });
    });
  });

  describe('Estimated Expenditure Display', () => {
    it('should display estimated expenditure', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('₱5,000')).toBeInTheDocument();
      expect(screen.getByText('Estimated Expenditure')).toBeInTheDocument();
    });
  });

  describe('Best Time Display', () => {
    it('should display best time to visit', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('Best Time to Visit')).toBeInTheDocument();
      expect(screen.getByText('March to May')).toBeInTheDocument();
    });
  });

  describe('Arrival/Departure Display', () => {
    it('should display arrival and departure times', () => {
      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('5:00 PM')).toBeInTheDocument();
    });
  });

  describe('Shared Itinerary Support', () => {
    it('should use shared path when isShared is true', async () => {
      const { doc, updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
          isShared={true}
          sharedId="shared-123"
        />
      );
      
      await act(async () => {
        fireEvent.click(screen.getByText('upcoming'));
      });
      
      expect(doc).toHaveBeenCalledWith(
        expect.anything(),
        'sharedItineraries',
        'shared-123',
        'items',
        'test-item-1'
      );
    });
  });

  describe('Error Handling', () => {
    it('should display error when save fails', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockRejectedValue(new Error('Save failed'));

      render(
        <ItineraryCard
          item={mockItem}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      fireEvent.click(screen.getByTitle('Edit Notes'));
      
      const saveButtons = screen.getAllByText('Save');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Error: Save failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should display "Not set" for empty accommodation', () => {
      const itemNoAccom = { ...mockItem, accomType: '', accomName: '' };
      render(
        <ItineraryCard
          item={itemNoAccom}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      const notSetElements = screen.getAllByText('Not set');
      expect(notSetElements.length).toBeGreaterThan(0);
    });

    it('should display "Not set" for empty agency', () => {
      const itemNoAgency = { ...mockItem, agency: '' };
      render(
        <ItineraryCard
          item={itemNoAgency}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      const notSetElements = screen.getAllByText('Not set');
      expect(notSetElements.length).toBeGreaterThan(0);
    });

    it('should display "Not set" for empty notes', () => {
      const itemNoNotes = { ...mockItem, notes: '' };
      render(
        <ItineraryCard
          item={itemNoNotes}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      fireEvent.click(screen.getByText('View details'));
      
      const notSetElements = screen.getAllByText('Not set');
      expect(notSetElements.length).toBeGreaterThan(0);
    });
  });

  describe('Track Destination Completion', () => {
    it('should call onEdit when status changes', async () => {
      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue();

      const itemOngoing = { ...mockItem, status: 'ongoing' };

      render(
        <ItineraryCard
          item={itemOngoing}
          index={0}
          onEdit={mockOnEdit}
          onRemove={mockOnRemove}
        />
      );
      
      const statusButton = screen.getByText('ongoing');
      await act(async () => {
        fireEvent.click(statusButton);
      });
      
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });
});

describe('ItineraryCard with Minimal Item', () => {
  const minimalItem = {
    id: 'minimal-1',
    name: 'Minimal Trip',
  };

  it('should render with minimal item properties', () => {
    render(
      <ItineraryCard
        item={minimalItem}
        index={0}
        onEdit={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    
    expect(screen.getByText('Minimal Trip')).toBeInTheDocument();
  });

  it('should open modal with minimal item', () => {
    render(
      <ItineraryCard
        item={minimalItem}
        index={0}
        onEdit={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('View details'));
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('ItineraryCard formatItemForDisplay', () => {
  const testItem = {
    id: 'test-1',
    name: 'Test Trip',
  };

  it('should handle string input', () => {
    render(
      <ItineraryCard
        item={testItem}
        index={0}
        onEdit={jest.fn()}
        onRemove={jest.fn()}
      />
    );
    
    expect(screen.getByText('Test Trip')).toBeInTheDocument();
  });
});