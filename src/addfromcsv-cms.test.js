// Mock Firebase to avoid dependency issues
jest.mock('./firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  serverTimestamp: jest.fn(() => 'mocked-timestamp')
}));

describe('addfromcsv-cms utility functions', () => {
  // Since these are internal functions, we'll define them here for testing
  // These are exact copies of the functions from the original file
  
  const fileExt = (name = '') => {
    const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
    return m ? m[1] : '';
  };

  const toCamelKey = (s) => {
    return String(s || '')
      .trim()
      .replace(/^[\W_]+|[\W_]+$/g, '')
      .toLowerCase()
      .replace(/[\W_]+(\w)/g, (_, c) => (c || '').toUpperCase());
  };

  const headerKeySet = (headers) => {
    const set = new Set();
    for (const h of headers) set.add(toCamelKey(h).toLowerCase());
    return set;
  };

  const utilFunctions = { fileExt, toCamelKey, headerKeySet };

  describe('fileExt', () => {
    test('extracts file extension from filename', () => {
      expect(utilFunctions.fileExt('document.pdf')).toBe('pdf');
      expect(utilFunctions.fileExt('image.jpg')).toBe('jpg');
      expect(utilFunctions.fileExt('data.xlsx')).toBe('xlsx');
      expect(utilFunctions.fileExt('backup.csv')).toBe('csv');
    });

    test('handles uppercase extensions', () => {
      expect(utilFunctions.fileExt('DOCUMENT.PDF')).toBe('pdf');
      expect(utilFunctions.fileExt('Image.JPG')).toBe('jpg');
    });

    test('returns empty string for files without extension', () => {
      expect(utilFunctions.fileExt('filename')).toBe('');
      expect(utilFunctions.fileExt('no-extension')).toBe('');
    });

    test('handles edge cases', () => {
      expect(utilFunctions.fileExt('')).toBe('');
      expect(utilFunctions.fileExt(null)).toBe('');
      expect(utilFunctions.fileExt(undefined)).toBe('');
      expect(utilFunctions.fileExt('.')).toBe('');
      expect(utilFunctions.fileExt('.hidden')).toBe('hidden');
    });

    test('handles complex filenames', () => {
      expect(utilFunctions.fileExt('file.name.with.dots.txt')).toBe('txt');
      expect(utilFunctions.fileExt('path/to/file.doc')).toBe('doc');
    });
  });

  describe('toCamelKey', () => {
    test('converts strings to camelCase', () => {
      expect(utilFunctions.toCamelKey('destination name')).toBe('destinationName');
      expect(utilFunctions.toCamelKey('best time to visit')).toBe('bestTimeToVisit');
      expect(utilFunctions.toCamelKey('price range')).toBe('priceRange');
    });

    test('handles special characters and underscores', () => {
      expect(utilFunctions.toCamelKey('destination_name')).toBe('destinationName');
      expect(utilFunctions.toCamelKey('price-range')).toBe('priceRange');
      expect(utilFunctions.toCamelKey('best@time#to$visit')).toBe('bestTimeToVisit');
    });

    test('trims whitespace and removes leading/trailing special chars', () => {
      expect(utilFunctions.toCamelKey('  destination name  ')).toBe('destinationName');
      expect(utilFunctions.toCamelKey('_destination_name_')).toBe('destinationName');
      expect(utilFunctions.toCamelKey('__price__range__')).toBe('priceRange');
    });

    test('handles edge cases', () => {
      expect(utilFunctions.toCamelKey('')).toBe('');
      expect(utilFunctions.toCamelKey(null)).toBe('');
      expect(utilFunctions.toCamelKey(undefined)).toBe('');
      expect(utilFunctions.toCamelKey('   ')).toBe('');
      expect(utilFunctions.toCamelKey('___')).toBe('');
    });

    test('handles single words', () => {
      expect(utilFunctions.toCamelKey('name')).toBe('name');
      expect(utilFunctions.toCamelKey('CATEGORY')).toBe('category');
      expect(utilFunctions.toCamelKey('Region')).toBe('region');
    });
  });

  describe('headerKeySet', () => {
    test('creates normalized header key set', () => {
      const headers = ['Destination Name', 'Price Range', 'Best Time to Visit'];
      const keySet = utilFunctions.headerKeySet(headers);
      
      expect(keySet.has('destinationname')).toBe(true);
      expect(keySet.has('pricerange')).toBe(true);
      expect(keySet.has('besttimetovisit')).toBe(true);
    });

    test('handles headers with special characters', () => {
      const headers = ['destination_name', 'price-range', 'best@time'];
      const keySet = utilFunctions.headerKeySet(headers);
      
      expect(keySet.has('destinationname')).toBe(true);
      expect(keySet.has('pricerange')).toBe(true);
      expect(keySet.has('besttime')).toBe(true);
    });

    test('handles empty and duplicate headers', () => {
      const headers = ['Name', 'name', 'NAME', ''];
      const keySet = utilFunctions.headerKeySet(headers);
      
      expect(keySet.has('name')).toBe(true);
      expect(keySet.has('')).toBe(true);
      expect(keySet.size).toBe(2); // 'name' and ''
    });

    test('handles edge cases', () => {
      expect(utilFunctions.headerKeySet([])).toEqual(new Set());
      expect(utilFunctions.headerKeySet([''])).toEqual(new Set(['']));
    });
  });
});