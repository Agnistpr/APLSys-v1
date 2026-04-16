import { safeStorage } from 'electron';

export function isEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable();
}

export function encryptData(data) {
  if (!isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const buffer = Buffer.from(JSON.stringify(data), 'utf8');
  return safeStorage.encryptString(buffer).toString('base64');
}

export function decryptData(encryptedData) {
  if (!isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const buffer = Buffer.from(encryptedData, 'base64');
  const decrypted = safeStorage.decryptString(buffer);
  return JSON.parse(decrypted);
}

// Mask sensitive data for logging
export function maskSensitiveData(data) {
  if (typeof data !== 'object' || data === null) return data;

  const masked = { ...data };

  // Mask common sensitive fields
  const sensitiveFields = ['email', 'phone', 'password', 'ssn', 'address', 'salary', 'bankAccount'];

  for (const field of sensitiveFields) {
    if (masked[field]) {
      if (typeof masked[field] === 'string') {
        masked[field] = maskString(masked[field]);
      }
    }
  }

  // Recursively mask nested objects
  for (const key in masked) {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

function maskString(str) {
  if (str.length <= 4) return '*'.repeat(str.length);
  return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
}