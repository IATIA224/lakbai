// Force real react-router-dom (avoid local manual mock)
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return actual;
});

// Stub UserContext to a no-op provider (avoids auth listeners)
jest.mock('./UserContext', () => ({
  __esModule: true,
  UserProvider: ({ children }) => <>{children}</>
}));

// Mock all heavy route components to lightweight stubs (default exports)
jest.mock('./login', () => ({ __esModule: true, default: () => <div>Login</div> }));
jest.mock('./register', () => ({ __esModule: true, default: () => <div>Register</div> }));
jest.mock('./dashboard', () => ({ __esModule: true, default: () => <div>Dashboard</div> }));
jest.mock('./bookmark', () => ({ __esModule: true, default: () => <div>Bookmark</div> }));
jest.mock('./bookmarks2', () => ({ __esModule: true, default: () => <div>Bookmarks2</div> }));
jest.mock('./community', () => ({ __esModule: true, default: () => <div>Community</div> }));
jest.mock('./profile', () => ({ __esModule: true, default: () => <div>Profile</div> }));
jest.mock('./Itinerary', () => ({ __esModule: true, default: () => <div>Itinerary</div> }));
jest.mock('./DestinationManager', () => ({ __esModule: true, default: () => <div>DestinationManager</div> }));
jest.mock('./components/UserManagement', () => ({ __esModule: true, default: () => <div>UserManagement</div> }));
jest.mock('./ContentManagement', () => ({ __esModule: true, default: () => <div>ContentManagement</div> }));
jest.mock('./header', () => ({ __esModule: true, default: () => <div>Header</div> }));
jest.mock('./footer', () => ({ __esModule: true, default: () => <div>Footer</div> }));
jest.mock('./AchievementToast', () => ({ __esModule: true, default: () => <div>Toast</div> }));
jest.mock('./Ai', () => ({ __esModule: true, ChatbaseAIModal: () => <div>AI</div> }));

// Browser-only libs
jest.mock('react-leaflet', () => ({
  __esModule: true,
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }) => <div>{children}</div>,
}));
jest.mock('mapbox-gl', () => ({ __esModule: true, default: {} }));
jest.mock('jspdf', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({
  text: jest.fn(),
  addImage: jest.fn(),
  save: jest.fn(),
})) }));
jest.mock('jspdf-autotable', () => ({ __esModule: true, default: jest.fn() }));

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders without crashing', () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(container.firstChild).toBeTruthy();
});
