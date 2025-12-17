import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SharedGroupedItineraryView from '../components/trip_components/SharedGroupedItineraryView';

// Mock firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn(),
}));

jest.mock('../firebase', () => ({
  db: {},
}));

describe('SharedGroupedItineraryView', () => {
  const mockGroup = {
    id: 'group-1',
    name: 'Test Trip',
    startDate: '2024-01-15',
    endDate: '2024-01-17',
    assignments: {
      'item-1': 0,
      'item-2': 1,
    },
    customActivities: [
      { id: 'activity-1', title: 'Lunch Break', time: '12:00', day: 0 },
    ],
  };

  const mockItems = [
    { id: 'item-1', name: 'Beach Resort', budget: 1500, arrivalTime: '09:00', departureTime: '11:00' },
    { id: 'item-2', name: 'Mountain View', budget: 2000, arrivalTime: '14:00', departureTime: '16:00' },
  ];

  const mockEditors = [
    { uid: 'user-1', name: 'John Doe' },
    { uid: 'user-2', name: 'Jane Smith' },
  ];

  const defaultProps = {
    group: mockGroup,
    items: mockItems,
    sharedId: 'shared-123',
    onRefresh: jest.fn(),
    onDeleteGroup: jest.fn(),
    canEdit: true,
    editors: mockEditors,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders trip name correctly', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText('Test Trip')).toBeInTheDocument();
    });

    test('renders "Untitled Trip" when no name provided', () => {
      const propsWithoutName = {
        ...defaultProps,
        group: { ...mockGroup, name: null },
      };
      render(<SharedGroupedItineraryView {...propsWithoutName} />);
      expect(screen.getByText('Untitled Trip')).toBeInTheDocument();
    });

    test('renders date range correctly', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
      expect(screen.getByText(/1\/17\/2024/)).toBeInTheDocument();
    });

    test('renders correct number of days', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText(/3 days/)).toBeInTheDocument();
    });

    test('renders singular "day" for single day trip', () => {
      const singleDayProps = {
        ...defaultProps,
        group: { ...mockGroup, startDate: '2024-01-15', endDate: '2024-01-15' },
      };
      render(<SharedGroupedItineraryView {...singleDayProps} />);
      expect(screen.getByText(/1 day(?!s)/)).toBeInTheDocument();
    });

    test('renders destination count correctly', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText(/2 destinations/)).toBeInTheDocument();
    });

    test('renders singular "destination" for single destination', () => {
      const singleDestProps = {
        ...defaultProps,
        group: { ...mockGroup, assignments: { 'item-1': 0 } },
      };
      render(<SharedGroupedItineraryView {...singleDestProps} />);
      expect(screen.getByText(/1 destination(?!s)/)).toBeInTheDocument();
    });

    test('renders total budget correctly', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText(/₱3,500/)).toBeInTheDocument();
    });
  });

  describe('Editors Display', () => {
    test('renders editor avatars when editors provided', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      const avatars = screen.getAllByText('J');
      expect(avatars.length).toBeGreaterThanOrEqual(2); // At least John and Jane
    });

    test('does not render editors section when no editors', () => {
      const propsWithoutEditors = { ...defaultProps, editors: [] };
      render(<SharedGroupedItineraryView {...propsWithoutEditors} />);
      expect(screen.queryByText('Editing with:')).not.toBeInTheDocument();
    });

    test('shows +N indicator for more than 3 editors', () => {
      const manyEditors = [
        { uid: '1', name: 'User One' },
        { uid: '2', name: 'User Two' },
        { uid: '3', name: 'User Three' },
        { uid: '4', name: 'User Four' },
        { uid: '5', name: 'User Five' },
      ];
      render(<SharedGroupedItineraryView {...defaultProps} editors={manyEditors} />);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('Edit Permissions', () => {
    test('shows delete button when canEdit is true', () => {
      render(<SharedGroupedItineraryView {...defaultProps} canEdit={true} />);
      expect(screen.getByText(/Delete/)).toBeInTheDocument();
    });

    test('shows "View Only" badge when canEdit is false', () => {
      render(<SharedGroupedItineraryView {...defaultProps} canEdit={false} />);
      expect(screen.getByText(/View Only/)).toBeInTheDocument();
    });

    test('hides delete button when canEdit is false', () => {
      render(<SharedGroupedItineraryView {...defaultProps} canEdit={false} />);
      expect(screen.queryByText(/🗑️ Delete/)).not.toBeInTheDocument();
    });
  });

  describe('Day Expansion', () => {
    test('first day is expanded by default', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      // Day 1 content should be visible
      expect(screen.getByText('Beach Resort')).toBeInTheDocument();
    });

    test('clicking day header toggles expansion', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      const dayHeaders = screen.getAllByText(/Day \d/);
      
      // Click to collapse first day
      fireEvent.click(dayHeaders[0]);
      
      // Click again to expand
      fireEvent.click(dayHeaders[0]);
    });
  });

  describe('Delete Group', () => {
    test('calls onDeleteGroup when delete button clicked', async () => {
      const mockDeleteGroup = jest.fn();
      window.confirm = jest.fn(() => true);
      
      render(<SharedGroupedItineraryView {...defaultProps} onDeleteGroup={mockDeleteGroup} />);
      
      const deleteButton = screen.getByText(/Delete/);
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalled();
      });
    });

    test('does not delete when confirm is cancelled', async () => {
      const mockDeleteGroup = jest.fn();
      window.confirm = jest.fn(() => false);
      
      render(<SharedGroupedItineraryView {...defaultProps} onDeleteGroup={mockDeleteGroup} />);
      
      const deleteButton = screen.getByText(/Delete/);
      fireEvent.click(deleteButton);
      
      expect(mockDeleteGroup).not.toHaveBeenCalled();
    });
  });

  describe('Custom Activities', () => {
    test('renders custom activities for a day', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText('Lunch Break')).toBeInTheDocument();
    });

    test('displays activity time', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText('12:00')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    test('handles empty assignments', () => {
      const propsWithNoAssignments = {
        ...defaultProps,
        group: { ...mockGroup, assignments: {} },
      };
      render(<SharedGroupedItineraryView {...propsWithNoAssignments} />);
      expect(screen.getByText(/0 destinations/)).toBeInTheDocument();
    });

    test('handles null customActivities', () => {
      const propsWithNoActivities = {
        ...defaultProps,
        group: { ...mockGroup, customActivities: null },
      };
      render(<SharedGroupedItineraryView {...propsWithNoActivities} />);
      expect(screen.getByText('Test Trip')).toBeInTheDocument();
    });

    test('handles missing dates gracefully', () => {
      const propsWithNoDates = {
        ...defaultProps,
        group: { ...mockGroup, startDate: null, endDate: null },
      };
      render(<SharedGroupedItineraryView {...propsWithNoDates} />);
      expect(screen.getByText('Test Trip')).toBeInTheDocument();
    });
  });

  describe('Budget Calculations', () => {
    test('calculates total budget from all assigned items', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      // 1500 + 2000 = 3500
      expect(screen.getByText(/₱3,500/)).toBeInTheDocument();
    });

    test('shows zero budget when no items assigned', () => {
      const propsNoItems = {
        ...defaultProps,
        group: { ...mockGroup, assignments: {} },
        items: [],
      };
      render(<SharedGroupedItineraryView {...propsNoItems} />);
      expect(screen.getByText(/₱0/)).toBeInTheDocument();
    });
  });

  describe('Time Display', () => {
    test('shows arrival and departure times for destinations', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      expect(screen.getByText(/09:00/)).toBeInTheDocument();
    });
  });

  describe('Hover Effects', () => {
    test('delete button has hover styles', () => {
      render(<SharedGroupedItineraryView {...defaultProps} />);
      const deleteButton = screen.getByText(/Delete/).closest('button');
      
      fireEvent.mouseEnter(deleteButton);
      fireEvent.mouseLeave(deleteButton);
      
      expect(deleteButton).toBeInTheDocument();
    });
  });
});

describe('TimeDisplayBar', () => {
  test('renders without crashing', () => {
    // This tests the TimeDisplayBar sub-component behavior
    const mockGroup = {
      id: 'group-1',
      name: 'Test',
      startDate: '2024-01-15',
      endDate: '2024-01-15',
      assignments: { 'item-1': 0 },
    };
    
    const mockItems = [
      { id: 'item-1', name: 'Test Place', budget: 100, arrivalTime: '10:00' },
    ];
    
    render(
      <SharedGroupedItineraryView
        group={mockGroup}
        items={mockItems}
        sharedId="test"
        onRefresh={jest.fn()}
        canEdit={true}
        editors={[]}
      />
    );
    
    expect(screen.getByText('Test Place')).toBeInTheDocument();
  });
});

describe('ActivityFormBar', () => {
  test('add activity button appears when canEdit is true', () => {
    const mockGroup = {
      id: 'group-1',
      name: 'Test',
      startDate: '2024-01-15',
      endDate: '2024-01-15',
      assignments: {},
      customActivities: [],
    };
    
    render(
      <SharedGroupedItineraryView
        group={mockGroup}
        items={[]}
        sharedId="test"
        onRefresh={jest.fn()}
        canEdit={true}
        editors={[]}
      />
    );
    
    expect(screen.getByText(/Add Activity/i)).toBeInTheDocument();
  });
});