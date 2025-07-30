/**
 * Encrypted Token Storage
 * Secure storage for OAuth tokens using AES-256 encryption
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TokenSet, EncryptedData } from './auth-types';
import { CryptoManager } from '../utils/crypto';

export class TokenStorage {
  private readonly tokenFilePath: string;
  private readonly configDir: string;
  private encryptionKey: Buffer | null = null;

  constructor(tokenFilePath?: string) {
    this.configDir = path.join(os.homedir(), '.google-tasks-mcp');
    this.tokenFilePath = tokenFilePath || path.join(this.configDir, 'tokens.enc');
  }

  /**
   * Initialize encryption key from machine-specific data
   */
  private async getEncryptionKey(): Promise<Buffer> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Generate a machine-specific key based on hostname and user
    const machineInfo = `${os.hostname()}-${os.userInfo().username}`;
    const salt = Buffer.from('google-tasks-mcp-salt', 'utf8');
    
    this.encryptionKey = CryptoManager.deriveKey(machineInfo, salt);
    return this.encryptionKey;
  }

  /**
   * Ensure config directory exists with proper permissions
   */
  private async ensureConfigDir(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Set file permissions to user-only (600)
   */
  private async setSecurePermissions(filePath: string): Promise<void> {
    try {
      await fs.chmod(filePath, 0o600);
    } catch (error) {
      console.warn(`Warning: Could not set secure permissions on ${filePath}:`, error);
    }
  }

  /**
   * Encrypt and save tokens to file
   */
  async saveTokens(tokens: TokenSet): Promise<void> {
    await this.ensureConfigDir();
    
    const key = await this.getEncryptionKey();
    const tokenData = JSON.stringify(tokens);
    const encrypted = CryptoManager.encrypt(tokenData, key);
    
    const fileContent = JSON.stringify(encrypted);
    await fs.writeFile(this.tokenFilePath, fileContent, { mode: 0o600 });
    await this.setSecurePermissions(this.tokenFilePath);
  }

  /**
   * Load and decrypt tokens from file
   */
  async loadTokens(): Promise<TokenSet | null> {
    try {
      const fileContent = await fs.readFile(this.tokenFilePath, 'utf8');
      const encrypted: EncryptedData = JSON.parse(fileContent);
      
      const key = await this.getEncryptionKey();
      const decryptedData = CryptoManager.decrypt(encrypted, key);
      
      return JSON.parse(decryptedData) as TokenSet;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to load tokens: ${(error as Error).message}`);
    }
  }

  /**
   * Remove stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to clear tokens: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Check if tokens exist
   */
  async hasTokens(): Promise<boolean> {
    try {
      await fs.access(this.tokenFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate token expiration
   */
  isTokenExpired(tokens: TokenSet): boolean {
    if (!tokens.expires_at) {
      return false; // No expiration info, assume valid
    }
    
    const now = Math.floor(Date.now() / 1000);
    const buffer = 300; // 5 minute buffer
    
    return tokens.expires_at <= (now + buffer);
  }

  /**
   * Update token expiration timestamp
   */
  updateTokenExpiry(tokens: TokenSet): TokenSet {
    if (tokens.expires_in) {
      tokens.expires_at = Math.floor(Date.now() / 1000) + tokens.expires_in;
    }
    return tokens;
  }
}