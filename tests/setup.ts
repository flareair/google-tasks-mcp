/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

// Extend Jest matchers if needed
// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to avoid noise
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up between tests
afterEach(() => {
  jest.clearAllMocks();
});