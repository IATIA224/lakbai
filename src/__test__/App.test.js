import React from 'react';
import { renderWithProviders } from '../test-utils';
import App from '../App';

describe('App', () => {
  test('renders login route by default (root path)', () => {
    const { container } = renderWithProviders(<App />, { route: '/' });
    expect(container.firstChild).toBeTruthy();
  });

  test('navigates to /profile without crashing (MemoryRouter simulation)', () => {
    const { container } = renderWithProviders(<App />, { route: '/profile' });
    expect(container.firstChild).toBeTruthy();
  });
});