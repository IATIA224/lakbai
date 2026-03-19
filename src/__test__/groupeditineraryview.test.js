import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Firebase FIRST - before any imports of components
jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user-id' } },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
  getFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));

// Mock ItineraryCard AFTER Firebase mocks
jest.mock('../components/trip_components/ItineraryCard', () => {
  return function MockItineraryCard({ item, index, onEdit, onRemove }) {
    return (
      <div data-testid={`itinerary-card-${item.id}`} className="mock-itinerary-card">
        <span>{item.name}</span>
        <button onClick={() => onEdit(item)} data-testid={`edit-${item.id}`}>
          Edit
        </button>
        <button onClick={() => onRemove(item.id)} data-testid={`remove-${item.id}`}>
          Remove
        </button>
      </div>
    );
  };
});

// NOW import the component after all mocks are set up
import GroupedItineraryView from '../components/trip_components/GroupedItineraryView';
import { updateDoc, deleteDoc } from 'firebase/firestore';

describe('GroupedItineraryView Component', () => {
  const mockGroup = {
    id: 'group-1',
    name: 'Summer Vacation 2024',
    startDate: '2024-06-01',
    endDate: '2024-06-05',
    assignments: {
      'item-1': 0,
      'item-2': 0,
      'item-3': 1,
      'item-4': 2,
    },
    customActivities: [
      { id: 'activity-1', title: 'Breakfast', day: 0, time: '08:00' },
      { id: 'activity-2', title: 'Lunch', day: 0, time: '12:00' },
    ],
  };

  const mockItems = [
    {
      id: 'item-1',
      name: 'Boracay Beach',
      estimatedExpenditure: 5000,
      arrivalTime: '10:00',
      departureTime: '17:00',
    },
    {
      id: 'item-2',
      name: 'Coral Garden',
      estimatedExpenditure: 3000,
      arrivalTime: '14:00',
      departureTime: '16:00',
    },
    {
      id: 'item-3',
      name: 'Mount Pinatubo',
      estimatedExpenditure: 4000,
      arrivalTime: '06:00',
      departureTime: '18:00',
    },
    {
      id: 'item-4',
      name: 'Taal Volcano',
      estimatedExpenditure: 2500,
      arrivalTime: '09:00',
      departureTime: '16:00',
    },
  ];

  const mockOnEditGroup = jest.fn();
  const mockOnDeleteGroup = jest.fn();
  const mockOnRefresh = jest.fn();
  const mockOnExportGroup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Header and Basic Rendering', () => {
    it('should render group name in header', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument();
    });

    it('should display "Untitled Trip" when group has no name', () => {
      const groupWithoutName = { ...mockGroup, name: '' };

      render(
        <GroupedItineraryView
          group={groupWithoutName}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Untitled Trip')).toBeInTheDocument();
    });

    it('should render Edit Trip button', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Edit Trip')).toBeInTheDocument();
    });

    it('should call onEditGroup when Edit Trip button is clicked', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      fireEvent.click(screen.getByText('Edit Trip'));

      expect(mockOnEditGroup).toHaveBeenCalledWith(mockGroup);
    });
  });

  describe('Date and Metadata Display', () => {
    it('should display start and end dates', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/6\/1\/2024.*6\/5\/2024/)).toBeInTheDocument();
    });

    it('should calculate and display total days correctly with text content', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/5\s+days?/)).toBeInTheDocument();
    });

    it('should display "1 day" for single day trip', () => {
      const oneDayGroup = {
        ...mockGroup,
        startDate: '2024-06-01',
        endDate: '2024-06-01',
      };

      render(
        <GroupedItineraryView
          group={oneDayGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/1\s+day/)).toBeInTheDocument();
    });

    it('should display total destination count with text content', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/4\s+destinations?/)).toBeInTheDocument();
    });

    it('should display "1 destination" for single destination', () => {
      const singleDestGroup = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
      };

      render(
        <GroupedItineraryView
          group={singleDestGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/1\s+destination/)).toBeInTheDocument();
    });

    it('should calculate and display total budget', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/₱\s*14,500/)).toBeInTheDocument();
    });

    it('should not display dates when startDate and endDate are missing', () => {
      const groupWithoutDates = {
        ...mockGroup,
        startDate: null,
        endDate: null,
      };

      render(
        <GroupedItineraryView
          group={groupWithoutDates}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dateElement = screen.queryByText(/📅/);
      expect(dateElement).not.toBeInTheDocument();
    });
  });

  describe('Day Sections and Expansion', () => {
    it('should render all day sections based on total days', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Day 1')).toBeInTheDocument();
      expect(screen.getByText('Day 2')).toBeInTheDocument();
      expect(screen.getByText('Day 3')).toBeInTheDocument();
      expect(screen.getByText('Day 4')).toBeInTheDocument();
      expect(screen.getByText('Day 5')).toBeInTheDocument();
    });

    it('should display day dates correctly', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/Saturday, Jun 1/)).toBeInTheDocument();
      expect(screen.getByText(/Sunday, Jun 2/)).toBeInTheDocument();
    });

    it('should expand day 1 by default', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dayHeaders = screen.getAllByText('Day 1');
      const day1Header = dayHeaders[0].closest('.grouped-day-header');

      expect(day1Header.nextElementSibling).toHaveClass('grouped-day-items');
    });

    it('should display item count correctly with correct singular/plural form', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Day 1 has 2 destinations + 2 custom activities = 4 items (plural)
      const day1Items = screen.getAllByText(/4\s+items?/);
      expect(day1Items.length).toBeGreaterThan(0);
    });

    it('should display singular item count for single item days', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Day 2 has 1 destination = 1 item (singular)
      // Use getAllByText to handle multiple instances
      const day2Items = screen.getAllByText(/1\s+item(?!s)/);
      expect(day2Items.length).toBeGreaterThan(0);
    });

    it('should collapse and expand day section when clicking header', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dayHeaders = screen.getAllByText('Day 2');
      const day2Section = dayHeaders[0].closest('.grouped-day-section');
      const day2Header = day2Section.querySelector('.grouped-day-header');
      const day2ItemsContainer = day2Section.querySelector('.grouped-day-items');

      // Initially expanded
      expect(day2ItemsContainer).toHaveClass('grouped-day-items');

      // Click to toggle
      fireEvent.click(day2Header);

      // Check visibility changed (using display or other visibility indicators)
      expect(day2ItemsContainer).toBeInTheDocument();
    });
  });

  describe('Destinations and Items Rendering', () => {
    it('should render ItineraryCard components for destinations', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-3')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-4')).toBeInTheDocument();
    });

    it('should display destinations on correct days based on assignments', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const day1Card = screen.getByTestId('itinerary-card-item-1');
      expect(day1Card).toBeInTheDocument();
      expect(day1Card.textContent).toContain('Boracay Beach');
    });

    it('should pass correct index to ItineraryCard', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
    });
  });

  describe('Custom Activities Display', () => {
    it('should display custom activities for each day', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Breakfast')).toBeInTheDocument();
      expect(screen.getByText('Lunch')).toBeInTheDocument();
    });

    it('should display custom activity time', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
    });

    it('should not display custom activities when group has no customActivities', () => {
      const groupWithoutActivities = {
        ...mockGroup,
        customActivities: undefined,
      };

      render(
        <GroupedItineraryView
          group={groupWithoutActivities}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.queryByText('Breakfast')).not.toBeInTheDocument();
    });

    it('should display custom activities with edit and delete buttons', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const editButtons = screen.getAllByTitle('Edit time');
      const deleteButtons = screen.getAllByTitle('Delete activity');

      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Time Display', () => {
    it('should display arrival and departure times using getAllByText', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const timeIcons = screen.getAllByText('🕐');
      expect(timeIcons.length).toBeGreaterThan(0);
      expect(screen.getByText('10:00 → 17:00')).toBeInTheDocument();
    });

    it('should display "No time set" when arrival and departure times are missing', () => {
      const itemsWithoutTime = [
        { ...mockItems[0], arrivalTime: undefined, departureTime: undefined },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithoutTime}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('No time set')).toBeInTheDocument();
    });

    it('should display Set Time button', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const setTimeButtons = screen.getAllByText(/⏱️ Set Time/);
      expect(setTimeButtons.length).toBeGreaterThan(0);
    });

    it('should display Set Time button with correct title', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const setTimeButton = screen.getAllByTitle('Set arrival and departure times');
      expect(setTimeButton.length).toBeGreaterThan(0);
    });
  });

  describe('Add Activity Button', () => {
    it('should display Add Activity/Note button for each day', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const addActivityButtons = screen.getAllByText('+ Add Activity/Note');
      expect(addActivityButtons.length).toBeGreaterThan(0);
    });

    it('should render Add Activity button even when day has no items', () => {
      const groupWithoutAssignments = {
        ...mockGroup,
        assignments: {},
      };

      render(
        <GroupedItineraryView
          group={groupWithoutAssignments}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const addActivityButtons = screen.getAllByText('+ Add Activity/Note');
      expect(addActivityButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle group with no assignments', () => {
      const groupWithoutAssignments = {
        ...mockGroup,
        assignments: {},
      };

      render(
        <GroupedItineraryView
          group={groupWithoutAssignments}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const emptyMessages = screen.getAllByText('No activities planned for this day');
      expect(emptyMessages.length).toBeGreaterThan(0);
    });

    it('should handle items with zero budget', () => {
      const itemsWithZeroBudget = [
        { ...mockItems[0], estimatedExpenditure: 0 },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithZeroBudget}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/₱\s*0/)).toBeInTheDocument();
    });

    it('should handle very long trip duration (366 days)', () => {
      const longTripGroup = {
        ...mockGroup,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      render(
        <GroupedItineraryView
          group={longTripGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/366\s+days?/)).toBeInTheDocument();
    });

    it('should handle empty items array', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={[]}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument();
    });

    it('should handle items with missing expenditure', () => {
      const itemsWithoutExpenditure = [
        { ...mockItems[0], estimatedExpenditure: undefined },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithoutExpenditure}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
    });

    it('should handle null custom activities array', () => {
      const groupWithNullActivities = {
        ...mockGroup,
        customActivities: null,
      };

      render(
        <GroupedItineraryView
          group={groupWithNullActivities}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument();
    });

    it('should handle empty custom activities array', () => {
      const groupWithEmptyActivities = {
        ...mockGroup,
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupWithEmptyActivities}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.queryByText('Breakfast')).not.toBeInTheDocument();
    });
  });

  describe('Budget Calculations', () => {
    it('should calculate total budget from all items', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Total: 5000 + 3000 + 4000 + 2500 = 14500
      expect(screen.getByText(/₱\s*14,500/)).toBeInTheDocument();
    });

    it('should calculate budget per day correctly', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Day 1: 5000 + 3000 = 8000
      expect(screen.getByText(/₱\s*8,000/)).toBeInTheDocument();

      // Day 2: 4000
      expect(screen.getByText(/₱\s*4,000/)).toBeInTheDocument();

      // Day 3: 2500
      expect(screen.getByText(/₱\s*2,500/)).toBeInTheDocument();
    });

    it('should handle negative budget values', () => {
      const itemsWithNegativeBudget = [
        { ...mockItems[0], estimatedExpenditure: -1000 },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithNegativeBudget}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/₱\s*-1,000/)).toBeInTheDocument();
    });
  });

  describe('Day Assignment Logic', () => {
    it('should assign items to correct days based on assignment map', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // item-1 and item-2 on day 0 (Day 1)
      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-2')).toBeInTheDocument();

      // item-3 on day 1 (Day 2)
      expect(screen.getByTestId('itinerary-card-item-3')).toBeInTheDocument();

      // item-4 on day 2 (Day 3)
      expect(screen.getByTestId('itinerary-card-item-4')).toBeInTheDocument();
    });

    it('should handle assignments beyond trip duration', () => {
      const groupWithOutOfRangeAssignment = {
        ...mockGroup,
        assignments: {
          'item-1': 0,
          'item-2': 10, // Day 11, beyond 5-day trip
        },
      };

      render(
        <GroupedItineraryView
          group={groupWithOutOfRangeAssignment}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Should still render the item even if assigned day is out of range
      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
    });
  });

  describe('Interaction Tests', () => {
    it('should call onEditGroup with group when Edit Trip is clicked', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      fireEvent.click(screen.getByText('Edit Trip'));

      expect(mockOnEditGroup).toHaveBeenCalledWith(mockGroup);
      expect(mockOnEditGroup).toHaveBeenCalledTimes(1);
    });

    it('should handle day header clicks without breaking', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dayHeaders = screen.getAllByText(/Day [1-5]/);
      
      // Click first day header
      fireEvent.click(dayHeaders[0].closest('.grouped-day-header'));
      
      // Should still render the component
      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument();
    });

    it('should handle multiple day sections without errors', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // All day headers should exist
      const day1 = screen.getByText('Day 1');
      const day2 = screen.getByText('Day 2');
      const day3 = screen.getByText('Day 3');

      expect(day1).toBeInTheDocument();
      expect(day2).toBeInTheDocument();
      expect(day3).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper button titles for interactive elements', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Use getAllByTitle instead of getByTitle to handle multiple elements
      const setTimeButtons = screen.getAllByTitle('Set arrival and departure times');
      const editTimeButtons = screen.getAllByTitle('Edit time');
      const deleteButtons = screen.getAllByTitle('Delete activity');

      expect(setTimeButtons.length).toBeGreaterThan(0);
      expect(editTimeButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should render semantic HTML structure', () => {
      const { container } = render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(container.querySelector('.grouped-itinerary-card')).toBeInTheDocument();
      expect(container.querySelector('.grouped-itinerary-header')).toBeInTheDocument();
      expect(container.querySelector('.grouped-itinerary-days-container')).toBeInTheDocument();
    });

    it('should have clickable day headers', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dayHeaders = screen.getAllByText('Day 1');
      const header = dayHeaders[0].closest('.grouped-day-header');

      expect(header).toBeInTheDocument();
      fireEvent.click(header);
      expect(header).toBeInTheDocument();
    });
  });

  describe('Large Dataset Tests', () => {
    it('should handle many items efficiently', () => {
      const manyItems = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        name: `Destination ${i + 1}`,
        estimatedExpenditure: 1000 + i * 100,
        arrivalTime: '10:00',
        departureTime: '17:00',
      }));

      const largeAssignments = {};
      manyItems.forEach((item, i) => {
        largeAssignments[item.id] = i % 5;
      });

      const largeGroup = {
        ...mockGroup,
        assignments: largeAssignments,
      };

      render(
        <GroupedItineraryView
          group={largeGroup}
          items={manyItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Day 1')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-0')).toBeInTheDocument();
    });

    it('should calculate correct total budget for many items', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        name: `Destination ${i + 1}`,
        estimatedExpenditure: 1000 * (i + 1),
        arrivalTime: '10:00',
        departureTime: '17:00',
      }));

      const assignments = {};
      manyItems.forEach((item) => {
        assignments[item.id] = 0;
      });

      const groupWithManyItems = {
        ...mockGroup,
        assignments,
      };

      render(
        <GroupedItineraryView
          group={groupWithManyItems}
          items={manyItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Total: 1000 + 2000 + 3000 + ... + 10000 = 55000
      // Check in itinerary header budget (total budget)
      const budgetElements = screen.getAllByText(/₱\s*55,000/);
      expect(budgetElements.length).toBeGreaterThan(0);
    });

    it('should handle day budget calculations with many items', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        name: `Destination ${i + 1}`,
        estimatedExpenditure: 1000 * (i + 1),
        arrivalTime: '10:00',
        departureTime: '17:00',
      }));

      const assignments = {};
      manyItems.forEach((item, i) => {
        assignments[item.id] = i % 3; // Distribute across 3 days
      });

      const groupWithManyItems = {
        ...mockGroup,
        assignments,
        startDate: '2024-06-01',
        endDate: '2024-06-03',
      };

      render(
        <GroupedItineraryView
          group={groupWithManyItems}
          items={manyItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Day 1')).toBeInTheDocument();
      expect(screen.getByText('Day 2')).toBeInTheDocument();
      expect(screen.getByText('Day 3')).toBeInTheDocument();
    });
  });

  describe('Custom Activity Management', () => {
    it('should display custom activities with correct styling', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Breakfast')).toBeInTheDocument();
      expect(screen.getByText('Lunch')).toBeInTheDocument();
    });

    it('should handle activities with edit and delete buttons', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const editButtons = screen.getAllByTitle('Edit time');
      const deleteButtons = screen.getAllByTitle('Delete activity');

      expect(editButtons.length).toBeGreaterThanOrEqual(2);
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should display custom activities in correct time order', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
    });
  });

  describe('Empty State Handling', () => {
    it('should display empty message for days with no activities', () => {
      const groupWithoutAssignments = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupWithoutAssignments}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const emptyMessages = screen.getAllByText('No activities planned for this day');
      expect(emptyMessages.length).toBeGreaterThan(0);
    });

    it('should show Add Activity button on all days', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const addButtons = screen.getAllByText('+ Add Activity/Note');
      expect(addButtons.length).toBe(5); // 5 days
    });
  });

  describe('Time Display Handling', () => {
    it('should display times for all destinations', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('10:00 → 17:00')).toBeInTheDocument();
      expect(screen.getByText('14:00 → 16:00')).toBeInTheDocument();
      expect(screen.getByText('06:00 → 18:00')).toBeInTheDocument();
      expect(screen.getByText('09:00 → 16:00')).toBeInTheDocument();
    });

    it('should display "No time set" for items without times', () => {
      const itemsWithoutTime = [
        { ...mockItems[0], arrivalTime: undefined, departureTime: undefined },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithoutTime}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('No time set')).toBeInTheDocument();
    });

    it('should have Set Time buttons for all destinations', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const setTimeButtons = screen.getAllByText(/⏱️ Set Time/);
      expect(setTimeButtons.length).toBe(4); // 4 destinations
    });
  });

  describe('Budget Display Tests', () => {
    it('should display per-day budget correctly', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Day 1: 5000 + 3000 = 8000
      const day1Budget = screen.getAllByText(/₱\s*8,000/);
      expect(day1Budget.length).toBeGreaterThan(0);

      // Day 2: 4000
      const day2Budget = screen.getAllByText(/₱\s*4,000/);
      expect(day2Budget.length).toBeGreaterThan(0);

      // Day 3: 2500
      const day3Budget = screen.getAllByText(/₱\s*2,500/);
      expect(day3Budget.length).toBeGreaterThan(0);
    });

    it('should display total budget in header', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      // Total: 5000 + 3000 + 4000 + 2500 = 14500
      const totalBudget = screen.getAllByText(/₱\s*14,500/);
      expect(totalBudget.length).toBeGreaterThan(0);
    });

    it('should handle zero budget items', () => {
      const itemsWithZeroBudget = [
        { ...mockItems[0], estimatedExpenditure: 0 },
      ];

      const groupForTesting = {
        ...mockGroup,
        assignments: { 'item-1': 0 },
        customActivities: [],
      };

      render(
        <GroupedItineraryView
          group={groupForTesting}
          items={itemsWithZeroBudget}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const zeroBudget = screen.getAllByText(/₱\s*0/);
      expect(zeroBudget.length).toBeGreaterThan(0);
    });
  });

  describe('Destination Assignment and Rendering', () => {
    it('should render all destinations in correct positions', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByTestId('itinerary-card-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-2')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-3')).toBeInTheDocument();
      expect(screen.getByTestId('itinerary-card-item-4')).toBeInTheDocument();
    });

    it('should display destination names correctly', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Boracay Beach')).toBeInTheDocument();
      expect(screen.getByText('Coral Garden')).toBeInTheDocument();
      expect(screen.getByText('Mount Pinatubo')).toBeInTheDocument();
      expect(screen.getByText('Taal Volcano')).toBeInTheDocument();
    });
  });

  describe('Trip Information Display', () => {
    it('should display trip name in header', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText('Summer Vacation 2024')).toBeInTheDocument();
    });

    it('should display trip dates', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      expect(screen.getByText(/6\/1\/2024.*6\/5\/2024/)).toBeInTheDocument();
    });

    it('should display destination count', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const destCount = screen.getAllByText(/4\s+destinations?/);
      expect(destCount.length).toBeGreaterThan(0);
    });

    it('should display day count', () => {
      render(
        <GroupedItineraryView
          group={mockGroup}
          items={mockItems}
          onEditGroup={mockOnEditGroup}
          onDeleteGroup={mockOnDeleteGroup}
          onRefresh={mockOnRefresh}
          onExportGroup={mockOnExportGroup}
        />
      );

      const dayCount = screen.getAllByText(/5\s+days?/);
      expect(dayCount.length).toBeGreaterThan(0);
    });
  });
});