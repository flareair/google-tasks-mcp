/**
 * API Error Handler
 * Comprehensive error handling for Google API calls
 */

import { GoogleApiError } from './api-types';

export class GoogleApiErrorHandler {
  private static readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];
  private static readonly MAX_RETRIES = 5;
  private static readonly RATE_LIMIT_CODES = [429, 403];
  private static readonly TOKEN_ERROR_CODES = [401, 403];

  static isRetryableError(error: any): boolean {
    if (!error.response?.status) return false;
    
    const status = error.response.status;
    return (
      status >= 500 ||
      this.RATE_LIMIT_CODES.includes(status) ||
      status === 408 ||
      status === 409
    );
  }

  static isTokenError(error: any): boolean {
    if (!error.response?.status) return false;
    return this.TOKEN_ERROR_CODES.includes(error.response.status);
  }

  static getRetryDelay(attempt: number): number {
    if (attempt >= this.RETRY_DELAYS.length) {
      return this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1] ?? 16000;
    }
    return this.RETRY_DELAYS[attempt] ?? 1000;
  }

  static parseGoogleApiError(error: any): GoogleApiError {
    if (error.response?.data?.error) {
      return error.response.data as GoogleApiError;
    }

    const status = error.response?.status || 500;
    const message = error.message || 'Unknown error occurred';
    
    return {
      error: {
        code: status,
        message,
        status: this.getStatusText(status),
        details: []
      }
    };
  }

  static createUserFriendlyMessage(error: GoogleApiError): string {
    const { code, message, status } = error.error;

    switch (code) {
      case 400:
        return `Invalid request: ${message}`;
      case 401:
        return 'Authentication failed. Please re-authenticate.';
      case 403:
        if (message.toLowerCase().includes('rate')) {
          return 'Rate limit exceeded. Please try again later.';
        }
        return 'Access denied. Check your permissions.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'Conflict: The resource has been modified by another request.';
      case 429:
        return 'Too many requests. Please wait and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Google API is temporarily unavailable. Please try again.';
      default:
        return `API error (${code}): ${message}`;
    }
  }

  private static getStatusText(code: number): string {
    const statusTexts: Record<number, string> = {
      400: 'INVALID_ARGUMENT',
      401: 'UNAUTHENTICATED',
      403: 'PERMISSION_DENIED',
      404: 'NOT_FOUND',
      408: 'DEADLINE_EXCEEDED',
      409: 'ABORTED',
      429: 'RESOURCE_EXHAUSTED',
      500: 'INTERNAL',
      502: 'UNAVAILABLE',
      503: 'UNAVAILABLE',
      504: 'DEADLINE_EXCEEDED'
    };
    return statusTexts[code] || 'UNKNOWN';
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error)) {
          const googleError = this.parseGoogleApiError(error);
          const contextMessage = context ? ` during ${context}` : '';
          throw new Error(
            `${this.createUserFriendlyMessage(googleError)}${contextMessage}`
          );
        }

        if (attempt === this.MAX_RETRIES - 1) {
          break;
        }

        const delay = this.getRetryDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const googleError = this.parseGoogleApiError(lastError);
    const contextMessage = context ? ` during ${context}` : '';
    throw new Error(
      `${this.createUserFriendlyMessage(googleError)}${contextMessage}`
    );
  }

  static createRateLimiter() {
    let lastRequestTime = 0;
    const MIN_INTERVAL = 100;

    return async (): Promise<void> => {
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      
      if (timeSinceLastRequest < MIN_INTERVAL) {
        const delay = MIN_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      lastRequestTime = Date.now();
    };
  }
}