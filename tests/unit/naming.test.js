const {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
  getModuleVariants,
  toIdentifier,
  toSafeFileName,
} = require('../../lib/naming');

describe('naming', () => {
  describe('case converters', () => {
    test('toPascalCase', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
      expect(toPascalCase('user-profile')).toBe('UserProfile');
      expect(toPascalCase('user_profile')).toBe('UserProfile');
      expect(toPascalCase('')).toBe('');
      expect(toPascalCase(null)).toBe('');
      expect(toPascalCase(123)).toBe('');
    });

    test('toCamelCase', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
      expect(toCamelCase('hello-world')).toBe('helloWorld');
      expect(toCamelCase('hello_world')).toBe('helloWorld');
      expect(toCamelCase('')).toBe('');
      expect(toCamelCase(undefined)).toBe('');
    });

    test('toKebabCase', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
      expect(toKebabCase('hello world')).toBe('hello-world');
      expect(toKebabCase('')).toBe('');
      expect(toKebabCase(null)).toBe('');
    });

    test('toSnakeCase', () => {
      expect(toSnakeCase('HelloWorld')).toBe('hello_world');
      expect(toSnakeCase('hello-world')).toBe('hello_world');
      expect(toSnakeCase('')).toBe('');
    });

    test('toTitleCase', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
      expect(toTitleCase('user-profile')).toBe('User Profile');
    });

    test('toConstantCase', () => {
      expect(toConstantCase('hello world')).toBe('HELLO_WORLD');
      expect(toConstantCase('HelloWorld')).toBe('HELLO_WORLD');
    });
  });

  describe('normalizeModuleName', () => {
    test('normalizes casing variants to kebab-case', () => {
      expect(normalizeModuleName('UserProfile')).toBe('user-profile');
      expect(normalizeModuleName('user profile')).toBe('user-profile');
      expect(normalizeModuleName('user_profile')).toBe('user-profile');
      expect(normalizeModuleName('  user  ')).toBe('user');
    });

    test('throws on empty or non-string input', () => {
      expect(() => normalizeModuleName('')).toThrow();
      expect(() => normalizeModuleName('   ')).toThrow();
      expect(() => normalizeModuleName(null)).toThrow();
      expect(() => normalizeModuleName(undefined)).toThrow();
      expect(() => normalizeModuleName(42)).toThrow();
    });
  });

  describe('toIdentifier (safety-critical)', () => {
    test('converts hyphenated names to valid identifiers', () => {
      // B2 regression guard: raw "user-profile" produced invalid JS
      expect(toIdentifier('user-profile')).toBe('userProfile');
      expect(toIdentifier('user-profile', { casing: 'pascal' })).toBe('UserProfile');
    });

    test('handles leading digits', () => {
      expect(toIdentifier('2fa-module')).toMatch(/^_/);
    });

    test('avoids reserved words', () => {
      expect(toIdentifier('class')).toBe('class_');
      expect(toIdentifier('delete')).toBe('delete_');
    });

    test('strips illegal characters', () => {
      expect(toIdentifier('my var!@#')).toBe('myVar');
      expect(toIdentifier('***')).toBe('_');
      expect(toIdentifier('')).toBe('_');
    });
  });

  describe('getModuleVariants', () => {
    test('returns all naming variants consistently', () => {
      const v = getModuleVariants('user profile');
      expect(v).toEqual({
        raw: 'user profile',
        kebab: 'user-profile',
        pascal: 'UserProfile',
        camel: 'userProfile',
        snake: 'user_profile',
        constant: 'USER_PROFILE',
        identifier: 'userProfile',
      });
    });
  });

  describe('toSafeFileName', () => {
    test('produces safe file names', () => {
      expect(toSafeFileName('User Profile!')).toBe('user-profile');
      expect(toSafeFileName('../etc/passwd')).toBe('etc-passwd');
      expect(toSafeFileName('--weird--name--')).toBe('weird-name');
    });
  });
});
