/**
 * lib/template/engine.js - EJS-based template rendering.
 *
 * The previous hand-rolled engine failed to compile any multi-line
 * template and had zero production callers, so it was replaced by battle-
 * tested EJS. Generator templates should use plain EJS syntax:
 *   <%= value %>          escaped output
 *   <%- value %>          raw output
 *   <% if (...) { %>..<% } %>
 *   <%- include('./partial', { x: 1 }) %>
 */

const ejs = require("ejs");
const fs = require("fs");

/**
 * Thin wrapper around EJS with an LRU-ish string-template cache.
 */
class TemplateEngine {
  /**
   * @param {object} [options]
   * @param {boolean} [options.enableCache=true] Cache compiled templates.
   * @param {object} [options.locals] Global fallback variables merged into
   *   every render's data.
   * @param {object} [options.ejsOptions] Extra options passed straight to EJS.
   */
  constructor({ enableCache = true, locals = {}, ejsOptions = {} } = {}) {
    this.enableCache = enableCache;
    this.locals = locals;
    this.ejsOptions = ejsOptions;
    /** @type {Map<string, Function>} */
    this._cache = new Map();
    /** @type {number} */
    this.maxCacheSize = 200;
  }

  /**
   * Render an in-memory template string with the given data.
   * @param {string} template EJS template source.
   * @param {object} [data]
   * @returns {string}
   */
  render(template, data = {}) {
    const compiled = this._compile(template);
    return compiled({ ...this.locals, ...data });
  }

  /**
   * Render a template file (path is resolved by the caller).
   * Compiled file templates are cached per absolute path + mtime and carry
   * the filename context required by include().
   * @param {string} filePath
   * @param {object} [data]
   * @returns {string}
   */
  renderFile(filePath, data = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Template tidak ditemukan: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    const key = `${filePath}:${stat.mtimeMs}`;

    let fn = this._cache.get(key);
    if (!fn) {
      const source = fs.readFileSync(filePath, "utf8");
      // Bake filename into the compiled fn so include() resolves correctly.
      fn = ejs.compile(source, {
        ...this.ejsOptions,
        async: false,
        filename: filePath,
      });
      this._set(key, fn);
    }

    try {
      return fn({ ...this.locals, ...data });
    } catch (error) {
      throw new Error(`Gagal merender template "${filePath}": ${error.message}`);
    }
  }

  /**
   * Compile a template into a sync function, with caching by source hash.
   * @private
   */
  _compile(source) {
    if (!this.enableCache) {
      return ejs.compile(source, { ...this.ejsOptions, async: false });
    }
    const cached = this._cache.get(source);
    if (cached) return cached;

    const fn = ejs.compile(source, { ...this.ejsOptions, async: false });
    this._set(source, fn);
    return fn;
  }

  /**
   * Insert into cache with simple FIFO eviction.
   * @private
   */
  _set(key, value) {
    if (this._cache.size >= this.maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  /** Clear the template cache. */
  clearCache() {
    this._cache.clear();
  }

  /** Number of cached entries (exposed for tests/diagnostics). */
  get cacheSize() {
    return this._cache.size;
  }
}

/**
 * Convenience one-shot render using a shared default engine instance.
 * @param {string} template
 * @param {object} [data]
 * @returns {string}
 */
function renderTemplate(template, data = {}) {
  return defaultEngine.render(template, data);
}

const defaultEngine = new TemplateEngine();

module.exports = {
  TemplateEngine,
  renderTemplate,
  defaultEngine,
};
