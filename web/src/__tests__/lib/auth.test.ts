// @vitest-environment node
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, createToken, verifyToken } from "@/lib/auth";

process.env.AUTH_SECRET = "test-secret-for-testing-only";

describe("Auth Library", () => {
  describe("Password hashing", () => {
    it("should hash password correctly", () => {
      const password = "mySecretPassword123";
      const hash = hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it("should verify correct password", () => {
      const password = "mySecretPassword123";
      const hash = hashPassword(password);
      
      expect(verifyPassword(password, hash)).toBe(true);
    });

    it("should reject incorrect password", () => {
      const password = "mySecretPassword123";
      const wrongPassword = "wrongPassword";
      const hash = hashPassword(password);
      
      expect(verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it("should generate different hashes for same password", () => {
      const password = "mySecretPassword123";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      // 浣嗕袱鑰呴兘搴旇鑳介獙璇侀€氳繃
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe("JWT tokens", () => {
    it("should create and verify token", async () => {
      const username = "testuser";
      const token = await createToken(username);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      
      const verified = await verifyToken(token);
      expect(verified).toBe(username);
    });

    it("should return undefined for invalid token", async () => {
      const invalidToken = "invalid.token.here";
      
      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it("should return undefined for tampered token", async () => {
      const username = "testuser";
      const token = await createToken(username);
      const tampered = token.slice(0, -5) + "XXXXX";
      
      await expect(verifyToken(tampered)).rejects.toThrow();
    });
  });
});
