

// isValidPhone has no dependencies, safe to require directly
const { isValidPhone } = require('../../server/services/smsService');

describe('smsService', () => {
  describe('isValidPhone', () => {
    it('should accept valid international phone +306912345678', () => {
      expect(isValidPhone('+306912345678')).toBe(true);
    });

    it('should accept valid phone with 8 digits +1555123', () => {
      // Minimum: + followed by 8 digits
      expect(isValidPhone('+15551230')).toBe(true);
    });

    it('should accept phone with exactly 15 digits', () => {
      expect(isValidPhone('+123456789012345')).toBe(true);
    });

    it('should reject phone without + prefix', () => {
      expect(isValidPhone('306912345678')).toBe(false);
    });

    it('should reject phone too short (less than 8 digits)', () => {
      expect(isValidPhone('+30691')).toBe(false);
    });

    it('should reject phone too long (more than 15 digits)', () => {
      expect(isValidPhone('+1234567890123456')).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidPhone(null)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidPhone('')).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidPhone(undefined)).toBe(false);
    });

    it('should reject phone with letters', () => {
      expect(isValidPhone('+30abc1234567')).toBe(false);
    });

    it('should reject phone with spaces', () => {
      expect(isValidPhone('+30 691 234 5678')).toBe(false);
    });

    it('should reject SQL injection in phone number', () => {
      expect(isValidPhone("+30'; DROP TABLE logs;--")).toBe(false);
    });

    it('should reject phone with special characters', () => {
      expect(isValidPhone('+30-691-234-5678')).toBe(false);
    });

    it('should reject just the + sign', () => {
      expect(isValidPhone('+')).toBe(false);
    });
  });
});
