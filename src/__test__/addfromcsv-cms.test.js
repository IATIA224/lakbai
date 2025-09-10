// These functions must be exported from addfromcsv-cms.js for this test to work.
// If they are not exported, add: export { fileExt, toCamelKey, headerKeySet, getFirstValue, normalizeRowObject };
import {
  fileExt,
  toCamelKey,
  headerKeySet,
  getFirstValue,
  normalizeRowObject,
} from '../addfromcsv-cms';

describe('addfromcsv-cms helpers', () => {
  test('fileExt', () => {
    expect(fileExt('data.xlsx')).toBe('xlsx');
    expect(fileExt('foo.csv')).toBe('csv');
    expect(fileExt('noext')).toBe('');
  });

  test('toCamelKey', () => {
    expect(toCamelKey(' Best Time To Visit ')).toBe('bestTimeToVisit');
    expect(toCamelKey('price_range')).toBe('priceRange');
  });

  test('headerKeySet', () => {
    const set = headerKeySet(['Name', ' Region ', 'Category']);
    expect(set.has('name')).toBe(true);
    expect(set.has('region')).toBe(true);
    expect(set.has('category')).toBe(true);
  });

  test('getFirstValue', () => {
    const row = { name: '', destination: 'Palawan', title: 'El Nido' };
    expect(getFirstValue(row, ['name', 'destination', 'title'])).toBe('Palawan');
  });

  test('normalizeRowObject', () => {
    const headers = ['Name', 'Region', 'Category'];
    const row = ['Boracay', 'Western Visayas', 'Beach'];
    expect(normalizeRowObject(row, headers)).toEqual({
      name: 'Boracay',
      region: 'Western Visayas',
      category: 'Beach'
    });
  });
});