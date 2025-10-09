import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ItineraryHotelsModal from '../itineraryHotels';

// Mock fetch
global.fetch = jest.fn();

describe('ItineraryHotels Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  test('does not render when open is false', () => {
    const { container } = render(
      <ItineraryHotelsModal open={false} onClose={mockOnClose} onSelect={mockOnSelect} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders modal when open is true', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity\nNCR,Hotel,ACC001,Test Hotel,Manila,,,"123 Test St",123-4567,http://test.com,2025-12-31'
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    expect(screen.getByText(/DOT-Accredited Hotels & Accommodations/i)).toBeInTheDocument();
  });

  test('fetches and displays CSV data for NCR region', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Manila Hotel,Manila,,,Roxas Boulevard,02-1234567,http://manilahotel.com,2025-12-31
NCR,Resort,ACC002,Bay Resort,Pasay,,,Bay Area,02-7654321,http://bayresort.com,2025-06-30`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Manila Hotel')).toBeInTheDocument();
    });

    expect(screen.getByText('Bay Resort')).toBeInTheDocument();
  });

  test('region dropdown changes region and refetches data', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity\nNCR,Hotel,ACC001,NCR Hotel,Manila,,,Address,123,http://test.com,2025'
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity\nCAR,Hotel,ACC002,CAR Hotel,,Benguet,,Address,456,http://car.com,2025'
      });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('NCR Hotel')).toBeInTheDocument();
    });

    const regionSelect = screen.getByDisplayValue('NCR');
    fireEvent.change(regionSelect, { target: { value: 'CAR' } });

    await waitFor(() => {
      expect(screen.getByText('CAR Hotel')).toBeInTheDocument();
    });
  });

  test('city filter works for NCR region', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Manila Hotel,Manila,,,Address 1,123,,2025
NCR,Hotel,ACC002,Makati Hotel,Makati,,,Address 2,456,,2025
NCR,Apartment Hotel,ACC003,Pasay Hotel,Pasay,,,Address 3,789,,2025`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Manila Hotel')).toBeInTheDocument();
    });

    const citySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(citySelect, { target: { value: 'Manila City' } });

    await waitFor(() => {
      expect(screen.getByText('Manila Hotel')).toBeInTheDocument();
      expect(screen.queryByText('Makati Hotel')).not.toBeInTheDocument();
    });
  });

  test('province filter works for non-NCR regions', async () => {
    const mockNcrCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC000,Temp Hotel,Manila,,,Address,000,,2025`;

    const mockRegion1CSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
Region 1,Hotel,ACC001,Ilocos Hotel,,Ilocos Norte,,Address 1,111,,2025
Region 1,Resort,ACC002,Pangasinan Resort,,Pangasinan,,Address 2,222,,2025`;

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        text: async () => mockNcrCSV
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => mockRegion1CSV
      });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Temp Hotel')).toBeInTheDocument();
    });

    const regionSelect = screen.getByDisplayValue('NCR');
    fireEvent.change(regionSelect, { target: { value: 'Region 1' } });

    await waitFor(() => {
      expect(screen.getByText('Ilocos Hotel')).toBeInTheDocument();
    }, { timeout: 3000 });

    const provinceSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(provinceSelect, { target: { value: 'Ilocos Norte' } });

    await waitFor(() => {
      expect(screen.getByText('Ilocos Hotel')).toBeInTheDocument();
      expect(screen.queryByText('Pangasinan Resort')).not.toBeInTheDocument();
    });
  });

  test('search filter works correctly', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Grand Hotel,Manila,,,Makati Avenue,123,,2025
NCR,Hotel,ACC002,Luxury Resort,Pasay,,,Roxas Boulevard,456,,2025`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name or address/i);
    fireEvent.change(searchInput, { target: { value: 'Grand' } });

    await waitFor(() => {
      expect(screen.getByText('Grand Hotel')).toBeInTheDocument();
      expect(screen.queryByText('Luxury Resort')).not.toBeInTheDocument();
    });
  });

  test('displays loading state while fetching', async () => {
    global.fetch.mockImplementationOnce(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    expect(screen.getByText(/Loading accommodations/i)).toBeInTheDocument();
  });

  test('displays error when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      // Find element with hotels-error class
      const errorElements = document.querySelectorAll('.hotels-error');
      expect(errorElements.length).toBeGreaterThan(0);
      // Check that error message is displayed (any error message is fine)
      expect(errorElements[0]).toBeInTheDocument();
      expect(errorElements[0].textContent.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('displays no hotels message when filtered list is empty', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Test Hotel,Manila,,,Address,123,,2025`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by name or address/i);
    fireEvent.change(searchInput, { target: { value: 'NonExistentHotel' } });

    expect(screen.getByText(/No hotels found/i)).toBeInTheDocument();
  });

  test('onSelect callback is called when Add button is clicked', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Test Hotel,Manila,,,Test Address,123-4567,http://test.com,2025-12-31`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
    });

    const addButton = screen.getByText(/Add in itinerary/i);
    fireEvent.click(addButton);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Hotel',
      city: 'Manila',
      address: 'Test Address'
    }));
  });

  test('close button calls onClose callback', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity\n'
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('backdrop click calls onClose callback', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity\n'
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    // Wait for modal to render
    await waitFor(() => {
      expect(screen.getByText(/DOT-Accredited Hotels/i)).toBeInTheDocument();
    });

    // Use screen.getByRole or data-testid instead of querySelector
    const backdrop = screen.getByText(/DOT-Accredited Hotels/i).closest('.hotels-modal').parentElement;
    
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  test('filters out non-accommodation types', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Test Hotel,Manila,,,Address 1,123,,2025
NCR,Restaurant,ACC002,Test Restaurant,Manila,,,Address 2,456,,2025
NCR,Resort,ACC003,Test Resort,Manila,,,Address 3,789,,2025`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Resort')).toBeInTheDocument();
    expect(screen.queryByText('Test Restaurant')).not.toBeInTheDocument();
  });

  test('removes duplicate hotels with same name and address', async () => {
    const mockCSV = `Region,Enterprise Type,Accreditation No,Enterprise Name,City,Province,Municipality,Business Address,Contact Numbers,Business Website,Accreditation Validity
NCR,Hotel,ACC001,Duplicate Hotel,Manila,,,123 Main St,111,,2025
NCR,Hotel,ACC002,Duplicate Hotel,Manila,,,123 Main St,222,,2025
NCR,Hotel,ACC003,Unique Hotel,Manila,,,456 Second St,333,,2025`;

    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockCSV
    });

    render(
      <ItineraryHotelsModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('Duplicate Hotel')).toBeInTheDocument();
    });

    const duplicateHotels = screen.getAllByText('Duplicate Hotel');
    expect(duplicateHotels).toHaveLength(1);
    expect(screen.getByText('Unique Hotel')).toBeInTheDocument();
  });
});