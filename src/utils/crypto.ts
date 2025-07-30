/**
 * Encryption Utilities
 * AES-256 encryption for secure token storage
 */

import * as crypto from 'crypto';
import { EncryptedData } from '../auth/auth-types';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits

export class CryptoManager {
  /**
   * Generate a cryptographically secure random key
   */
  static generateKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * Derive a key from password using PBKDF2
   */
  static deriveKey(password: string, salt: Buffer, iterations: number = 100000): Buffer {
    return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  static encrypt(data: string, key: Buffer): EncryptedData {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(salt);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      data: encrypted + authTag.toString('hex'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static decrypt(encryptedData: EncryptedData, key: Buffer): string {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const salt = Buffer.from(encryptedData.salt, 'hex');
    
    // Extract auth tag from the end of encrypted data
    const encryptedText = encryptedData.data.slice(0, -TAG_LENGTH * 2);
    const authTag = Buffer.from(encryptedData.data.slice(-TAG_LENGTH * 2), 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(salt);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate cryptographically secure random string for PKCE
   */
  static generateRandomString(length: number = 128): string {
    return crypto.randomBytes(length)
      .toString('base64url')
      .slice(0, length);
  }

  /**
   * Generate SHA256 hash for PKCE challenge
   */
  static generateSHA256Hash(input: string): string {
    return crypto.createHash('sha256')
      .update(input)
      .digest('base64url');
  }

  /**
   * Secure comparison of two strings (timing attack resistant)
   */
  static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}