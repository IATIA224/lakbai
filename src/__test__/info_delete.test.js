/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, } from "@testing-library/react";
import InfoDelete from "../info_delete";

// --- Mocks ---
var mockSignInWithEmailAndPassword = jest.fn();
var mockSignInWithPopup = jest.fn();
var mockDeleteUser = jest.fn();
var mockDeleteDoc = jest.fn();
var mockDoc = jest.fn();
var mockAuth = {};
var mockDb = {};

jest.mock("../firebase", () => ({
auth: mockAuth,
db: mockDb,
}));

jest.mock("firebase/auth", () => ({
signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
signInWithPopup: (...args) => mockSignInWithPopup(...args),
GoogleAuthProvider: function () {},
FacebookAuthProvider: function () {},
deleteUser: (...args) => mockDeleteUser(...args),
}));

jest.mock("firebase/firestore", () => ({
doc: (...args) => mockDoc(...args),
deleteDoc: (...args) => mockDeleteDoc(...args),
}));

describe("InfoDelete", () => {
beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockImplementation((db, col, uid) => `users/${uid}`);
    mockDeleteDoc.mockResolvedValue();
    mockDeleteUser.mockResolvedValue();
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: "abc" } });
    mockSignInWithPopup.mockResolvedValue({ user: { uid: "abc" } });
});

it("renders modal and closes when close button is clicked", () => {
    const onClose = jest.fn();
    render(<InfoDelete onClose={onClose} />);
    expect(screen.getByText(/Account Management/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/close/i));
    expect(onClose).toHaveBeenCalled();
});

it("shows error popup if email delete fails", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error("fail"));
    render(<InfoDelete />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByText(/sign in/i));
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    expect(screen.getByText(/fail/i)).toBeInTheDocument();
});

it("shows success popup if email delete succeeds", async () => {
    render(<InfoDelete />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByText(/sign in/i));
    expect(await screen.findByTestId("success-popup")).toBeInTheDocument();
    expect(screen.getByText(/Account deleted successfully/i)).toBeInTheDocument();
});

it("shows success popup if Google delete succeeds", async () => {
    render(<InfoDelete />);
    fireEvent.click(screen.getByText(/Google/i));
    expect(await screen.findByTestId("success-popup")).toBeInTheDocument();
    expect(screen.getByText(/Google account deleted successfully/i)).toBeInTheDocument();
});

it("shows error popup if Google delete fails", async () => {
    mockSignInWithPopup.mockRejectedValueOnce(new Error("fail"));
    render(<InfoDelete />);
    fireEvent.click(screen.getByText(/Google/i));
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    expect(screen.getByText(/fail/i)).toBeInTheDocument();
});

it("shows success popup if Facebook delete succeeds", async () => {
    render(<InfoDelete />);
    fireEvent.click(screen.getByText(/Facebook/i));
    expect(await screen.findByText(/Success/i)).toBeInTheDocument();
    expect(screen.getByText(/Facebook account deleted successfully/i)).toBeInTheDocument();
});

it("shows error popup if Facebook delete fails", async () => {
    mockSignInWithPopup.mockRejectedValueOnce(new Error("fail"));
    render(<InfoDelete />);
    fireEvent.click(screen.getByText(/Facebook/i));
    expect(await screen.findByText(/Error/i)).toBeInTheDocument();
    expect(screen.getByText(/fail/i)).toBeInTheDocument();
});

it("closes popup and calls onClose after success", async () => {
    const onClose = jest.fn();
    render(<InfoDelete onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByText(/sign in/i));
    expect(await screen.findByText(/Success/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/^Close$/i));
    expect(onClose).toHaveBeenCalled();
});

it("can check Remember me", () => {
    render(<InfoDelete />);
    const checkbox = screen.getByLabelText(/remember me/i);
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
});
});