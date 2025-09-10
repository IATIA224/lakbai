import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AchievementToast from './AchievementToast';

// Mock the CSS import
jest.mock('./achievement-toast.css', () => ({}));

describe('AchievementToast', () => {
  beforeEach(() => {
    // Clear any existing timeouts
    if (window.__ach_to__) {
      clearTimeout(window.__ach_to__);
      window.__ach_to__ = null;
    }
  });

  afterEach(() => {
    // Clean up timeouts after each test
    if (window.__ach_to__) {
      clearTimeout(window.__ach_to__);
      window.__ach_to__ = null;
    }
  });

  test('renders nothing by default', () => {
    const { container } = render(<AchievementToast />);
    expect(container.firstChild).toBeNull();
  });

  test('displays achievement message when event is dispatched', async () => {
    const { getByText } = render(<AchievementToast />);

    // Dispatch achievement event
    const event = new CustomEvent('achievement:unlock', {
      detail: { message: 'Test Achievement Unlocked!' }
    });
    window.dispatchEvent(event);

    // Should display the achievement notification
    await waitFor(() => {
      expect(getByText('Test Achievement Unlocked!')).toBeInTheDocument();
    });

    // Should have the correct elements
    expect(getByText('🏆')).toBeInTheDocument();
  });

  test('uses default message when no message provided in event', async () => {
    const { getByText } = render(<AchievementToast />);

    // Dispatch achievement event without custom message
    const event = new CustomEvent('achievement:unlock', {
      detail: {}
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(getByText('Achievement Unlocked! 🎉')).toBeInTheDocument();
    });
  });

  test('uses default message when event has no detail', async () => {
    const { getByText } = render(<AchievementToast />);

    // Dispatch achievement event without detail
    const event = new CustomEvent('achievement:unlock');
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(getByText('Achievement Unlocked! 🎉')).toBeInTheDocument();
    });
  });

  test('hides notification after 3 seconds', async () => {
    jest.useFakeTimers();
    
    const { getByText, container } = render(<AchievementToast />);

    // Dispatch achievement event
    const event = new CustomEvent('achievement:unlock', {
      detail: { message: 'Test Achievement!' }
    });
    window.dispatchEvent(event);

    // Should be visible immediately
    await waitFor(() => {
      expect(getByText('Test Achievement!')).toBeInTheDocument();
    });

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    // Should be hidden after timeout
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });

    jest.useRealTimers();
  });

  test('clears previous timeout when new achievement is triggered', async () => {
    jest.useFakeTimers();
    
    const { getByText } = render(<AchievementToast />);

    // Dispatch first achievement
    const event1 = new CustomEvent('achievement:unlock', {
      detail: { message: 'First Achievement!' }
    });
    window.dispatchEvent(event1);

    await waitFor(() => {
      expect(getByText('First Achievement!')).toBeInTheDocument();
    });

    // Fast-forward 1 second
    jest.advanceTimersByTime(1000);

    // Dispatch second achievement before first times out
    const event2 = new CustomEvent('achievement:unlock', {
      detail: { message: 'Second Achievement!' }
    });
    window.dispatchEvent(event2);

    await waitFor(() => {
      expect(getByText('Second Achievement!')).toBeInTheDocument();
    });

    // Fast-forward 2 more seconds (total 3 from first, 2 from second)
    jest.advanceTimersByTime(2000);

    // Should still be visible (second timeout should be active)
    expect(getByText('Second Achievement!')).toBeInTheDocument();

    // Fast-forward 1 more second (total 3 from second event)
    jest.advanceTimersByTime(1000);

    // Now should be hidden
    await waitFor(() => {
      expect(getByText('Second Achievement!')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  test('has correct CSS classes and structure', async () => {
    const { container } = render(<AchievementToast />);

    // Dispatch achievement event
    const event = new CustomEvent('achievement:unlock', {
      detail: { message: 'Styled Achievement!' }
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      const notification = container.querySelector('.achievement-notification');
      expect(notification).toBeInTheDocument();
      
      const icon = container.querySelector('.achievement-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('🏆');
    });
  });

  test('cleans up event listener on unmount', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(<AchievementToast />);

    expect(addEventListenerSpy).toHaveBeenCalledWith('achievement:unlock', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('achievement:unlock', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});