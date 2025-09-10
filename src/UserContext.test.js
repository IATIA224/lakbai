import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserProvider, useUser } from './UserContext';

describe('UserContext', () => {
  describe('UserProvider', () => {
    test('renders children without crashing', () => {
      const TestChild = () => <div>Test Child</div>;
      
      const { getByText } = render(
        <UserProvider>
          <TestChild />
        </UserProvider>
      );

      expect(getByText('Test Child')).toBeInTheDocument();
    });

    test('provides initial profile state to children', () => {
      const TestConsumer = () => {
        const profile = useUser();
        return (
          <div>
            <span data-testid="name">{profile.name || 'empty'}</span>
            <span data-testid="bio">{profile.bio || 'empty'}</span>
            <span data-testid="picture">{profile.profilePicture}</span>
            <span data-testid="likes-length">{profile.likes.length}</span>
            <span data-testid="dislikes-length">{profile.dislikes.length}</span>
            <span data-testid="joined">{profile.joined || 'empty'}</span>
          </div>
        );
      };

      const { getByTestId } = render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      expect(getByTestId('name')).toHaveTextContent('empty');
      expect(getByTestId('bio')).toHaveTextContent('empty');
      expect(getByTestId('picture')).toHaveTextContent('/user.png');
      expect(getByTestId('likes-length')).toHaveTextContent('0');
      expect(getByTestId('dislikes-length')).toHaveTextContent('0');
      expect(getByTestId('joined')).toHaveTextContent('empty');
    });
  });

  describe('useUser', () => {
    test('returns the profile from context', () => {
      let profileFromHook = null;

      const TestConsumer = () => {
        profileFromHook = useUser();
        return <div>Consumer</div>;
      };

      render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      expect(profileFromHook).toEqual({
        name: "",
        bio: "",
        profilePicture: "/user.png",
        likes: [],
        dislikes: [],
        joined: "",
      });
    });

    test('throws error when used outside UserProvider', () => {
      const TestConsumer = () => {
        useUser(); // This should throw
        return <div>Should not render</div>;
      };

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useUser must be used within a UserProvider');

      consoleSpy.mockRestore();
    });

    test('provides access to profile properties', () => {
      const TestConsumer = () => {
        const profile = useUser();
        return (
          <div>
            <div data-testid="profile-picture-src">{profile.profilePicture}</div>
            <div data-testid="likes-array">{JSON.stringify(profile.likes)}</div>
            <div data-testid="dislikes-array">{JSON.stringify(profile.dislikes)}</div>
          </div>
        );
      };

      const { getByTestId } = render(
        <UserProvider>
          <TestConsumer />
        </UserProvider>
      );

      expect(getByTestId('profile-picture-src')).toHaveTextContent('/user.png');
      expect(getByTestId('likes-array')).toHaveTextContent('[]');
      expect(getByTestId('dislikes-array')).toHaveTextContent('[]');
    });
  });

  test('nested UserProviders work independently', () => {
    const OuterConsumer = () => {
      const profile = useUser();
      return <span data-testid="outer-name">{profile.name || 'outer-empty'}</span>;
    };

    const InnerConsumer = () => {
      const profile = useUser();
      return <span data-testid="inner-name">{profile.name || 'inner-empty'}</span>;
    };

    const { getByTestId } = render(
      <UserProvider>
        <OuterConsumer />
        <UserProvider>
          <InnerConsumer />
        </UserProvider>
      </UserProvider>
    );

    expect(getByTestId('outer-name')).toHaveTextContent('outer-empty');
    expect(getByTestId('inner-name')).toHaveTextContent('inner-empty');
  });

  test('multiple consumers receive the same profile data', () => {
    const Consumer1 = () => {
      const profile = useUser();
      return <span data-testid="consumer1">{profile.profilePicture}</span>;
    };

    const Consumer2 = () => {
      const profile = useUser();
      return <span data-testid="consumer2">{profile.profilePicture}</span>;
    };

    const { getByTestId } = render(
      <UserProvider>
        <Consumer1 />
        <Consumer2 />
      </UserProvider>
    );

    expect(getByTestId('consumer1')).toHaveTextContent('/user.png');
    expect(getByTestId('consumer2')).toHaveTextContent('/user.png');
  });
});