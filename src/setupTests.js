// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

let errorSpy;
let logSpy;

beforeAll(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).startsWith("Email login error")) return; // suppress specific
    if (String(args[0]).startsWith("Warning: An update to")) return; // suppress act warnings
    console.warn(...args); // still show other errors as warnings
  });
  logSpy = jest.spyOn(console, "log").mockImplementation((...args) => {
    if (String(args[0]).startsWith("User data saved successfully")) return;
    console.info(...args); // still show other logs as info
  });
});

afterAll(() => {
  if (errorSpy) errorSpy.mockRestore();
  if (logSpy) logSpy.mockRestore();
});

