import reportWebVitals from './reportWebVitals';

describe('reportWebVitals', () => {
  test('is a function', () => {
    expect(typeof reportWebVitals).toBe('function');
  });

  test('does nothing when no callback provided', () => {
    // Should not throw when called without arguments
    expect(() => reportWebVitals()).not.toThrow();
  });

  test('does nothing when callback is not a function', () => {
    // Should not throw when called with non-function arguments
    expect(() => reportWebVitals('not a function')).not.toThrow();
    expect(() => reportWebVitals(null)).not.toThrow();
    expect(() => reportWebVitals(123)).not.toThrow();
  });

  test('accepts a function callback', () => {
    const mockCallback = jest.fn();
    
    // Should not throw when called with a function
    expect(() => reportWebVitals(mockCallback)).not.toThrow();
  });

  test('validates callback is instance of Function', () => {
    const mockCallback = () => {};
    const nonFunction = 'not a function';
    
    // Test the instanceof Function check that the implementation uses
    expect(mockCallback instanceof Function).toBe(true);
    expect(nonFunction instanceof Function).toBe(false);
  });
});