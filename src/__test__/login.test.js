import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock router navigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock firebase exports used inside component
jest.mock("../firebase", () => ({
  auth: {},
  db: {},
}));

// Firestore mocks
const mockDoc = jest.fn((db, col, id) => ({ __ref: `${col}/${id}` }));
const mockSetDoc = jest.fn(async () => {});
const mockGetDoc = jest.fn(async () => ({
  exists: () => false,
  data: () => ({}),
}));
jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
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
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard")
    );

    expect(setItemSpy).toHaveBeenCalledWith(
      "rememberedEmail",
      "user@example.com"
    );
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
      },
    });

    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: /Google/i }));

    await waitFor(() => expect(authSdk.signInWithPopup).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });
});