/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import AchievementToast from "../AchievementToast";

describe("AchievementToast", () => {
beforeEach(() => {
    jest.useFakeTimers();
});
afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
});

it("does not render anything by default", () => {
    render(<AchievementToast />);
    expect(screen.queryByTestId("achievement-notification")).toBeNull();
});

it("shows toast with default message on achievement:unlock event", () => {
    render(<AchievementToast />);
    act(() => {
    window.dispatchEvent(new CustomEvent("achievement:unlock"));
    jest.advanceTimersByTime(100); // allow state to update
    });
    expect(screen.getByText(/Achievement Unlocked/)).toBeInTheDocument();
    expect(screen.getByTestId("achievement-notification")).toBeInTheDocument();
});

it("shows toast with custom message and hides after 3 seconds", () => {
    render(<AchievementToast />);
    act(() => {
    window.dispatchEvent(
        new CustomEvent("achievement:unlock", { detail: { message: "You did it!" } })
    );
    });
    expect(screen.getByText("You did it!")).toBeInTheDocument();
    // Fast-forward 3 seconds
    act(() => {
    jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId("achievement-notification")).toBeNull();
});

it("clears previous timeout if multiple events fire quickly", () => {
    render(<AchievementToast />);
    act(() => {
    window.dispatchEvent(
        new CustomEvent("achievement:unlock", { detail: { message: "First!" } })
    );
    jest.advanceTimersByTime(1000);
    window.dispatchEvent(
        new CustomEvent("achievement:unlock", { detail: { message: "Second!" } })
    );
    jest.advanceTimersByTime(2999);
    });
    // Should still be visible because second event resets timer
    expect(screen.getByText("Second!")).toBeInTheDocument();
    // Now advance to hide
    act(() => {
    jest.advanceTimersByTime(2);
    });
    expect(screen.queryByTestId("achievement-notification")).toBeNull();
});
});