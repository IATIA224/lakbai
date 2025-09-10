// Ensure slugifyName & mapItineraryToTripDoc are exported from tripsMirror.js
import { slugifyName, mapItineraryToTripDoc } from '../tripsMirror';

describe('tripsMirror helpers', () => {
  test('slugifyName', () => {
    expect(slugifyName("El Nido's Cove")).toBe('el-nidos-cove');
    expect(slugifyName('  Banaue Rice Terraces  ')).toBe('banaue-rice-terraces');
  });

  test('mapItineraryToTripDoc numeric coercion', () => {
    const result = mapItineraryToTripDoc(
      { name: 'Boracay', region: 'Aklan', budget: '1500', activities: ['Snorkel'] },
      'item123',
      'userABC'
    );
    expect(result).toMatchObject({
      name: 'Boracay',
      region: 'Aklan',
      budget: 1500,
      activities: ['Snorkel'],
      ownerId: 'userABC',
      fromItineraryItemId: 'item123'
    });
  });
});