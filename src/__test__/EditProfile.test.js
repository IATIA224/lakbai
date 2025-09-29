/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import EditProfile from "../EditProfile";

// --- Mocks ---
var mockUpdateDoc = jest.fn();
var mockDoc = jest.fn();
var mockAuth = { currentUser: { uid: "user123" } };
var mockDb = {};

jest.mock("../firebase", () => ({
db: mockDb,
auth: mockAuth,
}));

jest.mock("firebase/firestore", () => ({
updateDoc: (...args) => mockUpdateDoc(...args),
doc: (...args) => mockDoc(...args),
}));

// Mock Cloudinary upload
global.fetch = jest.fn(() =>
Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ secure_url: "/uploaded.png" }),
})
);

describe("EditProfile", () => {
beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue({});
    mockDoc.mockReturnValue("user-doc-ref");
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => "/dummy-url");
});

it("renders with initial data", () => {
    render(<EditProfile initialData={{ name: "Jane", bio: "Traveler", interests: [] }} />);
    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Traveler")).toBeInTheDocument();
    expect(screen.getByText(/Travel Interests/i)).toBeInTheDocument();
});

it("calls onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<EditProfile onClose={onClose} />);
    fireEvent.click(screen.getByText(/Cancel/i));
    expect(onClose).toHaveBeenCalled();
});

it("cycles interest status on click", () => {
    render(<EditProfile />);
    const interest = screen.getByRole("button", { name: /Surfer/i });
    expect(interest).toHaveStyle("border: 2px solid transparent");
    fireEvent.click(interest);
    expect(interest).toHaveStyle("border: 2px solid #6c63ff");
    fireEvent.click(interest);
    expect(interest).toHaveStyle("background: #fee2e2");
    fireEvent.click(interest);
    expect(interest).toHaveStyle("border: 2px solid transparent");
});

it("shows bio character count", () => {
    render(<EditProfile />);
    expect(screen.getByText(/characters/)).toBeInTheDocument();
});

it("does not call updateDoc if nothing changed", async () => {
    const onClose = jest.fn();
    render(<EditProfile initialData={{ name: "", bio: "", interests: [] }} onClose={onClose} />);
    fireEvent.click(screen.getByText(/Save Profile/i));
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled(); // or .toHaveBeenCalledTimes(0)
});

it("alerts on updateDoc error", async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error("fail"));
    window.alert = jest.fn();
    render(<EditProfile />);
    fireEvent.change(screen.getByPlaceholderText(/John Doe/i), { target: { value: "Changed" } });
    fireEvent.click(screen.getByText(/Save Profile/i));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Failed to save profile"));
});
});