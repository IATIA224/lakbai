import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserProvider, useUser } from '../UserContext';

function UserConsumer() {
  const profile = useUser();
  return <div data-testid="profile-name">{profile.name}</div>;
}

describe('UserContext', () => {
  test('provides default profile', () => {
    render(
      <UserProvider>
        <UserConsumer />
      </UserProvider>
    );
    expect(screen.getByTestId('profile-name')).toHaveTextContent('');
  });
});