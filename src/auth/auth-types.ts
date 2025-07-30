/**
 * Authentication Type Definitions
 * TypeScript interfaces for OAuth and authentication
 */

export interface TokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  expires_at?: number; // Unix timestamp
}

export interface PKCEChallenge {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface AuthStatus {
  isAuthenticated: boolean;
  hasValidToken: boolean;
  tokenExpiry?: number | undefined;
  scopes?: string[] | undefined;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
}

export interface OAuthCallbackResult {
  code: string;
  state?: string;
  error?: string;
  error_description?: string;
}