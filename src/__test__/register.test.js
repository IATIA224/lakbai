import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Register from "../register";

// Router: mock navigate but keep the rest real
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock modules imported by Register
jest.mock("../header_2", () => () => <div data-testid="header2" />);
jest.mock("../privacy_policy", () => () => (
  <div data-testid="privacy" style={{ display: "none" }} />
));
jest.mock("../firebase", () => ({ auth: {}, db: {} }));

// Mock EmailJS
const mockEmailjsSend = jest.fn().mockResolvedValue({});
jest.mock("@emailjs/browser", () => ({
  send: (...args) => mockEmailjsSend(...args),
}));

// Mock Firebase Auth APIs used in register.js
const mockCreateUser = jest.fn();
const mockSendVerification = jest.fn().mockResolvedValue();
const mockFetchMethods = jest.fn();

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: (...args) => mockCreateUser(...args),
  sendEmailVerification: (...args) => mockSendVerification(...args),
  fetchSignInMethodsForEmail: (...args) => mockFetchMethods(...args),
}));

// Mock Firestore APIs used in register.js
const mockDoc = jest.fn((db, col, id) => ({ __ref: `${col}/${id}` }));
const mockSetDoc = jest.fn(async () => Promise.resolve());
jest.mock("firebase/firestore", () => ({
  doc: (...args) => mockDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

// Helpers
const fillForm = () => {
  fireEvent.change(screen.getByLabelText(/First Name/i), {
    target: { value: "Juan" },
  });
  fireEvent.change(screen.getByLabelText(/Last Name/i), {
    target: { value: "Dela Cruz" },
  });
  fireEvent.change(screen.getByLabelText(/Email Address/i), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/^Password$/i), {
    target: { value: "Str0ng!Pwd" },
  });
  fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
    target: { value: "Str0ng!Pwd" },
  });
  fireEvent.click(screen.getByRole("checkbox")); // Terms
};

const getOtpInputs = () =>
  screen.getAllByRole("textbox").filter((input) =>
    input.classList.contains("otp-input")
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Date, "now").mockImplementation(() => 1000000000000);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Register", () => {
  test("submit button is disabled until Terms are accepted", async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Register />
      </MemoryRouter>
    );

    const submit = screen.getByRole("button", {
      name: /Create LakbAI Account/i,
    });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();

    expect(screen.queryByTestId("register-popup")).toBeNull();
  });

  test("submitting valid details sends OTP and shows OTP step", async () => {
    mockFetchMethods.mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Register />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Create LakbAI Account/i })
    );

    await waitFor(() => expect(mockEmailjsSend).toHaveBeenCalled());

    expect(await screen.findByText(/Verify Your Email/i)).toBeInTheDocument();

    const [, , params] = mockEmailjsSend.mock.calls[0];
    expect(params.email).toBe("user@example.com");
    expect(params.passcode).toHaveLength(6);

    expect(getOtpInputs().length).toBe(6);
  });

  test("wrong OTP shows inline error", async () => {
    mockFetchMethods.mockResolvedValue([]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Register />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Create LakbAI Account/i })
    );
    await waitFor(() => expect(mockEmailjsSend).toHaveBeenCalled());
    expect(await screen.findByText(/Verify Your Email/i)).toBeInTheDocument();

    const inputs = getOtpInputs();
    "000000".split("").forEach((c, i) =>
      fireEvent.change(inputs[i], { target: { value: c } })
    );

    fireEvent.click(screen.getByRole("button", { name: /Verify/i }));

    const errorNode = await screen.findByText((content) =>
      /incorrect|invalid|wrong|expired/i.test(content)
    );
    expect(errorNode).toBeInTheDocument();
  });

  test("correct OTP creates account, sends verification, and can navigate to login", async () => {
    mockFetchMethods.mockResolvedValue([]);
    const fakeUser = { uid: "u1", email: "user@example.com" };
    mockCreateUser.mockResolvedValue({ user: fakeUser });
    mockSetDoc.mockResolvedValue();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Register />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Create LakbAI Account/i })
    );
    await waitFor(() => expect(mockEmailjsSend).toHaveBeenCalled());
    expect(await screen.findByText(/Verify Your Email/i)).toBeInTheDocument();

    // ✅ act only needed for timers
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const [, , params] = mockEmailjsSend.mock.calls[0];
    const code = params.passcode;

    // Fill OTP inputs
    const inputs = getOtpInputs();
    code.split("").forEach((c, i) =>
      fireEvent.change(inputs[i], { target: { value: c } })
    );

    // Click verify
    const verifyBtn = await screen.findByRole("button", { name: /verify/i });
    fireEvent.click(verifyBtn);

    // Wait for async calls
    await waitFor(() => expect(mockCreateUser).toHaveBeenCalled());
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockSendVerification).toHaveBeenCalledWith(fakeUser)
    );

    expect(
      await screen.findByText(/Account created! Verification email sent/i)
    ).toBeInTheDocument();

    const closeBtn = screen.queryByRole("button", { name: /go to login|close|ok|continue/i });
  if (closeBtn) {
    fireEvent.click(closeBtn);
  }

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledTimes(closeBtn ? 1 : 0);
  });

  if (closeBtn) {
    fireEvent.click(closeBtn);
  }
  expect(mockNavigate).toHaveBeenCalledWith("/");
});

});