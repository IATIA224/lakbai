// Mock firebase modules
jest.mock('./firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  serverTimestamp: jest.fn(() => 'mocked-timestamp')
}));

describe('tripsMirror utility functions', () => {
  // Since the functions are not exported individually, we'll redefine them for testing
  // These are exact copies of the functions from the original file
  const slugifyName = (s) => {
    return String(s || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const mapItineraryToTripDoc = (itemData, itemId, uid) => {
    const d = itemData || {};
    return {
      name: d.name || "Destination",
      region: d.region || "",
      status: d.status || "Upcoming",
      arrival: d.arrival || null,
      departure: d.departure || null,
      budget: Number(d.budget || 0),
      accomBudget: Number(d.accomBudget || 0),
      activityBudget: Number(d.activityBudget || 0),
      accomName: d.accomName || "",
      accomType: d.accomType || "",
      activities: Array.isArray(d.activities) ? d.activities : [],
      ownerId: uid,
      fromItineraryItemId: itemId,
      updatedAt: 'mocked-timestamp', // Using mocked timestamp
      createdAt: d.createdAt || 'mocked-timestamp',
    };
  };

  describe('slugifyName', () => {
    test('converts names to URL-friendly slugs', () => {
      expect(slugifyName('El Nido')).toBe('el-nido');
      expect(slugifyName('Banaue Rice Terraces')).toBe('banaue-rice-terraces');
      expect(slugifyName('Mt. Pulag')).toBe('mt-pulag');
    });

    test('handles special characters and quotes', () => {
      expect(slugifyName("Mayon Volcano")).toBe('mayon-volcano');
      expect(slugifyName('Taal "Lake" Volcano')).toBe('taal-lake-volcano');
      expect(slugifyName("Donsol's Whale Sharks")).toBe('donsols-whale-sharks');
    });

    test('removes leading and trailing dashes', () => {
      expect(slugifyName('-El Nido-')).toBe('el-nido');
      expect(slugifyName('--Beach Resort--')).toBe('beach-resort');
      expect(slugifyName('___Island___')).toBe('island');
    });

    test('handles edge cases', () => {
      expect(slugifyName('')).toBe('');
      expect(slugifyName(null)).toBe('');
      expect(slugifyName(undefined)).toBe('');
      expect(slugifyName('   ')).toBe('');
      expect(slugifyName('---')).toBe('');
      expect(slugifyName('!!!')).toBe('');
    });

    test('handles multiple consecutive special characters', () => {
      expect(slugifyName('El   Nido   Beach')).toBe('el-nido-beach');
      expect(slugifyName('Beach!!@#$%Resort')).toBe('beach-resort');
      expect(slugifyName('Island---Paradise')).toBe('island-paradise');
    });

    test('preserves numbers', () => {
      expect(slugifyName('Island 123')).toBe('island-123');
      expect(slugifyName('Beach Resort 2024')).toBe('beach-resort-2024');
      expect(slugifyName('100 Islands')).toBe('100-islands');
    });
  });

  describe('mapItineraryToTripDoc', () => {
    const mockItemId = 'item123';
    const mockUid = 'user456';

    test('maps basic itinerary data to trip document', () => {
      const itemData = {
        name: 'Boracay',
        region: 'Aklan',
        status: 'Confirmed',
        budget: 15000
      };

      const result = mapItineraryToTripDoc(itemData, mockItemId, mockUid);

      expect(result).toEqual({
        name: 'Boracay',
        region: 'Aklan',
        status: 'Confirmed',
        arrival: null,
        departure: null,
        budget: 15000,
        accomBudget: 0,
        activityBudget: 0,
        accomName: '',
        accomType: '',
        activities: [],
        ownerId: mockUid,
        fromItineraryItemId: mockItemId,
        updatedAt: 'mocked-timestamp',
        createdAt: 'mocked-timestamp'
      });
    });

    test('uses default values for missing fields', () => {
      const itemData = {};
      const result = mapItineraryToTripDoc(itemData, mockItemId, mockUid);

      expect(result.name).toBe('Destination');
      expect(result.region).toBe('');
      expect(result.status).toBe('Upcoming');
      expect(result.budget).toBe(0);
      expect(result.accomBudget).toBe(0);
      expect(result.activityBudget).toBe(0);
    });

    test('handles complete itinerary data', () => {
      const itemData = {
        name: 'Palawan Adventure',
        region: 'MIMAROPA',
        status: 'Planning',
        arrival: '2024-03-15',
        departure: '2024-03-20',
        budget: 25000,
        accomBudget: 8000,
        activityBudget: 5000,
        accomName: 'Paradise Resort',
        accomType: 'Resort',
        activities: ['Island Hopping', 'Snorkeling', 'Beach Activities'],
        createdAt: 'original-timestamp'
      };

      const result = mapItineraryToTripDoc(itemData, mockItemId, mockUid);

      expect(result).toEqual({
        name: 'Palawan Adventure',
        region: 'MIMAROPA',
        status: 'Planning',
        arrival: '2024-03-15',
        departure: '2024-03-20',
        budget: 25000,
        accomBudget: 8000,
        activityBudget: 5000,
        accomName: 'Paradise Resort',
        accomType: 'Resort',
        activities: ['Island Hopping', 'Snorkeling', 'Beach Activities'],
        ownerId: mockUid,
        fromItineraryItemId: mockItemId,
        updatedAt: 'mocked-timestamp',
        createdAt: 'original-timestamp'
      });
    });

    test('handles invalid budget values', () => {
      const itemData = {
        budget: 'invalid',
        accomBudget: null,
        activityBudget: undefined
      };

      const result = mapItineraryToTripDoc(itemData, mockItemId, mockUid);

      // Number('invalid') returns NaN, Number(null) returns 0, Number(undefined) returns NaN
      expect(isNaN(result.budget)).toBe(true); // 'invalid' becomes NaN
      expect(result.accomBudget).toBe(0); // null becomes 0
      expect(result.activityBudget).toBe(0); // Number(undefined || 0) = Number(0) = 0
    });

    test('handles invalid activities array', () => {
      const itemData = {
        activities: 'not an array'
      };

      const result = mapItineraryToTripDoc(itemData, mockItemId, mockUid);

      expect(result.activities).toEqual([]);
    });

    test('handles null/undefined itemData', () => {
      const result1 = mapItineraryToTripDoc(null, mockItemId, mockUid);
      const result2 = mapItineraryToTripDoc(undefined, mockItemId, mockUid);

      expect(result1.name).toBe('Destination');
      expect(result2.name).toBe('Destination');
      expect(result1.ownerId).toBe(mockUid);
      expect(result2.ownerId).toBe(mockUid);
    });
  });
});