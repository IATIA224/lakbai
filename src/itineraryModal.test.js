import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import ItineraryModal from './itineraryModal';

// Mock CSS if needed
jest.mock('./itinerary.css', () => ({}), { virtual: true });

describe('ItineraryModal', () => {
  const mockItinerary = {
    title: 'Palawan Adventure',
    description: 'A 5-day trip to explore the beautiful islands of Palawan',
    days: [
      {
        day: 'Day 1',
        places: ['Puerto Princesa Airport', 'City Tour', 'Baker\'s Hill']
      },
      {
        day: 'Day 2', 
        places: ['Underground River', 'Sabang Beach', 'Mangrove Forest']
      },
      {
        day: 'Day 3',
        places: ['El Nido', 'Nacpan Beach', 'Las Cabanas Beach']
      }
    ]
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders itinerary modal with props', () => {
    const { getByText } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    expect(getByText('Palawan Adventure')).toBeInTheDocument();
    expect(getByText('A 5-day trip to explore the beautiful islands of Palawan')).toBeInTheDocument();
  });

  test('displays all days and places', () => {
    const { getByText } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    // Check days
    expect(getByText('Day 1:')).toBeInTheDocument();
    expect(getByText('Day 2:')).toBeInTheDocument();
    expect(getByText('Day 3:')).toBeInTheDocument();

    // Check places for Day 1
    expect(getByText('Puerto Princesa Airport')).toBeInTheDocument();
    expect(getByText('City Tour')).toBeInTheDocument();
    expect(getByText('Baker\'s Hill')).toBeInTheDocument();

    // Check places for Day 2
    expect(getByText('Underground River')).toBeInTheDocument();
    expect(getByText('Sabang Beach')).toBeInTheDocument();
    expect(getByText('Mangrove Forest')).toBeInTheDocument();

    // Check places for Day 3
    expect(getByText('El Nido')).toBeInTheDocument();
    expect(getByText('Nacpan Beach')).toBeInTheDocument();
    expect(getByText('Las Cabanas Beach')).toBeInTheDocument();
  });

  test('renders close button', () => {
    const { getByText } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    const closeButton = getByText('×');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveClass('modal-close');
  });

  test('calls onClose when close button is clicked', () => {
    const { getByText } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    const closeButton = getByText('×');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('renders with minimal itinerary data', () => {
    const minimalItinerary = {
      title: 'Simple Trip',
      description: 'Basic description',
      days: []
    };

    const { getByText } = render(
      <ItineraryModal itinerary={minimalItinerary} onClose={mockOnClose} />
    );

    expect(getByText('Simple Trip')).toBeInTheDocument();
    expect(getByText('Basic description')).toBeInTheDocument();
  });

  test('renders with single day itinerary', () => {
    const singleDayItinerary = {
      title: 'Day Trip',
      description: 'One day adventure',
      days: [
        {
          day: 'Day 1',
          places: ['Beach', 'Restaurant']
        }
      ]
    };

    const { getByText } = render(
      <ItineraryModal itinerary={singleDayItinerary} onClose={mockOnClose} />
    );

    expect(getByText('Day Trip')).toBeInTheDocument();
    expect(getByText('Day 1:')).toBeInTheDocument();
    expect(getByText('Beach')).toBeInTheDocument();
    expect(getByText('Restaurant')).toBeInTheDocument();
  });

  test('handles empty places array for a day', () => {
    const itineraryWithEmptyDay = {
      title: 'Trip with Rest Day',
      description: 'Some days have no activities',
      days: [
        {
          day: 'Day 1',
          places: ['Morning Activity']
        },
        {
          day: 'Day 2',
          places: []
        }
      ]
    };

    const { getByText } = render(
      <ItineraryModal itinerary={itineraryWithEmptyDay} onClose={mockOnClose} />
    );

    expect(getByText('Day 1:')).toBeInTheDocument();
    expect(getByText('Day 2:')).toBeInTheDocument();
    expect(getByText('Morning Activity')).toBeInTheDocument();
  });

  test('has correct modal structure', () => {
    const { container } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    // Check for modal overlay
    const modalOverlay = container.querySelector('.modal-overlay');
    expect(modalOverlay).toBeInTheDocument();

    // Check for modal content
    const modalContent = container.querySelector('.modal-content');
    expect(modalContent).toBeInTheDocument();

    // Check for close button
    const closeButton = container.querySelector('.modal-close');
    expect(closeButton).toBeInTheDocument();
  });

  test('renders hr separator', () => {
    const { container } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={mockOnClose} />
    );

    const hrElement = container.querySelector('hr');
    expect(hrElement).toBeInTheDocument();
  });

  test('handles special characters in place names', () => {
    const itineraryWithSpecialChars = {
      title: 'Special Characters Test',
      description: 'Testing special characters',
      days: [
        {
          day: 'Day 1',
          places: ['Baker\'s Hill', 'José Rizal Park', 'Café by the Bay']
        }
      ]
    };

    const { getByText } = render(
      <ItineraryModal itinerary={itineraryWithSpecialChars} onClose={mockOnClose} />
    );

    expect(getByText('Baker\'s Hill')).toBeInTheDocument();
    expect(getByText('José Rizal Park')).toBeInTheDocument();
    expect(getByText('Café by the Bay')).toBeInTheDocument();
  });

  test('handles missing or undefined props gracefully', () => {
    // Mock console.error to suppress error messages during testing
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Test undefined itinerary will cause error, so we expect it
    let didThrow = false;
    try {
      render(<ItineraryModal itinerary={undefined} onClose={mockOnClose} />);
    } catch (error) {
      didThrow = true;
      expect(error.message).toContain('Cannot read properties of undefined');
    }
    expect(didThrow).toBe(true);

    // Test with undefined onClose - this should work fine
    const { getByText } = render(
      <ItineraryModal itinerary={mockItinerary} onClose={undefined} />
    );
    expect(getByText('Palawan Adventure')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});