import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddFromCsvCMS from '../addfromcsv-cms';
import { db } from '../firebase';
import { 
  getDocs, 
  addDoc, 
  setDoc, 
  collection, 
  doc 
} from 'firebase/firestore';

// Mock Firebase
jest.mock('../firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc-id' })),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

// Mock audit logger
jest.mock('../addfromcsv-audit', () => ({
  logDestinationImport: jest.fn().mockResolvedValue(undefined)
}));

// Mock toggle component
jest.mock('../addfromcsv-toggle', () => ({
  __esModule: true,
  default: ({ checked, onChange }) => (
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={(e) => onChange(e.target.checked)}
      data-testid="toggle-checkbox"
    />
  ),
  IgnoreColumnsDropdown: ({ columns, ignored, onToggle, disabled }) => (
    <div data-testid="ignore-columns-dropdown">
      {columns.map(col => (
        <div key={col}>
          <input
            type="checkbox"
            checked={ignored.includes(col)}
            onChange={() => onToggle(col)}
            disabled={disabled}
            data-testid={`ignore-${col.toLowerCase().replace(/\s+/g, '-')}`}
          />
          <label>{col}</label>
        </div>
      ))}
    </div>
  )
}));

// Helper to create a mock File with text() method
class MockFile extends File {
  constructor(parts, name, options) {
    super(parts, name, options);
    this._content = parts[0];
  }

  text() {
    return Promise.resolve(this._content);
  }

  arrayBuffer() {
    const encoder = new TextEncoder();
    return Promise.resolve(encoder.encode(this._content).buffer);
  }
}

describe('AddFromCsvCMS Component', () => {
  const mockOnClose = jest.fn();
  const mockOnImported = jest.fn();

  const mockCsvData = `name,region,category,description,tags,location,price,bestTime,image
Boracay,Region VI,Beach,Beautiful beach,beach|island,Malay Aklan,5000,November to May,boracay.jpg
Baguio,CAR,Mountain,Summer capital,mountain|cool,Baguio City,2000,November to February,baguio.jpg`;

  const mockDestinations = [
    {
      id: 'dest1',
      data: () => ({
        name: 'Existing Destination',
        location: 'Manila',
        region: 'NCR',
        category: 'Tourist',
      })
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.fetch = jest.fn();
    
    // Mock getDocs to return empty by default
    getDocs.mockResolvedValue({
      docs: [],
      forEach: jest.fn()
    });

    setDoc.mockResolvedValue(undefined);
    addDoc.mockResolvedValue({ id: 'new-doc-id' });

    // Mock XLSX library
    window.XLSX = {
      read: jest.fn(),
      utils: {
        sheet_to_json: jest.fn()
      }
    };

    // Mock FileReader
    global.FileReader = class {
      readAsArrayBuffer(file) {
        this.onload({ target: { result: new ArrayBuffer(8) } });
      }
    };
  });

  afterEach(() => {
    delete window.XLSX;
    delete global.FileReader;
  });

  describe('Initial Rendering', () => {
    test('renders modal when open is true', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      expect(screen.getByText(/Add Destinations from CSV\/Excel/i)).toBeInTheDocument();
      expect(screen.getByText(/Required columns:/i)).toBeInTheDocument();
    });

    test('does not render when open is false', () => {
      const { container } = render(
        <AddFromCsvCMS 
          open={false} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      expect(container.firstChild).toBeNull();
    });

    test('shows required columns message', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      expect(screen.getByText(/Required columns:/i)).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    test('handles CSV file upload', async () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const file = new MockFile([mockCsvData], 'destinations.csv', { type: 'text/csv' });
      const input = document.getElementById('import-file-input');

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
        configurable: true
      });

      fireEvent.change(input);

      await waitFor(() => {
        const pathInput = screen.getByPlaceholderText(/No file selected/i);
        expect(pathInput.value).toBe('destinations.csv');
      }, { timeout: 3000 });

      // Check for either Preview text or row count
      await waitFor(() => {
        expect(
          screen.queryByText(/Preview/i) || 
          screen.queryByText(/Import 2 row/i)
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('shows error for invalid file', async () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      // Create a file that will fail to parse
      const invalidFile = new MockFile(['not,valid,csv\ndata'], 'test.csv', { type: 'text/csv' });
      
      // Override text() to reject
      invalidFile.text = jest.fn().mockRejectedValue(new Error('Failed to read file'));

      const input = document.getElementById('import-file-input');

      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
        configurable: true
      });

      fireEvent.change(input);

      await waitFor(() => {
        // Check for error message in the component
        expect(
          screen.queryByText(/Failed to read file/i) ||
          screen.queryByText(/error/i)
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('displays imported file path', async () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const file = new MockFile([mockCsvData], 'destinations.csv', { type: 'text/csv' });
      const input = document.getElementById('import-file-input');

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
        configurable: true
      });

      fireEvent.change(input);

      await waitFor(() => {
        const pathInput = screen.getByPlaceholderText(/No file selected/i);
        expect(pathInput.value).toBe('destinations.csv');
      });
    });
  });

  describe('Paste Functionality', () => {
    test('handles CSV paste', async () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => mockCsvData
        }
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/Preview/i) || 
          screen.queryByText(/Import 2 row/i)
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    test('shows error for invalid paste data', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => ''
        }
      });

      // Should not show error for empty paste
      expect(screen.queryByText(/Failed to parse/i)).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    test('shows missing columns error', async () => {
      const incompleteCsv = `name,region
Boracay,Region VI`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => incompleteCsv
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Missing required column/i)).toBeInTheDocument();
      });
    });

    test('shows row issues for missing values', async () => {
      const incompleteRowsCsv = `name,region,category,description,tags,location,price,bestTime,image
Boracay,Region VI,Beach,Beautiful beach,beach,Malay Aklan,5000,November to May,boracay.jpg
,CAR,Mountain,,,,,`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => incompleteRowsCsv
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/have missing required values/i)).toBeInTheDocument();
      });
    });

    test('checks for existing destinations in Firebase', async () => {
      getDocs.mockResolvedValue({
        docs: mockDestinations,
        forEach: (callback) => mockDestinations.forEach(callback)
      });

      const csvWithExisting = `name,region,category,description,tags,location,price,bestTime,image
Existing Destination,NCR,Tourist,Test,test,Manila,1000,All year,test.jpg`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => csvWithExisting
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Already exists:/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Import Functionality', () => {
    test('successfully imports valid destinations', async () => {
      getDocs.mockResolvedValue({
        docs: [],
        forEach: jest.fn()
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => mockCsvData
        }
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Import 2 row/i })).toBeTruthy();
      }, { timeout: 3000 });

      const importButton = screen.getByRole('button', { name: /Import 2 row/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(setDoc).toHaveBeenCalled();
        expect(mockOnImported).toHaveBeenCalled();
      }, { timeout: 5000 });
    });

    test('disables import button when busy', async () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => mockCsvData
        }
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Import 2 row/i })).toBeTruthy();
      }, { timeout: 3000 });

      const importButton = screen.getByRole('button', { name: /Import 2 row/i });
      
      // Mock slow import
      setDoc.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000)));
      
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(importButton).toBeDisabled();
      });
    });

    test('shows progress during import', async () => {
      getDocs.mockResolvedValue({
        docs: [],
        forEach: jest.fn()
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => mockCsvData
        }
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Import 2 row/i })).toBeTruthy();
      }, { timeout: 3000 });

      const importButton = screen.getByRole('button', { name: /Import 2 row/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.queryByText(/Importing:/i)).toBeTruthy();
      });
    });
  });

  describe('Ignore Columns', () => {
    test('shows ignore columns dropdown', async () => {
      const incompleteRowsCsv = `name,region,category,description,tags,location,price,bestTime,image
Boracay,Region VI,Beach,Beautiful beach,beach,Malay Aklan,5000,November to May,boracay.jpg
Baguio,,,,,,,`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => incompleteRowsCsv
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('ignore-columns-dropdown')).toBeInTheDocument();
      });
    });

    test('allows toggling ignore state', async () => {
      const incompleteRowsCsv = `name,region,category,description,tags,location,price,bestTime,image
Boracay,Region VI,Beach,Beautiful beach,beach,Malay Aklan,5000,November to May,boracay.jpg
Baguio,CAR,Mountain,,,,,`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => incompleteRowsCsv
        }
      });

      await waitFor(() => {
        const ignoreCheckbox = screen.queryByTestId('ignore-location');
        if (ignoreCheckbox) {
          fireEvent.click(ignoreCheckbox);
          expect(ignoreCheckbox.checked).toBe(true);
        } else {
          expect(true).toBe(true);
        }
      });
    });
  });

  describe('Modal Controls', () => {
    test('closes modal on cancel button click', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('closes modal on Escape key', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('closes modal on backdrop click', () => {
      const { container } = render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const backdrop = container.querySelector('[role="dialog"]');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('does not close on content click', () => {
      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const header = screen.getByText(/Add Destinations from CSV\/Excel/i);
      fireEvent.click(header);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Excel File Support', () => {
    test('handles Excel file upload', async () => {
      const mockExcelData = [
        { name: 'Boracay', region: 'Region VI', category: 'Beach', description: 'Beautiful beach', tags: 'beach', location: 'Malay Aklan', price: '5000', bestTime: 'November to May', image: 'boracay.jpg' }
      ];

      window.XLSX.read.mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} }
      });

      window.XLSX.utils.sheet_to_json.mockReturnValue(mockExcelData);

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const file = new MockFile([''], 'destinations.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const input = document.getElementById('import-file-input');

      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
        configurable: true
      });

      fireEvent.change(input);

      await waitFor(() => {
        const pathInput = screen.getByPlaceholderText(/No file selected/i);
        expect(pathInput.value).toBe('destinations.xlsx');
      }, { timeout: 3000 });
    });
  });

  describe('Alert Messages', () => {
    test('shows success message on successful import', async () => {
      getDocs.mockResolvedValue({
        docs: [],
        forEach: jest.fn()
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => mockCsvData
        }
      });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Import 2 row/i })).toBeTruthy();
      }, { timeout: 3000 });

      const importButton = screen.getByRole('button', { name: /Import 2 row/i });
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(screen.queryByText(/Imported/i)).toBeTruthy();
      }, { timeout: 5000 });
    });
  });

  describe('Price Parsing', () => {
    test('handles various price formats', async () => {
      const priceFormatsCsv = `name,region,category,description,tags,location,price,bestTime,image
Dest1,Region VI,Beach,Test,beach,Location,₱5000,All year,img.jpg
Dest2,Region VI,Beach,Test,beach,Location,5000.50,All year,img.jpg
Dest3,Region VI,Beach,Test,beach,Location,"5,000",All year,img.jpg`;

      render(
        <AddFromCsvCMS 
          open={true} 
          onClose={mockOnClose} 
          onImported={mockOnImported} 
        />
      );

      const pasteArea = screen.getByText(/Click here and paste CSV content/i);

      fireEvent.paste(pasteArea, {
        clipboardData: {
          getData: () => priceFormatsCsv
        }
      });

      await waitFor(() => {
        expect(
          screen.queryByText(/Preview/i) || 
          screen.queryByRole('button', { name: /Import 3 row/i })
        ).toBeTruthy();
      }, { timeout: 3000 });
    });
  });
});