/**
 * Unit Tests for CryptoManager
 * Tests encryption, decryption, PKCE, and security utilities
 */

import { CryptoManager } from '../../src/utils/crypto';
import { EncryptedData } from '../../src/auth/auth-types';

describe('CryptoManager', () => {
  describe('Key Generation', () => {
    test('generateKey should return 32-byte buffer', () => {
      const key = CryptoManager.generateKey();
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32); // 256 bits
    });

    test('generateKey should return different keys each time', () => {
      const key1 = CryptoManager.generateKey();
      const key2 = CryptoManager.generateKey();
      expect(key1.equals(key2)).toBe(false);
    });

    test('deriveKey should return consistent key for same input', () => {
      const password = 'test-password';
      const salt = Buffer.from('test-salt');
      
      const key1 = CryptoManager.deriveKey(password, salt);
      const key2 = CryptoManager.deriveKey(password, salt);
      
      expect(key1.equals(key2)).toBe(true);
      expect(key1.length).toBe(32);
    });

    test('deriveKey should return different keys for different passwords', () => {
      const salt = Buffer.from('test-salt');
      
      const key1 = CryptoManager.deriveKey('password1', salt);
      const key2 = CryptoManager.deriveKey('password2', salt);
      
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('Encryption/Decryption', () => {
    const testData = 'This is sensitive test data';
    const key = CryptoManager.generateKey();

    test('encrypt should return EncryptedData with required fields', () => {
      const encrypted = CryptoManager.encrypt(testData, key);
      
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(typeof encrypted.data).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.salt).toBe('string');
    });

    test('decrypt should recover original data', () => {
      const encrypted = CryptoManager.encrypt(testData, key);
      const decrypted = CryptoManager.decrypt(encrypted, key);
      
      expect(decrypted).toBe(testData);
    });

    test('encrypt should produce different output each time', () => {
      const encrypted1 = CryptoManager.encrypt(testData, key);
      const encrypted2 = CryptoManager.encrypt(testData, key);
      
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    test('decrypt should fail with wrong key', () => {
      const encrypted = CryptoManager.encrypt(testData, key);
      const wrongKey = CryptoManager.generateKey();
      
      expect(() => {
        CryptoManager.decrypt(encrypted, wrongKey);
      }).toThrow();
    });

    test('decrypt should fail with tampered data', () => {
      const encrypted = CryptoManager.encrypt(testData, key);
      const tamperedData: EncryptedData = {
        ...encrypted,
        data: encrypted.data.slice(0, -4) + '0000'
      };
      
      expect(() => {
        CryptoManager.decrypt(tamperedData, key);
      }).toThrow();
    });

    test('should handle empty string', () => {
      const emptyData = '';
      const encrypted = CryptoManager.encrypt(emptyData, key);
      const decrypted = CryptoManager.decrypt(encrypted, key);
      
      expect(decrypted).toBe(emptyData);
    });

    test('should handle unicode characters', () => {
      const unicodeData = '🔐 Secure data with émojis and accénts 中文';
      const encrypted = CryptoManager.encrypt(unicodeData, key);
      const decrypted = CryptoManager.decrypt(encrypted, key);
      
      expect(decrypted).toBe(unicodeData);
    });
  });

  describe('PKCE Functions', () => {
    test('generateRandomString should return string of correct length', () => {
      const length = 64;
      const randomString = CryptoManager.generateRandomString(length);
      
      expect(typeof randomString).toBe('string');
      expect(randomString.length).toBe(length);
    });

    test('generateRandomString should return different strings', () => {
      const str1 = CryptoManager.generateRandomString();
      const str2 = CryptoManager.generateRandomString();
      
      expect(str1).not.toBe(str2);
    });

    test('generateRandomString should only contain URL-safe characters', () => {
      const randomString = CryptoManager.generateRandomString(100);
      const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
      
      expect(urlSafeRegex.test(randomString)).toBe(true);
    });

    test('generateSHA256Hash should return consistent hash', () => {
      const input = 'test-input';
      const hash1 = CryptoManager.generateSHA256Hash(input);
      const hash2 = CryptoManager.generateSHA256Hash(input);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    test('generateSHA256Hash should return different hashes for different inputs', () => {
      const hash1 = CryptoManager.generateSHA256Hash('input1');
      const hash2 = CryptoManager.generateSHA256Hash('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    test('generateSHA256Hash should return URL-safe base64', () => {
      const hash = CryptoManager.generateSHA256Hash('test-input');
      const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
      
      expect(urlSafeRegex.test(hash)).toBe(true);
    });
  });

  describe('Security Functions', () => {
    test('secureCompare should return true for identical strings', () => {
      const str = 'identical-string';
      expect(CryptoManager.secureCompare(str, str)).toBe(true);
    });

    test('secureCompare should return false for different strings', () => {
      expect(CryptoManager.secureCompare('string1', 'string2')).toBe(false);
    });

    test('secureCompare should return false for different length strings', () => {
      expect(CryptoManager.secureCompare('short', 'longer-string')).toBe(false);
    });

    test('secureCompare should handle empty strings', () => {
      expect(CryptoManager.secureCompare('', '')).toBe(true);
      expect(CryptoManager.secureCompare('', 'non-empty')).toBe(false);
    });

    test('secureCompare should be timing-safe (basic test)', () => {
      // This is a basic test - true timing attack testing would be more complex
      const baseString = 'a'.repeat(1000);
      const similarString = 'a'.repeat(999) + 'b';
      const differentString = 'b'.repeat(1000);
      
      expect(CryptoManager.secureCompare(baseString, similarString)).toBe(false);
      expect(CryptoManager.secureCompare(baseString, differentString)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('full PKCE flow simulation', () => {
      // Generate verifier
      const verifier = CryptoManager.generateRandomString(128);
      expect(verifier.length).toBe(128);
      
      // Generate challenge
      const challenge = CryptoManager.generateSHA256Hash(verifier);
      expect(challenge.length).toBeGreaterThan(0);
      
      // Verify challenge is deterministic
      const challenge2 = CryptoManager.generateSHA256Hash(verifier);
      expect(challenge).toBe(challenge2);
      
      // Verify different verifiers produce different challenges
      const verifier2 = CryptoManager.generateRandomString(128);
      const challenge3 = CryptoManager.generateSHA256Hash(verifier2);
      expect(challenge).not.toBe(challenge3);
    });

    test('key derivation with encryption round trip', () => {
      const password = 'user-password';
      const salt = Buffer.from('application-salt');
      const testData = JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_in: 3600
      });
      
      // Derive key
      const key = CryptoManager.deriveKey(password, salt);
      
      // Encrypt data
      const encrypted = CryptoManager.encrypt(testData, key);
      
      // Decrypt with same derived key
      const key2 = CryptoManager.deriveKey(password, salt);
      const decrypted = CryptoManager.decrypt(encrypted, key2);
      
      expect(decrypted).toBe(testData);
      expect(JSON.parse(decrypted).access_token).toBe('test-token');
    });
  });
});