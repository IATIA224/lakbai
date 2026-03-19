import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Register from '../register';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseDb from 'firebase/firestore';
import emailjs from '@emailjs/browser';

// Mock dependencies
jest.mock('firebase/auth');
jest.mock('firebase/firestore');
jest.mock('@emailjs/browser');
jest.mock('../privacy_policy', () => () => <div>Privacy Policy</div>);
jest.mock('../terms', () => () => <div>Terms of Service</div>);
jest.mock('../header_2', () => () => <div>Header</div>);
jest.mock('../EditProfile-new-acc', () => ({ onClose }) => (
  <div data-testid="edit-profile-modal">Edit Profile</div>
));

const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
};

describe('Register Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailjs.send.mockResolvedValue({ status: 200 });
    firebaseAuth.fetchSignInMethodsForEmail.mockResolvedValue([]);
  });

  // ============ Form Validation Tests ============
  describe('Form Validation', () => {
    test('should render registration form initially', () => {
      renderRegister();
      expect(screen.getByPlaceholderText('Juan')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    });

    test('should show error if email is invalid', async () => {
      renderRegister();
      const agreedCheckbox = screen.getByRole('checkbox');
      fireEvent.click(agreedCheckbox);

      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email/i)).toBeInTheDocument();
      });
    });

    test('should show error if password is less than 8 characters', async () => {
      renderRegister();
      const agreedCheckbox = screen.getByRole('checkbox');
      fireEvent.click(agreedCheckbox);

      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'short');

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 8 characters long/i)).toBeInTheDocument();
      });
    });

    test('should show error if passwords do not match', async () => {
      renderRegister();
      const agreedCheckbox = screen.getByRole('checkbox');
      fireEvent.click(agreedCheckbox);

      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'DifferentPassword123!');

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
      });
    });

    test('should show error if first or last name is empty', async () => {
      renderRegister();
      const agreedCheckbox = screen.getByRole('checkbox');
      fireEvent.click(agreedCheckbox);

      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Please enter your first and last name/i)).toBeInTheDocument();
      });
    });
  });

  // ============ Password Strength Tests ============
  describe('Password Strength', () => {
    test('should show weak password for short passwords', async () => {
      renderRegister();
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      await userEvent.type(passwordInput, '12345');

      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });
    });

    test('should show medium password strength', async () => {
      renderRegister();
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      await userEvent.type(passwordInput, 'Password123');

      await waitFor(() => {
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });
    });

    test('should show strong password strength', async () => {
      renderRegister();
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      await userEvent.type(passwordInput, 'Password123!@#');

      await waitFor(() => {
        expect(screen.getByText('Strong')).toBeInTheDocument();
      });
    });
  });

  // ============ OTP Flow Tests ============
  describe('OTP Flow', () => {
    test('should send OTP and transition to OTP step', async () => {
      renderRegister();
      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');
      const agreedCheckbox = screen.getByRole('checkbox');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');
      fireEvent.click(agreedCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify Your Email/i)).toBeInTheDocument();
        expect(emailjs.send).toHaveBeenCalled();
      });
    });

    test('should handle OTP input correctly', async () => {
      renderRegister();
      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');
      const agreedCheckbox = screen.getByRole('checkbox');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');
      fireEvent.click(agreedCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify Your Email/i)).toBeInTheDocument();
      });

      const otpInputs = screen.getAllByPlaceholderText('●');
      expect(otpInputs.length).toBe(6);
    });

    test('should show error if OTP is incomplete', async () => {
      renderRegister();
      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');
      const agreedCheckbox = screen.getByRole('checkbox');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');
      fireEvent.click(agreedCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify Your Email/i)).toBeInTheDocument();
      });

      const verifyBtn = screen.getByRole('button', { name: /Verify & Create Account/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Enter all 6 digits/i)).toBeInTheDocument();
      });
    });
  });

  // ============ Modal Tests ============
  describe('Modal Handling', () => {
    test('should open Terms of Service modal', async () => {
      renderRegister();
      // Use getByRole to target the link specifically
      const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
      fireEvent.click(termsLink);

      await waitFor(() => {
        expect(screen.getAllByText('Terms of Service').length).toBeGreaterThan(0);
      });
    });

    test('should open Privacy Policy modal', async () => {
      renderRegister();
      // Use getByRole to target the link specifically
      const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
      fireEvent.click(privacyLink);

      await waitFor(() => {
        expect(screen.getAllByText('Privacy Policy').length).toBeGreaterThan(0);
      });
    });
  });

  // ============ Password Visibility Tests ============
  describe('Password Visibility Toggle', () => {
    test('should toggle password visibility', async () => {
      renderRegister();
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find the eye icon button for the password field (first one)
      const eyeButtons = screen.getAllByRole('button', { name: /Show password/i });
      fireEvent.click(eyeButtons[0]);

      await waitFor(() => {
        expect(passwordInput).toHaveAttribute('type', 'text');
      });

      // Toggle back
      fireEvent.click(eyeButtons[0]);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should toggle confirm password visibility', async () => {
      renderRegister();
      const confirmInput = screen.getByPlaceholderText('Confirm your password');
      expect(confirmInput).toHaveAttribute('type', 'password');

      const eyeButtons = screen.getAllByRole('button', { name: /Show password/i });
      fireEvent.click(eyeButtons[1]);

      await waitFor(() => {
        expect(confirmInput).toHaveAttribute('type', 'text');
      });
    });
  });

  // ============ Input Constraints Tests ============
  describe('Input Constraints', () => {
    test('should enforce max length on name inputs', async () => {
      renderRegister();
      const firstNameInput = screen.getByPlaceholderText('Juan');

      await userEvent.type(firstNameInput, 'a'.repeat(50));

      expect(firstNameInput.value.length).toBeLessThanOrEqual(30);
    });

    test('should enforce max length on email input', async () => {
      renderRegister();
      const emailInput = screen.getByPlaceholderText('your@email.com');

      await userEvent.type(emailInput, 'a'.repeat(60) + '@test.com');

      expect(emailInput.value.length).toBeLessThanOrEqual(50);
    });

    test('should enforce max length on password input', async () => {
      renderRegister();
      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      await userEvent.type(passwordInput, 'a'.repeat(50));

      expect(passwordInput.value.length).toBeLessThanOrEqual(30);
    });
  });

  // ============ Email Already Registered Tests ============
  describe('Email Already Registered', () => {
    test('should show error if email already exists', async () => {
      firebaseAuth.fetchSignInMethodsForEmail.mockResolvedValue(['password']);

      renderRegister();
      const firstNameInput = screen.getByPlaceholderText('Juan');
      const lastNameInput = screen.getByPlaceholderText('Dela Cruz');
      const emailInput = screen.getByPlaceholderText('your@email.com');
      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmInput = screen.getByPlaceholderText('Confirm your password');
      const agreedCheckbox = screen.getByRole('checkbox');

      await userEvent.type(firstNameInput, 'Juan');
      await userEvent.type(lastNameInput, 'Dela Cruz');
      await userEvent.type(emailInput, 'existing@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.type(confirmInput, 'Password123!');
      fireEvent.click(agreedCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/This email is already registered/i)).toBeInTheDocument();
      });
    });
  });

  // ============ Submit Button State Tests ============
  describe('Submit Button State', () => {
    test('should disable submit button when terms not agreed', () => {
      renderRegister();
      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      expect(submitBtn).toBeDisabled();
    });

    test('should enable submit button when terms are agreed', async () => {
      renderRegister();
      const agreedCheckbox = screen.getByRole('checkbox');
      fireEvent.click(agreedCheckbox);

      const submitBtn = screen.getByRole('button', { name: /Create LakbAI Account/i });
      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });
    });
  });
});