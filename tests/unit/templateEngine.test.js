

// Direct require — templateEngine has no DB dependency
const { renderTemplate } = require('../../server/services/templateEngine');

describe('templateEngine', () => {
  describe('renderTemplate', () => {
    it('should replace {ref} and {message} placeholders', () => {
      const template = 'Issue {ref} resolved. {message}';
      const result = renderTemplate(template, { ref: '100', message: 'Fixed the bug' });
      expect(result).toBe('Issue 100 resolved. Fixed the bug');
    });

    it('should replace #{ref} hash-prefixed placeholder', () => {
      const template = 'Ticket #{ref} is done. {message}';
      const result = renderTemplate(template, { ref: '42', message: 'All good' });
      expect(result).toBe('Ticket 42 is done. All good');
    });

    it('should return empty string for empty template', () => {
      expect(renderTemplate('', { ref: '1' })).toBe('');
    });

    it('should return empty string for null template', () => {
      expect(renderTemplate(null, { ref: '1' })).toBe('');
    });

    it('should return empty string for undefined template', () => {
      expect(renderTemplate(undefined, { ref: '1' })).toBe('');
    });

    it('should strip {message} when variable is missing', () => {
      const template = 'Issue #{ref} resolved. {message}';
      const result = renderTemplate(template, { ref: '100' });
      expect(result).toBe('Issue 100 resolved.');
    });

    it('should leave {ref} untouched when ref is not provided', () => {
      const template = 'Issue #{ref} resolved.';
      const result = renderTemplate(template, {});
      // ref not provided → {ref} placeholder stays (no crash)
      expect(result).toContain('{ref}');
    });

    it('should handle XSS payload in variables without crashing', () => {
      const template = 'Issue #{ref}: {message}';
      const result = renderTemplate(template, {
        ref: '<script>alert(1)</script>',
        message: '<img onerror=alert(1) src=x>'
      });
      // SMS context: value is stored literally (no sanitization needed)
      expect(result).toContain('<script>alert(1)</script>');
      expect(result).toContain('<img onerror=alert(1) src=x>');
    });

    it('should handle very long message (10K chars) without crashing', () => {
      const longMsg = 'A'.repeat(10000);
      const template = '{message}';
      const result = renderTemplate(template, { message: longMsg });
      expect(result.length).toBe(10000);
    });

    it('should return template as-is when no placeholders exist', () => {
      const template = 'Hello world, no placeholders here.';
      const result = renderTemplate(template, { ref: '1', message: 'test' });
      expect(result).toBe('Hello world, no placeholders here.');
    });

    it('should handle Unicode characters (Greek text)', () => {
      const template = 'Το αίτημά σας #{ref} επιλύθηκε. {message}';
      const result = renderTemplate(template, { ref: '55', message: 'Ευχαριστούμε' });
      expect(result).toBe('Το αίτημά σας 55 επιλύθηκε. Ευχαριστούμε');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      const template = '{ref} is done. Reference: {ref}';
      const result = renderTemplate(template, { ref: '99' });
      expect(result).toBe('99 is done. Reference: 99');
    });

    it('should handle empty message variable (explicit empty string)', () => {
      const template = 'Issue #{ref}: {message}';
      const result = renderTemplate(template, { ref: '10', message: '' });
      expect(result).toBe('Issue 10:');
    });
  });
});
