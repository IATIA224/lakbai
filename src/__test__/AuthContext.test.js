// If AuthContext is actually used (else you might remove this).
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../firebase', () => ({
  auth: {},
}));

function TestConsumer() {
  const user = useAuth();
  return <div data-testid="auth-user">{user ? user.uid : 'no-user'}</div>;
}

describe('AuthContext', () => {
  test('provides null user initially (mocked)', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId('auth-user')).toHaveTextContent('no-user');
  });
});