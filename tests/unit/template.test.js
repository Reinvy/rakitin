const fs = require('fs-extra');
const path = require('path');
const { TemplateEngine, renderTemplate } = require('../../lib/template/engine');

describe('TemplateEngine (EJS-backed)', () => {
  let engine;

  beforeEach(() => {
    engine = new TemplateEngine({ enableCache: false });
  });

  describe('render', () => {
    test('renders single-line interpolation', () => {
      expect(engine.render('Hello <%= name %>', { name: 'World' })).toBe('Hello World');
    });

    test('REGRESSION: renders multi-line templates', () => {
      const template = [
        'const name = "<%= moduleName %>";',
        '',
        'function greet() {',
        '  return "hello " + name;',
        '}',
        'module.exports = { greet };',
      ].join('\n');
      const out = engine.render(template, { moduleName: 'user' });
      expect(out).toContain('const name = "user";');
      expect(out.split('\n').length).toBe(6);
    });

    test('escapes HTML by default', () => {
      const html = '<script>';
      expect(engine.render('<%= value %>', { value: html })).toBe('&lt;script&gt;');
      // raw output stays untouched
      expect(engine.render('<%- value %>', { value: html })).toBe(html);
    });

    test('supports control flow', () => {
      const t = 'A<% if (flag) { %>B<% } else { %>C<% } %>D';
      expect(engine.render(t, { flag: true })).toBe('ABD');
      expect(engine.render(t, { flag: false })).toBe('ACD');
    });

    test('supports loops', () => {
      const t = '<% items.forEach(function (i) { %><%= i %>-<% }); %>';
      expect(engine.render(t, { items: ['a', 'b'] })).toBe('a-b-');
    });

    test('propagates syntax errors with a helpful message', () => {
      expect(() => engine.render('<% if (%>')).toThrow();
    });
  });

  describe('renderFile', () => {
    test('resolves include() relative to the file location', async () => {
      const dir = path.join(global.tempDir, 'tpl-include');
      fs.ensureDirSync(dir);
      fs.writeFileSync(path.join(dir, 'header.ejs'), 'HEAD[<%= who %>]');
      fs.writeFileSync(
        path.join(dir, 'main.ejs'),
        '<%- include("header", { who: name }) %>!'
      );

      const out = engine.renderFile(path.join(dir, 'main.ejs'), { name: 'rakitin' });
      expect(out).toBe('HEAD[rakitin]!');
    });

    test('throws a clear error for a missing file', () => {
      const missing = path.join(global.tempDir, 'nope.ejs');
      expect(() => engine.renderFile(missing, {})).toThrow(/tidak ditemukan/);
    });
  });

  describe('caching', () => {
    test('same source is compiled once when caching enabled', () => {
      const cachingEngine = new TemplateEngine({ enableCache: true });
      cachingEngine.render('<%= a %>', { a: 1 });
      cachingEngine.render('<%= a %>', { a: 2 });
      expect(cachingEngine.cacheSize).toBe(1);

      cachingEngine.clearCache();
      expect(cachingEngine.cacheSize).toBe(0);
    });

    test('cache respects max size via FIFO eviction', () => {
      const cachingEngine = new TemplateEngine({ enableCache: true });
      cachingEngine.maxCacheSize = 2;
      for (let i = 0; i < 5; i++) {
        cachingEngine.render(`x=<%= ${i} %>`, {});
      }
      expect(cachingEngine.cacheSize).toBeLessThanOrEqual(2);
    });
  });

  describe('globals and helpers', () => {
    test('locals are merged as fallbacks into every render', () => {
      const e = new TemplateEngine({ locals: { brand: 'rakitin' } });
      expect(e.render('<%= brand %>')).toBe('rakitin');
      // explicit data wins
      expect(e.render('<%= brand %>', { brand: 'other' })).toBe('other');
    });
  });

  describe('renderTemplate helper', () => {
    test('one-shot render through the default engine', () => {
      expect(renderTemplate('<%= n * 2 %>', { n: 21 })).toBe('42');
    });
  });
});
