import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

// Set test key before importing
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

import { encryptJson, decryptJson } from "./index";

describe("AES-256-GCM Encryption", () => {
  it("round-trips a simple object", () => {
    const input = { api_key: "sk-test-123", secret: "hunter2" };
    const encrypted = encryptJson(input);

    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toBe(JSON.stringify(input));

    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(input);
  });

  it("round-trips Twilio credentials", () => {
    const input = {
      account_sid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      auth_token: "your_auth_token_here",
      phone_number: "+15551234567",
    };
    const encrypted = encryptJson(input);
    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(input);
  });

  it("round-trips nested objects", () => {
    const input = {
      tokens: { access_token: "ya29.xxx", refresh_token: "1//0xxx" },
      calendar_id: "primary",
    };
    const encrypted = encryptJson(input);
    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(input);
  });

  it("round-trips empty objects", () => {
    const input = {};
    const encrypted = encryptJson(input);
    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(input);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const input = { key: "value" };
    const encrypted1 = encryptJson(input);
    const encrypted2 = encryptJson(input);
    expect(encrypted1).not.toBe(encrypted2);
  });
});
