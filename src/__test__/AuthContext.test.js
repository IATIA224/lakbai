/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, } from "@testing-library/react";
import { AuthProvider, useAuth } from "../AuthContext";

// --- Mock firebase/auth ---
var mockOnAuthStateChanged = jest.fn();
jest.mock("firebase/auth", () => ({
onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

// --- Mock ./firebase ---
jest.mock("../firebase", () => ({
auth: {},
}));

// --- Test component to consume AuthContext ---
function ShowUser() {
const user = useAuth();
return (
    <div data-testid="user">
    {user ? user.email : "No user"}
    </div>
);
}

describe("AuthContext", () => {
beforeEach(() => {
    jest.clearAllMocks();
});

it("provides null user by default", async () => {
    // Simulate onAuthStateChanged calls callback with null
    mockOnAuthStateChanged.mockImplementation((auth, cb) => {
    cb(null);
    return () => {};
    });

    render(
    <AuthProvider>
        <ShowUser />
    </AuthProvider>
    );
    expect(screen.getByTestId("user")).toHaveTextContent("No user");
});

it("provides firebase user when authenticated", async () => {
    const fakeUser = { uid: "abc", email: "test@example.com" };
    mockOnAuthStateChanged.mockImplementation((auth, cb) => {
    cb(fakeUser);
    return () => {};
    });

    render(
    <AuthProvider>
        <ShowUser />
    </AuthProvider>
    );
    expect(screen.getByTestId("user")).toHaveTextContent("test@example.com");
});

it("cleans up on unmount", () => {
    const unsubscribe = jest.fn();
    mockOnAuthStateChanged.mockImplementation((auth, cb) => {
    cb(null);
    return unsubscribe;
    });

    const { unmount } = render(
    <AuthProvider>
        <ShowUser />
    </AuthProvider>
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
});
});