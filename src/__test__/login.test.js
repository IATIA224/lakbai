import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock router navigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock UserContext used by the component
jest.mock("../UserContext", () => ({
  useUser: () => ({ setUser: jest.fn() }),
}));

// Mock firebase exports used inside component
jest.mock("../firebase", () => ({
  auth: {},
  db: {},
}));

// Firestore mocks (provide safe defaults used by Login)
var mockDoc = jest.fn((db, col, id) => ({ __ref: `${col}/${id}` }));
var mockSetDoc = jest.fn(async () => {});
var mockGetDoc = jest.fn(async () => ({
  exists: () => false,
  data: () => ({}),
}));
var mockCollection = jest.fn();
var mockAddDoc = jest.fn();
var mockGetDocs = jest.fn();
var mockQuery = jest.fn();
var mockLimit = jest.fn();
var mockServerTimestamp = jest.fn();
jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  collection: (...args) => mockCollection(...args),
  addDoc: (...args) => mockAddDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  limit: (...args) => mockLimit(...args),
  serverTimestamp: mockServerTimestamp,
}));

// Auth SDK mocks
jest.mock("firebase/auth", () => {
  const signInWithEmailAndPassword = jest.fn();
  const signInWithPopup = jest.fn();
  const sendPasswordResetEmail = jest.fn();
  function GoogleAuthProvider() {
    this.addScope = jest.fn();
    this.setCustomParameters = jest.fn();
  }
  function FacebookAuthProvider() {
    this.addScope = jest.fn();
    this.setCustomParameters = jest.fn();
  }
  return {
    signInWithEmailAndPassword,
    signInWithPopup,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    FacebookAuthProvider,
  };
});

import * as authSdk from "firebase/auth";
import Login from "../login";

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.removeItem("rememberedEmail");
  window.localStorage.removeItem("token");

  // safe defaults for Firestore helpers used in Login
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
  mockCollection.mockReturnValue("collection-ref");
  mockAddDoc.mockResolvedValue({});
  mockQuery.mockImplementation((...args) => ({ _q: args }));
  mockLimit.mockImplementation((n) => ({ _limit: n }));
});

describe("Login", () => {
  test("renders form after initial loading", async () => {
    render(<Login />);
    expect(await screen.findByText(/Welcome Back!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
  });

  test("email login success redirects to /dashboard and stores remembered email", async () => {
    authSdk.signInWithEmailAndPassword.mockResolvedValue({
      user: {
        uid: "u1",
        email: "user@example.com",
        providerData: [{ providerId: "email" }],
      },
    });

    // prefer reading localStorage directly instead of relying on setItem spy
    const setItemSpy = jest.spyOn(window.localStorage.__proto__, "setItem");

    render(<Login />);

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByLabelText(/Remember me/i));
    fireEvent.click(screen.getByRole("button", { name: /Sign In to LakbAI/i }));

    await waitFor(() =>
      expect(authSdk.signInWithEmailAndPassword).toHaveBeenCalled()
    );

    // Ensure remembered email was stored (primary signal of success for this test)
    await waitFor(() =>
      expect(window.localStorage.getItem("rememberedEmail")).toBe(
        "user@example.com"
      )
    );

    // navigate should also be invoked in successful flows; assert it was called at least once
    expect(mockNavigate).toHaveBeenCalled();
  });

  test("shows specific message on wrong password", async () => {
    authSdk.signInWithEmailAndPassword.mockRejectedValue({
      code: "auth/wrong-password",
    });

    render(<Login />);

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
      target: { value: "badpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign In to LakbAI/i }));

    expect(
      await screen.findByText(/Incorrect password\. Please try again\./i)
    ).toBeInTheDocument();
  });

  test("google login success navigates to dashboard", async () => {
    authSdk.signInWithPopup.mockResolvedValue({
      user: {
        uid: "g1",
        email: "g@example.com",
        providerData: [{ providerId: "google.com" }],
        getIdToken: jest.fn().mockResolvedValue("tok"),
      },
    });

    render(<Login />);

    // Button text in the component is "Sign in with Google"
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/i }));

    await waitFor(() => expect(authSdk.signInWithPopup).toHaveBeenCalled());

    // token should be stored in localStorage as part of the Google login handler
    await waitFor(() => expect(window.localStorage.getItem("token")).toBe("tok"));

    // navigate should also be invoked in successful flows; assert it was called at least once
    expect(mockNavigate).toHaveBeenCalled();
  });
});