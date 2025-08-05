/**
 * Tests for GoogleApiErrorHandler
 * Comprehensive error handling testing
 */

import { GoogleApiErrorHandler } from '../../src/google/error-handler';
import { GoogleApiError } from '../../src/google/api-types';

describe('GoogleApiErrorHandler', () => {
  describe('isRetryableError', () => {
    it('should identify retryable server errors', () => {
      const error = { response: { status: 500 } };
      expect(GoogleApiErrorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify retryable rate limit errors', () => {
      const error429 = { response: { status: 429 } };
      const error403 = { response: { status: 403 } };
      
      expect(GoogleApiErrorHandler.isRetryableError(error429)).toBe(true);
      expect(GoogleApiErrorHandler.isRetryableError(error403)).toBe(true);
    });

    it('should identify retryable timeout errors', () => {
      const error = { response: { status: 408 } };
      expect(GoogleApiErrorHandler.isRetryableError(error)).toBe(true);
    });

    it('should identify retryable conflict errors', () => {
      const error = { response: { status: 409 } };
      expect(GoogleApiErrorHandler.isRetryableError(error)).toBe(true);
    });

    it('should not retry client errors', () => {
      const error400 = { response: { status: 400 } };
      const error404 = { response: { status: 404 } };
      
      expect(GoogleApiErrorHandler.isRetryableError(error400)).toBe(false);
      expect(GoogleApiErrorHandler.isRetryableError(error404)).toBe(false);
    });

    it('should not retry when no response status', () => {
      const error = { message: 'Network error' };
      expect(GoogleApiErrorHandler.isRetryableError(error)).toBe(false);
    });
  });

  describe('isTokenError', () => {
    it('should identify token errors', () => {
      const error401 = { response: { status: 401 } };
      const error403 = { response: { status: 403 } };
      
      expect(GoogleApiErrorHandler.isTokenError(error401)).toBe(true);
      expect(GoogleApiErrorHandler.isTokenError(error403)).toBe(true);
    });

    it('should not identify non-token errors', () => {
      const error400 = { response: { status: 400 } };
      const error500 = { response: { status: 500 } };
      
      expect(GoogleApiErrorHandler.isTokenError(error400)).toBe(false);
      expect(GoogleApiErrorHandler.isTokenError(error500)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should return exponential backoff delays', () => {
      expect(GoogleApiErrorHandler.getRetryDelay(0)).toBe(1000);
      expect(GoogleApiErrorHandler.getRetryDelay(1)).toBe(2000);
      expect(GoogleApiErrorHandler.getRetryDelay(2)).toBe(4000);
      expect(GoogleApiErrorHandler.getRetryDelay(3)).toBe(8000);
      expect(GoogleApiErrorHandler.getRetryDelay(4)).toBe(16000);
    });

    it('should cap at maximum delay', () => {
      expect(GoogleApiErrorHandler.getRetryDelay(10)).toBe(16000);
    });
  });

  describe('parseGoogleApiError', () => {
    it('should parse Google API error response', () => {
      const error = {
        response: {
          data: {
            error: {
              code: 404,
              message: 'Task not found',
              status: 'NOT_FOUND'
            }
          }
        }
      };

      const parsed = GoogleApiErrorHandler.parseGoogleApiError(error);
      expect(parsed.error.code).toBe(404);
      expect(parsed.error.message).toBe('Task not found');
      expect(parsed.error.status).toBe('NOT_FOUND');
    });

    it('should create error from generic error', () => {
      const error = {
        response: { status: 500 },
        message: 'Internal server error'
      };

      const parsed = GoogleApiErrorHandler.parseGoogleApiError(error);
      expect(parsed.error.code).toBe(500);
      expect(parsed.error.message).toBe('Internal server error');
      expect(parsed.error.status).toBe('INTERNAL');
    });

    it('should handle errors without response', () => {
      const error = { message: 'Network error' };

      const parsed = GoogleApiErrorHandler.parseGoogleApiError(error);
      expect(parsed.error.code).toBe(500);
      expect(parsed.error.message).toBe('Network error');
      expect(parsed.error.status).toBe('INTERNAL');
    });
  });

  describe('createUserFriendlyMessage', () => {
    it('should create friendly message for 400 error', () => {
      const error: GoogleApiError = {
        error: {
          code: 400,
          message: 'Invalid task title',
          status: 'INVALID_ARGUMENT'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('Invalid request: Invalid task title');
    });

    it('should create friendly message for 401 error', () => {
      const error: GoogleApiError = {
        error: {
          code: 401,
          message: 'Unauthorized',
          status: 'UNAUTHENTICATED'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('Authentication failed. Please re-authenticate.');
    });

    it('should create friendly message for rate limit error', () => {
      const error: GoogleApiError = {
        error: {
          code: 403,
          message: 'Rate limit exceeded for requests',
          status: 'PERMISSION_DENIED'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should create friendly message for permission error', () => {
      const error: GoogleApiError = {
        error: {
          code: 403,
          message: 'Insufficient permissions',
          status: 'PERMISSION_DENIED'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('Access denied. Check your permissions.');
    });

    it('should create friendly message for 404 error', () => {
      const error: GoogleApiError = {
        error: {
          code: 404,
          message: 'Task not found',
          status: 'NOT_FOUND'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('The requested resource was not found.');
    });

    it('should create friendly message for server errors', () => {
      const error: GoogleApiError = {
        error: {
          code: 500,
          message: 'Internal server error',
          status: 'INTERNAL'
        }
      };

      const message = GoogleApiErrorHandler.createUserFriendlyMessage(error);
      expect(message).toBe('Google API is temporarily unavailable. Please try again.');
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await GoogleApiErrorHandler.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue({ response: { status: 400 } });

      await expect(GoogleApiErrorHandler.executeWithRetry(operation)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should include context in error message', async () => {
      const operation = jest.fn().mockRejectedValue({ response: { status: 404 } });

      await expect(
        GoogleApiErrorHandler.executeWithRetry(operation, 'fetching task')
      ).rejects.toThrow('during fetching task');
    });
  });

  describe('createRateLimiter', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not delay first request', async () => {
      const rateLimiter = GoogleApiErrorHandler.createRateLimiter();

      const start = Date.now();
      await rateLimiter();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should delay subsequent requests', async () => {
      const rateLimiter = GoogleApiErrorHandler.createRateLimiter();

      await rateLimiter();
      
      const promise = rateLimiter();
      jest.advanceTimersByTime(100);
      await promise;

      expect(jest.getTimerCount()).toBe(0);
    });

    it('should not delay if enough time has passed', async () => {
      const rateLimiter = GoogleApiErrorHandler.createRateLimiter();

      await rateLimiter();
      
      jest.advanceTimersByTime(200);
      
      const start = Date.now();
      await rateLimiter();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });
  });
});