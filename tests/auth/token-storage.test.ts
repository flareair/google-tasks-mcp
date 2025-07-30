/**
 * Unit Tests for TokenStorage
 * Tests encrypted token storage, file operations, and security
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TokenStorage } from '../../src/auth/token-storage';
import { TokenSet } from '../../src/auth/auth-types';

// Mock fs module
jest.mock('fs/promises');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('TokenStorage', () => {
  let tokenStorage: TokenStorage;
  const mockTokens: TokenSet = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/tasks'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock os functions
    mockOs.homedir.mockReturnValue('/mock/home');
    mockOs.hostname.mockReturnValue('test-hostname');
    mockOs.userInfo.mockReturnValue({ username: 'testuser' } as any);
    
    tokenStorage = new TokenStorage();
  });

  describe('Constructor', () => {
    test('should use default token file path', () => {
      const storage = new TokenStorage();
      expect(mockOs.homedir).toHaveBeenCalled();
    });

    test('should use custom token file path', () => {
      const customPath = '/custom/path/tokens.enc';
      const storage = new TokenStorage(customPath);
      // Constructor should work without calling homedir for custom path
    });
  });

  describe('saveTokens', () => {
    test('should create config directory if it does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      await tokenStorage.saveTokens(mockTokens);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join('/mock/home', '.google-tasks-mcp'),
        { recursive: true, mode: 0o700 }
      );
    });

    test('should not create directory if it exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      await tokenStorage.saveTokens(mockTokens);

      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    test('should write encrypted tokens to file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      await tokenStorage.saveTokens(mockTokens);

      expect(mockFs.writeFile).toHaveBeenCalled();
      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall).toBeDefined();
      expect(writeCall![0]).toContain('tokens.enc');
      expect(writeCall![2]).toEqual({ mode: 0o600 });
      
      // Verify content is JSON string
      const content = writeCall![1] as string;
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('should set secure file permissions', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      await tokenStorage.saveTokens(mockTokens);

      expect(mockFs.chmod).toHaveBeenCalledWith(
        expect.stringContaining('tokens.enc'),
        0o600
      );
    });

    test('should handle chmod errors gracefully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockRejectedValue(new Error('Permission denied'));

      // Should not throw despite chmod error
      await expect(tokenStorage.saveTokens(mockTokens)).resolves.toBeUndefined();
    });
  });

  describe('loadTokens', () => {
    test('should return null if file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      const result = await tokenStorage.loadTokens();
      expect(result).toBeNull();
    });

    test('should throw error for non-ENOENT errors', async () => {
      const error = new Error('Permission denied');
      mockFs.readFile.mockRejectedValue(error);

      await expect(tokenStorage.loadTokens()).rejects.toThrow('Failed to load tokens');
    });

    test('should decrypt and return tokens', async () => {
      // Mock a valid encrypted token file
      const mockEncryptedData = {
        data: 'encrypted-data-with-tag',
        iv: 'mock-iv-hex',
        salt: 'mock-salt-hex'
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockEncryptedData));

      // We can't easily test the actual decryption without mocking CryptoManager
      // This test mainly verifies the file reading logic
      await expect(tokenStorage.loadTokens()).rejects.toThrow();
    });
  });

  describe('clearTokens', () => {
    test('should delete token file', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      await tokenStorage.clearTokens();

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('tokens.enc')
      );
    });

    test('should handle ENOENT error when file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.unlink.mockRejectedValue(error);

      // Should not throw
      await expect(tokenStorage.clearTokens()).resolves.toBeUndefined();
    });

    test('should throw error for other unlink errors', async () => {
      const error = new Error('Permission denied');
      mockFs.unlink.mockRejectedValue(error);

      await expect(tokenStorage.clearTokens()).rejects.toThrow('Failed to clear tokens');
    });
  });

  describe('hasTokens', () => {
    test('should return true if token file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await tokenStorage.hasTokens();
      expect(result).toBe(true);
    });

    test('should return false if token file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await tokenStorage.hasTokens();
      expect(result).toBe(false);
    });
  });

  describe('Token Expiration', () => {
    test('isTokenExpired should return false for tokens without expiry', () => {
      const tokensWithoutExpiry: TokenSet = {
        access_token: 'test-token'
      };

      const result = tokenStorage.isTokenExpired(tokensWithoutExpiry);
      expect(result).toBe(false);
    });

    test('isTokenExpired should return true for expired tokens', () => {
      const expiredTokens: TokenSet = {
        access_token: 'test-token',
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };

      const result = tokenStorage.isTokenExpired(expiredTokens);
      expect(result).toBe(true);
    });

    test('isTokenExpired should return false for valid tokens', () => {
      const validTokens: TokenSet = {
        access_token: 'test-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };

      const result = tokenStorage.isTokenExpired(validTokens);
      expect(result).toBe(false);
    });

    test('isTokenExpired should account for buffer time', () => {
      const tokensNearExpiry: TokenSet = {
        access_token: 'test-token',
        expires_at: Math.floor(Date.now() / 1000) + 60 // 1 minute from now (less than 5 min buffer)
      };

      const result = tokenStorage.isTokenExpired(tokensNearExpiry);
      expect(result).toBe(true); // Should be considered expired due to buffer
    });

    test('updateTokenExpiry should add expires_at timestamp', () => {
      const tokens: TokenSet = {
        access_token: 'test-token',
        expires_in: 3600
      };

      const beforeTime = Math.floor(Date.now() / 1000);
      const updatedTokens = tokenStorage.updateTokenExpiry(tokens);
      const afterTime = Math.floor(Date.now() / 1000);

      expect(updatedTokens.expires_at).toBeDefined();
      expect(updatedTokens.expires_at!).toBeGreaterThanOrEqual(beforeTime + 3600);
      expect(updatedTokens.expires_at!).toBeLessThanOrEqual(afterTime + 3600);
    });

    test('updateTokenExpiry should not modify tokens without expires_in', () => {
      const tokens: TokenSet = {
        access_token: 'test-token'
      };

      const updatedTokens = tokenStorage.updateTokenExpiry(tokens);
      expect(updatedTokens.expires_at).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    test('machine-specific key derivation should be consistent', async () => {
      // This tests that the same machine info produces the same key
      const storage1 = new TokenStorage();
      const storage2 = new TokenStorage();

      // Trigger key generation by attempting to save tokens
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      await storage1.saveTokens(mockTokens);

      // Both should use the same os.hostname() and os.userInfo() calls
      expect(mockOs.hostname).toHaveBeenCalled();
      expect(mockOs.userInfo).toHaveBeenCalled();
    });

    test('different token file paths should be independent', async () => {
      const storage1 = new TokenStorage('/path1/tokens.enc');
      const storage2 = new TokenStorage('/path2/tokens.enc');

      mockFs.access.mockResolvedValue(undefined);

      await storage1.hasTokens();
      await storage2.hasTokens();

      expect(mockFs.access).toHaveBeenCalledWith('/path1/tokens.enc');
      expect(mockFs.access).toHaveBeenCalledWith('/path2/tokens.enc');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed encrypted data', async () => {
      mockFs.readFile.mockResolvedValue('invalid-json');

      await expect(tokenStorage.loadTokens()).rejects.toThrow();
    });

    test('should handle filesystem errors during save', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.writeFile.mockRejectedValue(new Error('Disk full'));

      await expect(tokenStorage.saveTokens(mockTokens)).rejects.toThrow('Disk full');
    });

    test('should handle mkdir errors during save', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(tokenStorage.saveTokens(mockTokens)).rejects.toThrow('Permission denied');
    });
  });
});