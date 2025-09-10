import '@testing-library/jest-dom';
/* Silence noisy logs from Firebase mocks etc. Adjust as needed */
const originalError = console.error;
console.error = (...args) => {
    if (/Warning:.*not wrapped in act/.test(args[0] || '')) return;
    originalError(...args);
};