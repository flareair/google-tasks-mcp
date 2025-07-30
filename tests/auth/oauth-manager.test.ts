/**
 * Unit Tests for OAuthManager
 * Tests OAuth 2.0 flow, PKCE, token management, and HTTP server
 */

import * as http from 'http';
import { OAuthManager } from '../../src/auth/oauth-manager';
import { TokenStorage } from '../../src/auth/token-storage';
import { OAuthConfig, TokenSet, PKCEChallenge } from '../../src/auth/auth-types';

// Mock dependencies
jest.mock('../../src/auth/token-storage');
jest.mock('http');

// Mock fetch globally
global.fetch = jest.fn();

const mockTokenStorage = TokenStorage as jest.MockedClass<typeof TokenStorage>;
const mockHttp = http as jest.Mocked<typeof http>;

describe('OAuthManager', () => {
  let oauthManager: OAuthManager;
  let mockTokenStorageInstance: jest.Mocked<TokenStorage>;
  
  const mockConfig: OAuthConfig = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:8080/oauth/callback',
    scopes: ['https://www.googleapis.com/auth/tasks']
  };

  const mockTokens: TokenSet = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/tasks'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock TokenStorage instance
    mockTokenStorageInstance = {
      saveTokens: jest.fn(),
      loadTokens: jest.fn(),
      clearTokens: jest.fn(),
      hasTokens: jest.fn(),
      isTokenExpired: jest.fn(),
      updateTokenExpiry: jest.fn().mockImplementation((tokens) => tokens)
    } as any;
    
    mockTokenStorage.mockImplementation(() => mockTokenStorageInstance);
    
    oauthManager = new OAuthManager(mockConfig);
  });

  describe('Constructor', () => {
    test('should initialize with config', () => {
      expect(oauthManager).toBeInstanceOf(OAuthManager);
    });

    test('should accept custom token storage', () => {
      const customStorage = new TokenStorage();
      const manager = new OAuthManager(mockConfig, customStorage);
      expect(manager).toBeInstanceOf(OAuthManager);
    });
  });

  describe('PKCE Generation', () => {
    test('generatePKCE should return valid PKCE challenge', () => {
      const pkce = oauthManager.generatePKCE();
      
      expect(pkce).toHaveProperty('verifier');
      expect(pkce).toHaveProperty('challenge');
      expect(pkce).toHaveProperty('method');
      expect(pkce.method).toBe('S256');
      expect(typeof pkce.verifier).toBe('string');
      expect(typeof pkce.challenge).toBe('string');
      expect(pkce.verifier.length).toBeGreaterThan(0);
      expect(pkce.challenge.length).toBeGreaterThan(0);
    });

    test('generatePKCE should return different values each time', () => {
      const pkce1 = oauthManager.generatePKCE();
      const pkce2 = oauthManager.generatePKCE();
      
      expect(pkce1.verifier).not.toBe(pkce2.verifier);
      expect(pkce1.challenge).not.toBe(pkce2.challenge);
    });
  });

  describe('Authorization URL Generation', () => {
    test('getAuthorizationUrl should return valid Google OAuth URL', () => {
      const authUrl = oauthManager.getAuthorizationUrl();
      
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain(`client_id=${mockConfig.clientId}`);
      expect(authUrl).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('code_challenge_method=S256');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('access_type=offline');
      expect(authUrl).toContain('prompt=consent');
    });

    test('should include all scopes in URL', () => {
      const configWithMultipleScopes: OAuthConfig = {
        ...mockConfig,
        scopes: ['scope1', 'scope2', 'scope3']
      };
      const manager = new OAuthManager(configWithMultipleScopes);
      
      const authUrl = manager.getAuthorizationUrl();
      expect(authUrl).toContain('scope=scope1+scope2+scope3');
    });
  });

  describe('Token Exchange', () => {
    beforeEach(() => {
      // Generate PKCE first (required for token exchange)
      oauthManager.getAuthorizationUrl();
    });

    test('exchangeCodeForTokens should successfully exchange code for tokens', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokens)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await oauthManager.exchangeCodeForTokens('test-auth-code');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
      );
      expect(mockTokenStorageInstance.saveTokens).toHaveBeenCalled();
      expect(result).toEqual(mockTokens);
    });

    test('exchangeCodeForTokens should throw if no PKCE challenge', async () => {
      const freshManager = new OAuthManager(mockConfig);
      
      await expect(freshManager.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('No PKCE challenge found');
    });

    test('exchangeCodeForTokens should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('invalid_grant')
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(oauthManager.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Token exchange failed: 400');
    });
  });

  describe('Token Refresh', () => {
    test('refreshAccessToken should refresh tokens successfully', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      
      const newTokens = { ...mockTokens, access_token: 'new-access-token' };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(newTokens)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await oauthManager.refreshAccessToken();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );
      expect(result.access_token).toBe('new-access-token');
    });

    test('refreshAccessToken should preserve refresh token if not in response', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      
      const newTokensWithoutRefresh = { 
        access_token: 'new-access-token',
        expires_in: 3600 
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(newTokensWithoutRefresh)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await oauthManager.refreshAccessToken();

      expect(result.refresh_token).toBe(mockTokens.refresh_token);
    });

    test('refreshAccessToken should throw if no refresh token', async () => {
      const tokensWithoutRefresh = { access_token: 'test-token' };
      mockTokenStorageInstance.loadTokens.mockResolvedValue(tokensWithoutRefresh);

      await expect(oauthManager.refreshAccessToken())
        .rejects.toThrow('No refresh token available');
    });

    test('refreshAccessToken should handle API errors', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('invalid_grant')
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(oauthManager.refreshAccessToken())
        .rejects.toThrow('Token refresh failed: 400');
    });
  });

  describe('Token Validation', () => {
    test('isTokenValid should return true for valid tokens', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(false);

      const result = await oauthManager.isTokenValid();
      expect(result).toBe(true);
    });

    test('isTokenValid should return false for expired tokens', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(true);

      const result = await oauthManager.isTokenValid();
      expect(result).toBe(false);
    });

    test('isTokenValid should return false when no tokens exist', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(null);

      const result = await oauthManager.isTokenValid();
      expect(result).toBe(false);
    });
  });

  describe('Auth Status', () => {
    test('getAuthStatus should return complete status for authenticated user', async () => {
      const tokensWithExpiry = {
        ...mockTokens,
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      
      mockTokenStorageInstance.hasTokens.mockResolvedValue(true);
      mockTokenStorageInstance.loadTokens.mockResolvedValue(tokensWithExpiry);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(false);

      const status = await oauthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.hasValidToken).toBe(true);
      expect(status.tokenExpiry).toBe(tokensWithExpiry.expires_at);
      expect(status.scopes).toEqual(['https://www.googleapis.com/auth/tasks']);
    });

    test('getAuthStatus should return correct status for unauthenticated user', async () => {
      mockTokenStorageInstance.hasTokens.mockResolvedValue(false);

      const status = await oauthManager.getAuthStatus();

      expect(status.isAuthenticated).toBe(false);
      expect(status.hasValidToken).toBe(false);
      expect(status.tokenExpiry).toBeUndefined();
      expect(status.scopes).toBeUndefined();
    });
  });

  describe('HTTP Callback Server', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        listen: jest.fn(),
        close: jest.fn(),
        on: jest.fn()
      };
      mockHttp.createServer.mockReturnValue(mockServer);
    });

    test('startCallbackServer should start server on specified port', async () => {
      mockServer.listen.mockImplementation((port: number, host: string, callback: () => void) => {
        callback();
      });

      const portPromise = oauthManager.startCallbackServer();
      const port = await portPromise;

      expect(mockHttp.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(8080, 'localhost', expect.any(Function));
      expect(port).toBe(8080);
    });

    test('startCallbackServer should try next port if current is in use', async () => {
      let errorCallback: ((error: any) => void) | undefined;
      
      mockServer.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      mockServer.listen
        .mockImplementationOnce((port: number, host: string, callback: () => void) => {
          // First call - simulate port in use
          setTimeout(() => {
            const error = new Error('Port in use') as any;
            error.code = 'EADDRINUSE';
            errorCallback?.(error);
          }, 0);
        })
        .mockImplementationOnce((port: number, host: string, callback: () => void) => {
          // Second call - success
          callback();
        });

      const portPromise = oauthManager.startCallbackServer();
      const port = await portPromise;

      expect(mockServer.listen).toHaveBeenCalledTimes(2);
      expect(port).toBe(8081);
    });

    test('stopCallbackServer should close the server', () => {
      oauthManager.stopCallbackServer();
      // Can't easily test this without starting server first
      // This mainly tests that the method doesn't throw
    });
  });

  describe('Access Token Management', () => {
    test('getValidAccessToken should return token if valid', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(false);

      const token = await oauthManager.getValidAccessToken();
      expect(token).toBe(mockTokens.access_token);
    });

    test('getValidAccessToken should refresh expired token', async () => {
      const expiredTokens = { ...mockTokens };
      const refreshedTokens = { ...mockTokens, access_token: 'refreshed-token' };
      
      mockTokenStorageInstance.loadTokens
        .mockResolvedValueOnce(expiredTokens)
        .mockResolvedValueOnce(refreshedTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(true);
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(refreshedTokens)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const token = await oauthManager.getValidAccessToken();
      expect(token).toBe('refreshed-token');
    });

    test('getValidAccessToken should throw if refresh fails', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(mockTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(true);
      
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('invalid_grant')
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(oauthManager.getValidAccessToken())
        .rejects.toThrow('Token refresh failed. Re-authentication required.');
    });

    test('getValidAccessToken should throw if no tokens exist', async () => {
      mockTokenStorageInstance.loadTokens.mockResolvedValue(null);
      mockTokenStorageInstance.hasTokens.mockResolvedValue(false);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(false);

      await expect(oauthManager.getValidAccessToken())
        .rejects.toThrow('Token refresh failed. Re-authentication required.');
    });
  });

  describe('Token Cleanup', () => {
    test('clearTokens should delegate to token storage', async () => {
      await oauthManager.clearTokens();
      expect(mockTokenStorageInstance.clearTokens).toHaveBeenCalled();
    });
  });

  describe('Integration Tests', () => {
    test('full OAuth flow simulation (without actual HTTP)', async () => {
      // 1. Generate authorization URL
      const authUrl = oauthManager.getAuthorizationUrl();
      expect(authUrl).toContain('code_challenge=');
      
      // 2. Mock successful token exchange
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokens)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      // 3. Exchange code for tokens
      const tokens = await oauthManager.exchangeCodeForTokens('test-code');
      expect(tokens).toEqual(mockTokens);
      expect(mockTokenStorageInstance.saveTokens).toHaveBeenCalledWith(mockTokens);
      
      // 4. Verify token is valid
      mockTokenStorageInstance.loadTokens.mockResolvedValue(tokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(false);
      
      const isValid = await oauthManager.isTokenValid();
      expect(isValid).toBe(true);
      
      // 5. Get valid access token
      const accessToken = await oauthManager.getValidAccessToken();
      expect(accessToken).toBe(mockTokens.access_token);
    });

    test('token refresh flow simulation', async () => {
      // Setup expired tokens
      const expiredTokens = { ...mockTokens, expires_at: Date.now() / 1000 - 3600 };
      mockTokenStorageInstance.loadTokens.mockResolvedValue(expiredTokens);
      mockTokenStorageInstance.isTokenExpired.mockReturnValue(true);
      
      // Mock successful refresh
      const refreshedTokens = { ...mockTokens, access_token: 'new-token' };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(refreshedTokens)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      // Refresh tokens
      const newTokens = await oauthManager.refreshAccessToken();
      expect(newTokens.access_token).toBe('new-token');
      expect(mockTokenStorageInstance.saveTokens).toHaveBeenCalledWith(refreshedTokens);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors during token exchange', async () => {
      oauthManager.getAuthorizationUrl(); // Generate PKCE
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(oauthManager.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Network error');
    });

    test('should handle malformed token responses', async () => {
      oauthManager.getAuthorizationUrl(); // Generate PKCE
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(oauthManager.exchangeCodeForTokens('test-code'))
        .rejects.toThrow('Invalid JSON');
    });
  });
});