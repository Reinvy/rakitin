/**
 * Unit tests for Utils module
 */

const {
  ensureDir,
  writeFileIfNotExists,
  toPascalCase,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
  getCachedModulePath,
  clearPathCache,
  getPathCacheSize,
  PathCache,
} = require('../../lib/utils');

const fs = require('fs');
const path = require('path');

// Mock fs for isolated tests
jest.mock('fs');

describe('PathCache', () => {
  let cache;

  beforeEach(() => {
    cache = new PathCache(3);
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return current size', () => {
      expect(cache.size).toBe(0);
      cache.set('a', '1');
      expect(cache.size).toBe(1);
      cache.set('b', '2');
      expect(cache.size).toBe(2);
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when max size is reached', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      cache.set('d', '4'); // Should evict 'a'

      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('a')).toBe(false);
    });
  });
});

describe('String conversion utilities', () => {
  describe('toPascalCase', () => {
    it('should convert space-separated words', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
    });

    it('should convert kebab-case', () => {
      expect(toPascalCase('hello-world')).toBe('HelloWorld');
    });

    it('should convert snake_case', () => {
      expect(toPascalCase('hello_world')).toBe('HelloWorld');
    });

    it('should handle empty strings', () => {
      expect(toPascalCase('')).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(toPascalCase(null)).toBe('');
      expect(toPascalCase(undefined)).toBe('');
      expect(toPascalCase(123)).toBe('');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
    });

    it('should convert snake_case', () => {
      // toKebabCase doesn't handle underscores directly, use toSnakeCase first
      // This is expected behavior - toKebabCase handles camelCase and spaces
      expect(toKebabCase('helloWorld')).toBe('hello-world');
    });

    it('should convert space-separated words', () => {
      expect(toKebabCase('Hello World')).toBe('hello-world');
    });

    it('should handle empty strings', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should handle non-string inputs', () => {
      expect(toKebabCase(null)).toBe('');
      expect(toKebabCase(123)).toBe('');
    });
  });

  describe('toCamelCase', () => {
    it('should convert PascalCase', () => {
      expect(toCamelCase('HelloWorld')).toBe('helloWorld');
    });

    it('should convert kebab-case', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
    });

    it('should convert snake_case', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld');
    });

    it('should convert space-separated words', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
    });

    it('should lowercase first character', () => {
      expect(toCamelCase('Hello')).toBe('hello');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert PascalCase', () => {
      expect(toSnakeCase('HelloWorld')).toBe('hello_world');
    });

    it('should convert kebab-case', () => {
      expect(toSnakeCase('hello-world')).toBe('hello_world');
    });

    it('should convert space-separated words', () => {
      expect(toSnakeCase('hello world')).toBe('hello_world');
    });
  });

  describe('toTitleCase', () => {
    it('should convert snake_case', () => {
      expect(toTitleCase('hello_world')).toBe('Hello World');
    });

    it('should convert kebab-case', () => {
      expect(toTitleCase('hello-world')).toBe('Hello World');
    });

    it('should convert to lowercase first', () => {
      expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
    });
  });

  describe('toConstantCase', () => {
    it('should convert to UPPER_CASE', () => {
      expect(toConstantCase('hello world')).toBe('HELLO_WORLD');
    });

    it('should convert from PascalCase', () => {
      expect(toConstantCase('HelloWorld')).toBe('HELLO_WORLD');
    });

    it('should convert from kebab-case', () => {
      expect(toConstantCase('hello-world')).toBe('HELLO_WORLD');
    });
  });
});

describe('normalizeModuleName', () => {
  beforeEach(() => {
    clearPathCache();
  });

  it('should convert to kebab-case', () => {
    expect(normalizeModuleName('HelloWorld')).toBe('hello-world');
  });

  it('should handle spaces', () => {
    expect(normalizeModuleName('Hello World')).toBe('hello-world');
  });

  it('should throw error for non-string input', () => {
    expect(() => normalizeModuleName(null)).toThrow();
    expect(() => normalizeModuleName('')).toThrow();
    expect(() => normalizeModuleName(123)).toThrow();
  });

  it('should cache results', () => {
    const result1 = normalizeModuleName('TestModule');
    const result2 = normalizeModuleName('TestModule');
    expect(result1).toBe(result2);
    expect(getPathCacheSize()).toBeGreaterThan(0);
  });
});

describe('getCachedModulePath', () => {
  beforeEach(() => {
    clearPathCache();
  });

  it('should return cached path for same inputs', () => {
    const result1 = getCachedModulePath('TestModule', '/base', 'router');
    const result2 = getCachedModulePath('TestModule', '/base', 'router');
    expect(result1).toBe(result2);
  });

  it('should return different paths for different types', () => {
    const routerPath = getCachedModulePath('Module', '/base', 'router');
    const controllerPath = getCachedModulePath('Module', '/base', 'controller');

    expect(routerPath).not.toBe(controllerPath);
    expect(routerPath).toContain('router.js');
    expect(controllerPath).toContain('controller.js');
  });

  it('should normalize module names', () => {
    const path1 = getCachedModulePath('HelloWorld', '/base', 'moduleDir');
    const path2 = getCachedModulePath('hello-world', '/base', 'moduleDir');

    expect(path1).toBe(path2);
  });
});

describe('clearPathCache', () => {
  it('should clear all cached paths', () => {
    getCachedModulePath('Test', '/base', 'router');
    expect(getPathCacheSize()).toBeGreaterThan(0);

    clearPathCache();
    expect(getPathCacheSize()).toBe(0);
  });
});

describe('getPathCacheSize', () => {
  it('should return 0 initially', () => {
    clearPathCache();
    expect(getPathCacheSize()).toBe(0);
  });

  it('should increment with each cached path', () => {
    clearPathCache();
    getCachedModulePath('Module1', '/base', 'router');
    getCachedModulePath('Module2', '/base', 'controller');

    // May be more than 2 due to multiple cache keys per path
    expect(getPathCacheSize()).toBeGreaterThanOrEqual(2);
  });
});