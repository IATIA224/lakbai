import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Leaflet before importing the component
const mockMap = {
  fitBounds: jest.fn(),
  setView: jest.fn(),
  remove: jest.fn(),
  removeLayer: jest.fn(),
  removeControl: jest.fn(),
};

const mockMarker = {
  addTo: jest.fn().mockReturnThis(),
  bindPopup: jest.fn().mockReturnThis(),
  openPopup: jest.fn().mockReturnThis(),
};

const mockRoutingControl = {
  addTo: jest.fn().mockReturnThis(),
  on: jest.fn((event, callback) => {
    if (event === 'routesfound') {
      setTimeout(() => {
        callback({
          routes: [{
            summary: {
              totalDistance: 10000,
              totalTime: 1200
            }
          }]
        });
      }, 100);
    }
    return mockRoutingControl;
  }),
};

const mockTileLayer = {
  addTo: jest.fn(),
};

// Set up global L object before any imports
global.L = {
  map: jest.fn(() => mockMap),
  tileLayer: jest.fn(() => mockTileLayer),
  icon: jest.fn(() => ({})),
  marker: jest.fn(() => mockMarker),
  latLng: jest.fn((lat, lng) => ({ lat, lng })),
  Routing: {
    control: jest.fn(() => mockRoutingControl),
    osrmv1: jest.fn(() => ({})),
  },
};

// Mock leaflet module
jest.mock('leaflet', () => global.L);

// Mock leaflet-routing-machine
jest.mock('leaflet-routing-machine', () => ({}));

// Mock papaparse
jest.mock('papaparse', () => ({
  parse: jest.fn((path, options) => {
    if (options.download) {
      setTimeout(() => {
        options.complete({ data: [] });
      }, 0);
    }
  }),
}));

// Mock fetch for Nominatim
const mockNominatimSearch = jest.fn();
global.fetch = jest.fn((url) => {
  if (url.includes('nominatim.openstreetmap.org')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockNominatimSearch()),
    });
  }
  return Promise.resolve({
    ok: true,
    text: () => Promise.resolve(''),
  });
});

// Now import the component
import ItineraryCostEstimationModal from '../itineraryCostEstimation';
import Papa from 'papaparse';

describe('ItineraryCostEstimation Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockNominatimSearch.mockReturnValue([]);
    Papa.parse.mockImplementation((path, options) => {
      if (options.download) {
        setTimeout(() => {
          options.complete({ data: [] });
        }, 0);
      }
    });
  });

  test('renders modal with title', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    expect(screen.getByText(/Transportation Cost Estimator/i)).toBeInTheDocument();
  });

  test('reads and parses CSV data', async () => {
    const mockData = [
      { 'Vehicle Type': 'Taxi', 'Sub-Type': 'Regular Taxi', 'Base Rate(First 5 or 4 kilometers)': '40', 'Rate per km (₱)': '13.5', 'Per Minute Travel time': '2' },
      { 'Vehicle Type': 'PUJ', 'Sub-Type': 'Traditional Jeepney', 'Base Rate(First 5 or 4 kilometers)': '13', 'Rate per km (₱)': '2.20', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    await waitFor(() => {
      const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
      expect(vehicleSelect).toBeInTheDocument();
    });
  });

  test('displays map container', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    // Just verify the modal structure is rendered
    expect(screen.getByText(/Transportation Cost Estimator/i)).toBeInTheDocument();
    expect(document.querySelector('.cost-modal')).toBeInTheDocument();
  });

  test('from input accepts text input', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const fromInput = screen.getByPlaceholderText(/Enter origin city/i);
    fireEvent.change(fromInput, { target: { value: 'Manila' } });

    expect(fromInput.value).toBe('Manila');
  });

  test('to input accepts text input', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const toInput = screen.getByPlaceholderText(/Enter destination city/i);
    fireEvent.change(toInput, { target: { value: 'Quezon City' } });

    expect(toInput.value).toBe('Quezon City');
  });

  test('vehicle type dropdown displays options', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    expect(vehicleSelect).toBeInTheDocument();
    expect(screen.getByText(/Bus \(Public Utility Bus\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Jeepney \(Public Utility Jeepney\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxi/i)).toBeInTheDocument();
  });

  test('selecting PUB shows bus type dropdown', async () => {
    const mockData = [
      { 'Vehicle Type': 'PUB City', 'Sub-Type': 'Aircon Bus', 'Base Rate(First 5 or 4 kilometers)': '15', 'Rate per km (₱)': '2.65', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'PUB' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Bus Type/i)).toBeInTheDocument();
    });
  });

  test('subtype options appear based on vehicle selection', async () => {
    const mockData = [
      { 'Vehicle Type': 'Taxi', 'Sub-Type': 'Regular Taxi', 'Base Rate(First 5 or 4 kilometers)': '40', 'Rate per km (₱)': '13.5', 'Per Minute Travel time': '2' },
      { 'Vehicle Type': 'Taxi', 'Sub-Type': 'Premium Taxi', 'Base Rate(First 5 or 4 kilometers)': '50', 'Rate per km (₱)': '15', 'Per Minute Travel time': '2.5' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    await waitFor(() => {
      const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
      fireEvent.change(vehicleSelect, { target: { value: 'Taxi' } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Taxi Type/i)).toBeInTheDocument();
    });
  });

  test('travel time input accepts numeric values', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const timeInput = screen.getByLabelText(/Travel Time \(minutes\)/i);
    fireEvent.change(timeInput, { target: { value: '30' } });

    expect(timeInput.value).toBe('30');
  });

  test('displays info message when no locations selected', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    expect(screen.getByText(/Enter origin and destination to calculate route distance/i)).toBeInTheDocument();
  });

  test('close button calls onClose callback', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('backdrop click calls onClose callback', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    
    const backdrop = screen.getByText(/Transportation Cost Estimator/i).closest('.cost-modal').parentElement;
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('displays vehicle description info box', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'Taxi' } });

    await waitFor(() => {
      expect(screen.getByText(/Metered taxi cabs/i)).toBeInTheDocument();
    });
  });

  test('shows different descriptions for different vehicle types', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    
    fireEvent.change(vehicleSelect, { target: { value: 'PUJ' } });
    await waitFor(() => {
      expect(screen.getByText(/Traditional and modern jeepneys/i)).toBeInTheDocument();
    });

    fireEvent.change(vehicleSelect, { target: { value: 'PUB' } });
    await waitFor(() => {
      expect(screen.getByText(/Air-conditioned or non-aircon buses/i)).toBeInTheDocument();
    });
  });

  test('selecting taxi shows taxi subtype dropdown', async () => {
    const mockData = [
      { 'Vehicle Type': 'Taxi', 'Sub-Type': 'Regular Taxi', 'Base Rate(First 5 or 4 kilometers)': '40', 'Rate per km (₱)': '13.5', 'Per Minute Travel time': '2' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    await waitFor(() => {
      const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
      fireEvent.change(vehicleSelect, { target: { value: 'Taxi' } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Taxi Type/i)).toBeInTheDocument();
    });
  });

  test('PUJ vehicle type is available', async () => {
    const mockData = [
      { 'Vehicle Type': 'PUJ', 'Sub-Type': 'Traditional Jeepney', 'Base Rate(First 5 or 4 kilometers)': '13', 'Rate per km (₱)': '2.20', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    await waitFor(() => {
      const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
      fireEvent.change(vehicleSelect, { target: { value: 'PUJ' } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Jeepney Type/i)).toBeInTheDocument();
    });
  });

  test('travel time can be modified', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const timeInput = screen.getByLabelText(/Travel Time \(minutes\)/i);
    
    expect(timeInput.value).toBe('20');
    
    fireEvent.change(timeInput, { target: { value: '45' } });
    
    expect(timeInput.value).toBe('45');
  });

  test('all vehicle types are available in dropdown', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(screen.getByText(/Bus \(Public Utility Bus\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Jeepney \(Public Utility Jeepney\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Taxi/i)).toBeInTheDocument();
    expect(screen.getByText(/Ride-hailing \(TNVS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/UV Express/i)).toBeInTheDocument();
  });

  test('TNVS vehicle type shows subtype dropdown', async () => {
    const mockData = [
      { 'Vehicle Type': 'TNVS', 'Sub-Type': 'Grab', 'Base Rate(First 5 or 4 kilometers)': '40', 'Rate per km (₱)': '10', 'Per Minute Travel time': '2' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'TNVS' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Service Type/i)).toBeInTheDocument();
    });
  });

  test('selecting PUB category shows bus class dropdown', async () => {
    const mockData = [
      { 'Vehicle Type': 'PUB City', 'Sub-Type': 'Aircon Bus', 'Base Rate(First 5 or 4 kilometers)': '15', 'Rate per km (₱)': '2.65', 'Per Minute Travel time': '0' },
      { 'Vehicle Type': 'PUB City', 'Sub-Type': 'Non-Aircon Bus', 'Base Rate(First 5 or 4 kilometers)': '13', 'Rate per km (₱)': '2.40', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'PUB' } });

    await waitFor(() => {
      const busTypeSelect = screen.getByLabelText(/Bus Type/i);
      fireEvent.change(busTypeSelect, { target: { value: 'PUB City' } });
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Bus Class/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Aircon Bus/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Non-Aircon Bus/i)[0]).toBeInTheDocument();
    });
  });

  test('validates minimum travel time input', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const timeInput = screen.getByLabelText(/Travel Time \(minutes\)/i);
    
    expect(timeInput).toHaveAttribute('min', '1');
    expect(timeInput).toHaveAttribute('type', 'number');
  });

  test('shows correct vehicle descriptions for all types', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    
    const vehicleTests = [
      { value: 'PUB', description: /Air-conditioned or non-aircon buses/i },
      { value: 'PUJ', description: /Traditional and modern jeepneys/i },
      { value: 'Taxi', description: /Metered taxi cabs/i },
      { value: 'TNVS', description: /Grab, Uber-style services/i },
      { value: 'UVE', description: /Air-conditioned vans/i }
    ];

    for (const vehicle of vehicleTests) {
      fireEvent.change(vehicleSelect, { target: { value: vehicle.value } });
      await waitFor(() => {
        expect(screen.getByText(vehicle.description)).toBeInTheDocument();
      });
    }
  });

  test('handles empty search queries gracefully', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const fromInput = screen.getByPlaceholderText(/Enter origin city/i);
    
    fireEvent.change(fromInput, { target: { value: 'Manila' } });
    fireEvent.change(fromInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.queryByText(/Manila/i)).not.toBeInTheDocument();
    });
  });

  test('displays correct info messages for different states', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(screen.getByText(/Enter origin and destination to calculate route distance/i)).toBeInTheDocument();

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'Taxi' } });

    expect(screen.getByText(/Enter origin and destination to calculate route distance/i)).toBeInTheDocument();
  });

  test('handles CSV parsing errors gracefully', async () => {
    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: [], errors: ['Parse error'] });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(screen.getByText(/Transportation Cost Estimator/i)).toBeInTheDocument();
  });

  test('vehicle selection resets dependent dropdowns', async () => {
    const mockData = [
      { 'Vehicle Type': 'Taxi', 'Sub-Type': 'Regular Taxi', 'Base Rate(First 5 or 4 kilometers)': '40', 'Rate per km (₱)': '13.5', 'Per Minute Travel time': '2' },
      { 'Vehicle Type': 'PUJ', 'Sub-Type': 'Traditional Jeepney', 'Base Rate(First 5 or 4 kilometers)': '13', 'Rate per km (₱)': '2.20', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    
    fireEvent.change(vehicleSelect, { target: { value: 'Taxi' } });
    
    await waitFor(() => {
      expect(screen.getByLabelText(/Taxi Type/i)).toBeInTheDocument();
    });

    fireEvent.change(vehicleSelect, { target: { value: 'PUJ' } });
    
    await waitFor(() => {
      expect(screen.queryByLabelText(/Taxi Type/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Jeepney Type/i)).toBeInTheDocument();
    });
  });

  test('UVE vehicle type shows subtype dropdown', async () => {
    const mockData = [
      { 'Vehicle Type': 'UVE', 'Sub-Type': 'UV Express Van', 'Base Rate(First 5 or 4 kilometers)': '15', 'Rate per km (₱)': '3', 'Per Minute Travel time': '0' },
    ];

    Papa.parse.mockImplementation((path, options) => {
      setTimeout(() => {
        options.complete({ data: mockData });
      }, 0);
    });

    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const vehicleSelect = screen.getByLabelText(/Vehicle Type/i);
    fireEvent.change(vehicleSelect, { target: { value: 'UVE' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Van Type/i)).toBeInTheDocument();
    });
  });

  test('component renders without map initialization errors', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);
    
    // Verify main components are present
    expect(screen.getByText(/Transportation Cost Estimator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Vehicle Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Travel Time \(minutes\)/i)).toBeInTheDocument();
  });
  
  test('input fields have correct placeholders', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(screen.getByPlaceholderText(/Enter origin city/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter destination city/i)).toBeInTheDocument();
  });

  test('travel time has default value of 20', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    const timeInput = screen.getByLabelText(/Travel Time \(minutes\)/i);
    expect(timeInput.value).toBe('20');
  });

  test('CSV data loads on component mount', async () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    await waitFor(() => {
      expect(Papa.parse).toHaveBeenCalled();
    });
  });

  test('modal has correct CSS classes', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(document.querySelector('.cost-backdrop')).toBeInTheDocument();
    expect(document.querySelector('.cost-modal')).toBeInTheDocument();
    expect(document.querySelector('.cost-header')).toBeInTheDocument();
  });

  test('displays all required UI elements', () => {
    render(<ItineraryCostEstimationModal onClose={mockOnClose} />);

    expect(screen.getByText(/Transportation Cost Estimator/i)).toBeInTheDocument();
    expect(screen.getByText('×')).toBeInTheDocument();
    expect(screen.getByLabelText(/Vehicle Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Travel Time \(minutes\)/i)).toBeInTheDocument();
  });
});
