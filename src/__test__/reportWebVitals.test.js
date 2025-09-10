import reportWebVitals from '../reportWebVitals';

describe('reportWebVitals', () => {
  test('does nothing if no callback provided', () => {
    expect(() => reportWebVitals()).not.toThrow();
  });

  test('calls callback for metrics (mocked dynamic import)', async () => {
    const cb = jest.fn();
    // Mock dynamic import
    const originalImport = globalThis.import;
    globalThis.import = undefined; // ensure we intercept
    jest.spyOn(global, 'import').mockImplementation(() =>
      Promise.resolve({
        getCLS: (fn) => fn({ name: 'CLS' }),
        getFID: (fn) => fn({ name: 'FID' }),
        getFCP: (fn) => fn({ name: 'FCP' }),
        getLCP: (fn) => fn({ name: 'LCP' }),
        getTTFB: (fn) => fn({ name: 'TTFB' }),
      })
    );
    reportWebVitals(cb);
    // Wait for microtasks
    await Promise.resolve();
    expect(cb).toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});