import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ItineraryModal from '../itineraryModal';

describe('ItineraryModal', () => {
  test('renders itinerary data', () => {
    const itinerary = {
      title: '3-Day Adventure',
      description: 'Fun times',
      days: [
        { day: 'Day 1', places: ['Beach', 'Cafe'] },
        { day: 'Day 2', places: ['Mountain'] },
      ]
    };
    const onClose = jest.fn();
    render(<ItineraryModal itinerary={itinerary} onClose={onClose} />);
    expect(screen.getByText(/3-Day Adventure/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalled();
  });
});