/**
 * OAuth 2.0 Manager with PKCE
 * Handles Google OAuth flow for secure authentication
 */

import * as http from 'http';
import * as url from 'url';
import { TokenSet, PKCEChallenge, OAuthConfig, AuthStatus, OAuthCallbackResult } from './auth-types';
import { TokenStorage } from './token-storage';
import { CryptoManager } from '../utils/crypto';

export class OAuthManager {
  private readonly config: OAuthConfig;
  private readonly tokenStorage: TokenStorage;
  private currentPKCE: PKCEChallenge | null = null;
  private callbackServer: http.Server | null = null;
  private callbackPort: number = 8080;

  constructor(config: OAuthConfig, tokenStorage?: TokenStorage) {
    this.config = config;
    this.tokenStorage = tokenStorage || new TokenStorage();
  }

  /**
   * Generate PKCE challenge and verifier
   */
  generatePKCE(): PKCEChallenge {
    const verifier = CryptoManager.generateRandomString(128);
    const challenge = CryptoManager.generateSHA256Hash(verifier);
    
    return {
      verifier,
      challenge,
      method: 'S256'
    };
  }

  /**
   * Create OAuth authorization URL with PKCE
   */
  getAuthorizationUrl(): string {
    this.currentPKCE = this.generatePKCE();
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      code_challenge: this.currentPKCE.challenge,
      code_challenge_method: this.currentPKCE.method,
      access_type: 'offline',
      prompt: 'consent',
      state: CryptoManager.generateRandomString(32)
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    if (!this.currentPKCE) {
      throw new Error('No PKCE challenge found. Must call getAuthorizationUrl() first.');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      code,
      code_verifier: this.currentPKCE.verifier,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    const tokens = await response.json() as TokenSet;
    
    // Add expiration timestamp
    const tokensWithExpiry = this.tokenStorage.updateTokenExpiry(tokens);
    
    // Save tokens securely
    await this.tokenStorage.saveTokens(tokensWithExpiry);
    
    // Clear PKCE data
    this.currentPKCE = null;
    
    return tokensWithExpiry;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TokenSet> {
    const existingTokens = await this.tokenStorage.loadTokens();
    
    if (!existingTokens?.refresh_token) {
      throw new Error('No refresh token available. Re-authentication required.');
    }

    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: existingTokens.refresh_token,
      grant_type: 'refresh_token'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    const newTokens = await response.json() as TokenSet;
    
    // Preserve refresh token if not provided in response
    if (!newTokens.refresh_token && existingTokens.refresh_token) {
      newTokens.refresh_token = existingTokens.refresh_token;
    }
    
    // Add expiration timestamp
    const tokensWithExpiry = this.tokenStorage.updateTokenExpiry(newTokens);
    
    // Save updated tokens
    await this.tokenStorage.saveTokens(tokensWithExpiry);
    
    return tokensWithExpiry;
  }

  /**
   * Check if tokens are valid/expired
   */
  async isTokenValid(): Promise<boolean> {
    const tokens = await this.tokenStorage.loadTokens();
    
    if (!tokens) {
      return false;
    }
    
    return !this.tokenStorage.isTokenExpired(tokens);
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<AuthStatus> {
    const hasTokens = await this.tokenStorage.hasTokens();
    const isValid = hasTokens ? await this.isTokenValid() : false;
    
    let tokenExpiry: number | undefined;
    let scopes: string[] | undefined;
    
    if (hasTokens) {
      const tokens = await this.tokenStorage.loadTokens();
      tokenExpiry = tokens?.expires_at;
      scopes = tokens?.scope?.split(' ');
    }

    return {
      isAuthenticated: hasTokens,
      hasValidToken: isValid,
      tokenExpiry,
      scopes
    };
  }

  /**
   * Start local HTTP server for OAuth callback
   */
  async startCallbackServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer();
      
      this.callbackServer.listen(this.callbackPort, 'localhost', () => {
        resolve(this.callbackPort);
      });
      
      this.callbackServer.on('error', (error) => {
        if ((error as any).code === 'EADDRINUSE') {
          this.callbackPort++;
          this.callbackServer?.listen(this.callbackPort, 'localhost', () => {
            resolve(this.callbackPort);
          });
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Wait for OAuth callback
   */
  async waitForCallback(): Promise<string> {
    if (!this.callbackServer) {
      throw new Error('Callback server not started');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth callback timeout'));
      }, 300000); // 5 minute timeout

      this.callbackServer!.on('request', (req, res) => {
        const parsedUrl = url.parse(req.url || '', true);
        
        if (parsedUrl.pathname === '/oauth/callback') {
          const { code, error, error_description } = parsedUrl.query;
          
          // Send response to browser
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Error</h1><p>${error}: ${error_description}</p>`);
            clearTimeout(timeout);
            reject(new Error(`OAuth error: ${error} - ${error_description}`));
          } else if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Successful</h1><p>You can close this window and return to the application.</p>');
            clearTimeout(timeout);
            resolve(code as string);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Error</h1><p>No authorization code received.</p>');
            clearTimeout(timeout);
            reject(new Error('No authorization code received'));
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });
    });
  }

  /**
   * Stop callback server
   */
  stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  /**
   * Complete OAuth flow with callback handling
   */
  async completeOAuthFlow(): Promise<TokenSet> {
    try {
      // Start callback server
      const port = await this.startCallbackServer();
      
      // Update redirect URI with actual port
      this.config.redirectUri = `http://localhost:${port}/oauth/callback`;
      
      // Get authorization URL
      const authUrl = this.getAuthorizationUrl();
      
      console.log('\nTo authenticate with Google Tasks:');
      console.log(`1. Open this URL in your browser: ${authUrl}`);
      console.log('2. Complete the authorization process');
      console.log('3. The application will automatically receive the authorization code\n');
      
      // Wait for callback
      const authCode = await this.waitForCallback();
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(authCode);
      
      return tokens;
    } finally {
      this.stopCallbackServer();
    }
  }

  /**
   * Clear stored tokens (logout)
   */
  async clearTokens(): Promise<void> {
    await this.tokenStorage.clearTokens();
  }

  /**
   * Get valid access token (with auto-refresh)
   */
  async getValidAccessToken(): Promise<string> {
    const isValid = await this.isTokenValid();
    
    if (!isValid) {
      try {
        const refreshedTokens = await this.refreshAccessToken();
        return refreshedTokens.access_token;
      } catch (error) {
        throw new Error('Token refresh failed. Re-authentication required.');
      }
    }
    
    const tokens = await this.tokenStorage.loadTokens();
    if (!tokens) {
      throw new Error('No tokens available. Authentication required.');
    }
    
    return tokens.access_token;
  }

  /**
   * Get valid tokens (with auto-refresh)
   */
  async getValidTokens(): Promise<TokenSet | null> {
    const isValid = await this.isTokenValid();
    
    if (!isValid) {
      try {
        return await this.refreshAccessToken();
      } catch (error) {
        return null;
      }
    }
    
    return await this.tokenStorage.loadTokens();
  }

  /**
   * Get client ID
   */
  getClientId(): string {
    return this.config.clientId;
  }

  /**
   * Get redirect URI
   */
  getRedirectUri(): string {
    return this.config.redirectUri;
  }
}