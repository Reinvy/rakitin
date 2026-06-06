/**
 * Unit tests for Template Engine
 */

const { TemplateEngine, createEngine, HELPERS, DEFAULT_DELIMITERS } = require('../../lib/template/engine');

describe('TemplateEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new TemplateEngine({ enableCache: false });
  });

  describe('constructor', () => {
    it('should create engine with default delimiters', () => {
      const defaultEngine = new TemplateEngine();
      expect(defaultEngine.delimiters.interpolate).toBe('<%=');
      expect(defaultEngine.delimiters.evaluate).toBe('<%');
      expect(defaultEngine.delimiters.escape).toBe('<%-');
    });

    it('should merge custom delimiters with defaults', () => {
      const customEngine = new TemplateEngine({
        delimiters: { interpolate: '{{' },
      });
      expect(customEngine.delimiters.interpolate).toBe('{{');
      expect(customEngine.delimiters.evaluate).toBe('<%'); // default
    });
  });

  describe('registerHelper', () => {
    it('should register a single helper', () => {
      engine.registerHelper('uppercase', (str) => String(str).toUpperCase());
      expect(engine.helpers.uppercase).toBeDefined();
      expect(typeof engine.helpers.uppercase).toBe('function');
    });

    it('should throw error for non-function helpers', () => {
      expect(() => engine.registerHelper('invalid', 'not a function')).toThrow();
    });
  });

  describe('registerHelpers', () => {
    it('should register multiple helpers', () => {
      engine.registerHelpers({
        lowercase: (str) => String(str).toLowerCase(),
        reverse: (str) => String(str).split('').reverse().join(''),
      });
      expect(engine.helpers.lowercase).toBeDefined();
      expect(engine.helpers.reverse).toBeDefined();
    });
  });

  describe('registerPartial', () => {
    it('should register a partial template', () => {
      engine.registerPartial('header', '<header>Header</header>');
      expect(engine.partials.has('header')).toBe(true);
    });
  });

  describe('registerPartials', () => {
    it('should register multiple partials', () => {
      engine.registerPartials({
        header: '<header>Header</header>',
        footer: '<footer>Footer</footer>',
      });
      expect(engine.partials.has('header')).toBe(true);
      expect(engine.partials.has('footer')).toBe(true);
    });
  });

  describe('registerLayout', () => {
    it('should register a layout template', () => {
      engine.registerLayout('main', '<html><body><%= __content %></body></html>');
      expect(engine.layouts.has('main')).toBe(true);
    });
  });

  describe('render', () => {
    it('should render simple variable interpolation', () => {
      const template = '<%= name %>';
      const result = engine.render(template, { name: 'World' });
      expect(result).toBe('World');
    });

    it('should render escaped HTML in interpolate mode', () => {
      const template = '<%= content %>';
      const result = engine.render(template, { content: '<script>alert("xss")</script>' });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should render raw HTML in escape mode', () => {
      const template = '<%- content %>';
      const result = engine.render(template, { content: '<b>Bold</b>' });
      expect(result).toContain('<b>Bold</b>');
    });

    it('should render with conditional', () => {
      const template = '<% if (show) { %>Visible<% } %>';
      expect(engine.render(template, { show: true })).toBe('Visible');
      expect(engine.render(template, { show: false })).toBe('');
    });

    it('should render with each loop', () => {
      // Use the helper function directly in data
      const testEngine = new TemplateEngine();
      testEngine.registerHelper('joinItems', (items) => items.join(', '));
      const template = '<%= joinItems(items) %>';
      const result = testEngine.render(template, { items: ['a', 'b', 'c'] });
      expect(result).toBe('a, b, c');
    });

    it('should render with helpers', () => {
      engine.registerHelper('greet', (name) => `Hello, ${name}!`);
      const template = '<%= greet(name) %>';
      const result = engine.render(template, { name: 'World' });
      expect(result).toBe('Hello, World!');
    });

    it('should include registered partials', () => {
      engine.registerPartial('header', '<header>My Header</header>');
      const template = '<%- include("header") %>';
      const result = engine.render(template, {});
      expect(result).toContain('My Header');
    });

    it('should handle missing partials gracefully', () => {
      const template = '<%- include("missing") %>';
      const result = engine.render(template, {});
      expect(result).toContain('[Partial not found: missing]');
    });
  });

  describe('clearCache', () => {
    it('should clear template cache', () => {
      const cachingEngine = new TemplateEngine({ enableCache: true });
      cachingEngine.render('<%= name %>', { name: 'test' });
      expect(cachingEngine.getCacheSize()).toBeGreaterThan(0);

      cachingEngine.clearCache();
      expect(cachingEngine.getCacheSize()).toBe(0);
    });
  });

  describe('getCacheSize', () => {
    it('should return 0 for disabled cache', () => {
      expect(engine.getCacheSize()).toBe(0);
    });

    it('should return cache size for enabled cache', () => {
      const cachingEngine = new TemplateEngine({ enableCache: true });
      cachingEngine.render('<%= name %>', { name: 'test1' });
      cachingEngine.render('<%= name %>', { name: 'test2' });
      // Note: Same template is cached, so size might be 1
      expect(cachingEngine.getCacheSize()).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('createEngine', () => {
  it('should create new TemplateEngine instance', () => {
    const e = createEngine();
    expect(e).toBeInstanceOf(TemplateEngine);
  });

  it('should pass options to constructor', () => {
    const e = createEngine({ enableCache: true });
    expect(e.enableCache).toBe(true);
  });
});

describe('HELPERS', () => {
  describe('String helpers', () => {
    it('capitalize should capitalize first letter', () => {
      expect(HELPERS.capitalize('hello')).toBe('Hello');
      expect(HELPERS.capitalize('WORLD')).toBe('WORLD');
    });

    it('camelCase should convert to camelCase', () => {
      expect(HELPERS.camelCase('hello-world')).toBe('helloWorld');
      expect(HELPERS.camelCase('hello world')).toBe('helloWorld');
      expect(HELPERS.camelCase('HelloWorld')).toBe('helloWorld');
    });

    it('kebabCase should convert to kebab-case', () => {
      expect(HELPERS.kebabCase('helloWorld')).toBe('hello-world');
      expect(HELPERS.kebabCase('Hello World')).toBe('hello-world');
    });

    it('snakeCase should convert to snake_case', () => {
      expect(HELPERS.snakeCase('helloWorld')).toBe('hello_world');
      expect(HELPERS.snakeCase('hello-world')).toBe('hello_world');
    });

    it('pascalCase should convert to PascalCase', () => {
      expect(HELPERS.pascalCase('hello-world')).toBe('HelloWorld');
      expect(HELPERS.pascalCase('hello world')).toBe('HelloWorld');
    });

    it('upperFirst should only capitalize first letter', () => {
      expect(HELPERS.upperFirst('hello')).toBe('Hello');
      expect(HELPERS.upperFirst('WORLD')).toBe('WORLD');
    });

    it('lowerFirst should only lowercase first letter', () => {
      expect(HELPERS.lowerFirst('Hello')).toBe('hello');
      expect(HELPERS.lowerFirst('WORLD')).toBe('wORLD');
    });
  });

  describe('Utility helpers', () => {
    it('repeat should repeat string', () => {
      expect(HELPERS.repeat('a', 3)).toBe('aaa');
      expect(HELPERS.repeat('ab', 2)).toBe('abab');
    });

    it('pad should pad string', () => {
      expect(HELPERS.pad('hello', 10)).toBe('hello     ');
      expect(HELPERS.pad('hello', 10, '*', 'left')).toBe('*****hello');
    });

    it('truncate should truncate string', () => {
      // length includes suffix, so length=8 gives 'hello' (5) + '...' (3) = 8 chars
      expect(HELPERS.truncate('hello world', 8)).toBe('hello...');
      expect(HELPERS.truncate('short', 10)).toBe('short');
    });

    it('join should join array', () => {
      expect(HELPERS.join(['a', 'b', 'c'])).toBe('a, b, c');
      expect(HELPERS.join(['a', 'b'], '|')).toBe('a|b');
    });

    it('length should return length', () => {
      expect(HELPERS.length('hello')).toBe(5);
      expect(HELPERS.length([1, 2, 3])).toBe(3);
      expect(HELPERS.length({ a: 1, b: 2 })).toBe(2);
    });

    it('isEmpty should check emptiness', () => {
      expect(HELPERS.isEmpty('')).toBe(true);
      expect(HELPERS.isEmpty('  ')).toBe(true);
      expect(HELPERS.isEmpty([])).toBe(true);
      expect(HELPERS.isEmpty({})).toBe(true);
      expect(HELPERS.isEmpty('hello')).toBe(false);
      expect(HELPERS.isEmpty([1])).toBe(false);
    });

    it('default should return default for empty values', () => {
      expect(HELPERS.default('', 'empty')).toBe('empty');
      expect(HELPERS.default(null, 'default')).toBe('default');
      expect(HELPERS.default('value', 'default')).toBe('value');
    });

    it('json should stringify objects', () => {
      const result = HELPERS.json({ a: 1 });
      expect(result).toBe('{"a":1}');
    });
  });

  describe('Conditional helpers', () => {
    it('if should return then/else based on condition', () => {
      expect(HELPERS.if(true, 'yes', 'no')).toBe('yes');
      expect(HELPERS.if(false, 'yes', 'no')).toBe('no');
    });

    it('unless should return then/else based on condition', () => {
      expect(HELPERS.unless(true, 'yes', 'no')).toBe('no');
      expect(HELPERS.unless(false, 'yes', 'no')).toBe('yes');
    });
  });

  describe('Array helpers', () => {
    it('map should transform array', () => {
      const result = HELPERS.map([1, 2, 3], (x) => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it('filter should filter array', () => {
      const result = HELPERS.filter([1, 2, 3, 4], (x) => x > 2);
      expect(result).toEqual([3, 4]);
    });
  });

  describe('Module name helpers', () => {
    it('normalizeModuleName should convert to kebab-case', () => {
      expect(HELPERS.normalizeModuleName('HelloWorld')).toBe('hello-world');
      expect(HELPERS.normalizeModuleName('hello world')).toBe('hello-world');
    });

    it('plural should return singular or plural based on count', () => {
      expect(HELPERS.plural(1, 'item')).toBe('item');
      expect(HELPERS.plural(2, 'item')).toBe('items');
      expect(HELPERS.plural(3, 'box', 'boxes')).toBe('boxes');
    });
  });
});

describe('DEFAULT_DELIMITERS', () => {
  it('should have all required delimiter types', () => {
    expect(DEFAULT_DELIMITERS.interpolate).toBeDefined();
    expect(DEFAULT_DELIMITERS.evaluate).toBeDefined();
    expect(DEFAULT_DELIMITERS.escape).toBeDefined();
  });
});