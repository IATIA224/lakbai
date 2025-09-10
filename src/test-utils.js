import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { UserProvider } from './UserContext';

export function renderWithProviders(ui, { route = '/' } = {}) {
    return render(
    <MemoryRouter initialEntries={[route]}>
        <UserProvider>
        {ui}
        </UserProvider>
    </MemoryRouter>
    );
}