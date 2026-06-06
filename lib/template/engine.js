/**
 * Template Engine - EJS-based template system with variables, conditionals, loops
 * Supports: partials, layouts, helpers, filters
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Default template delimiters
 */
const DEFAULT_DELIMITERS = {
  interpolate: '<%=',
  evaluate: '<%',
  escape: '<%-',
};

/**
 * Built-in template helpers
 */
const HELPERS = {
  /**
   * Capitalize first letter
   */
  capitalize: (str) => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Convert to camelCase
   */
  camelCase: (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toLowerCase());
  },

  /**
   * Convert to kebab-case
   */
  kebabCase: (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  },

  /**
   * Convert to snake_case
   */
  snakeCase: (str) => {
    if (typeof str !== 'string') return '';
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  },

  /**
   * Convert to PascalCase
   */
  pascalCase: (str) => {
    if (typeof str !== 'string') return '';
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  },

  /**
   * Uppercase first letter only
   */
  upperFirst: (str) => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Lowercase first letter only
   */
  lowerFirst: (str) => {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toLowerCase() + str.slice(1);
  },

  /**
   * Repeat string n times
   */
  repeat: (str, count = 1) => {
    if (typeof str !== 'string') return '';
    return str.repeat(Math.max(0, count));
  },

  /**
   * Pad string to length with character
   */
  pad: (str, length, char = ' ', direction = 'right') => {
    if (typeof str !== 'string') str = String(str);
    const padLength = Math.max(0, length - str.length);
    const padding = char.repeat(padLength);

    if (direction === 'left') return padding + str;
    if (direction === 'both') {
      const leftPad = padding.slice(0, Math.floor(padLength / 2));
      const rightPad = padding.slice(Math.floor(padLength / 2));
      return leftPad + str + rightPad;
    }
    return str + padding;
  },

  /**
   * Truncate string to length
   */
  truncate: (str, length = 50, suffix = '...') => {
    if (typeof str !== 'string') return '';
    if (str.length <= length) return str;
    return str.slice(0, length - suffix.length) + suffix;
  },

  /**
   * Join array elements
   */
  join: (arr, separator = ', ') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator);
  },

  /**
   * Get array/object length
   */
  length: (obj) => {
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length;
    if (typeof obj === 'object' && obj !== null) return Object.keys(obj).length;
    return 0;
  },

  /**
   * Check if value is empty
   */
  isEmpty: (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  },

  /**
   * Default value if empty
   */
  default: (value, defaultValue = '') => {
    if (value === null || value === undefined || value === '') return defaultValue;
    return value;
  },

  /**
   * JSON stringify with optional spacing
   */
  json: (obj, spacing = 0) => {
    try {
      return JSON.stringify(obj, null, spacing);
    } catch {
      return '';
    }
  },

  /**
   * Conditional: if
   */
  if: (condition, thenValue, elseValue = '') => {
    return condition ? thenValue : elseValue;
  },

  /**
   * Conditional: unless
   */
  unless: (condition, thenValue, elseValue = '') => {
    return condition ? elseValue : thenValue;
  },

  /**
   * Array map/transform
   */
  map: (arr, fn) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item, index) => fn(item, index));
  },

  /**
   * Array filter
   */
  filter: (arr, fn) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((item, index) => fn(item, index));
  },

  /**
   * Get current timestamp
   */
  now: (format = 'iso') => {
    const date = new Date();
    if (format === 'iso') return date.toISOString();
    if (format === 'date') return date.toLocaleDateString();
    if (format === 'time') return date.toLocaleTimeString();
    return date.toString();
  },

  /**
   * Module name utilities
   */
  normalizeModuleName: (moduleName) => {
    if (typeof moduleName !== 'string') return '';
    return moduleName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase();
  },

  /**
   * Get plural form
   */
  plural: (count, singular, plural = singular + 's') => {
    return count === 1 ? singular : plural;
  },
};

/**
 * Template Engine class
 */
class TemplateEngine {
  /**
   * Create a new TemplateEngine
   * @param {Object} options - Engine options
   */
  constructor(options = {}) {
    this.delimiters = { ...DEFAULT_DELIMITERS, ...options.delimiters };
    this.helpers = { ...HELPERS, ...options.helpers };
    this.partials = new Map();
    this.layouts = new Map();
    this.cache = new Map();
    this.enableCache = options.enableCache !== false;
  }

  /**
   * Register a helper function
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error(`Helper "${name}" must be a function`);
    }
    this.helpers[name] = fn;
  }

  /**
   * Register multiple helpers
   * @param {Object} helpers - Object of helper functions
   */
  registerHelpers(helpers) {
    for (const [name, fn] of Object.entries(helpers)) {
      this.registerHelper(name, fn);
    }
  }

  /**
   * Register a partial template
   * @param {string} name - Partial name
   * @param {string} template - Template content
   */
  registerPartial(name, template) {
    this.partials.set(name, template);
  }

  /**
   * Register multiple partials
   * @param {Object} partials - Object of partial templates
   */
  registerPartials(partials) {
    for (const [name, template] of Object.entries(partials)) {
      this.registerPartial(name, template);
    }
  }

  /**
   * Register a layout template
   * @param {string} name - Layout name
   * @param {string} template - Template content
   */
  registerLayout(name, template) {
    this.layouts.set(name, template);
  }

  /**
   * Load partials from a directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Loading options
   */
  loadPartials(dirPath, options = {}) {
    const { extension = '.ejs', recursive = true } = options;

    if (!fs.existsSync(dirPath)) {
      logger.warn(`Partials directory not found: ${dirPath}`);
      return this;
    }

    const loadDir = (dir) => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && recursive) {
          loadDir(filePath);
        } else if (file.endsWith(extension)) {
          const name = file.replace(extension, '');
          const template = fs.readFileSync(filePath, 'utf8');
          this.registerPartial(name, template);
        }
      }
    };

    loadDir(dirPath);
    return this;
  }

  /**
   * Get cached template or compile if not cached
   * @param {string} template - Template content
   * @returns {Function} Compiled template function
   */
  _getCompiled(template) {
    if (this.enableCache && this.cache.has(template)) {
      return this.cache.get(template);
    }

    const compiled = this._compile(template);

    if (this.enableCache) {
      this.cache.set(template, compiled);
    }

    return compiled;
  }

  /**
   * Compile template to function
   * @param {string} template - Template content
   * @returns {Function}
   */
  _compile(template) {
    const { interpolate, evaluate, escape } = this.delimiters;

    // Escape special regex characters in delimiters
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Standard closing is %>
    const closing = '%>';

    // Create regex patterns for matching template delimiters
    const interpolateRegex = new RegExp(`${escapeRegExp(interpolate)}([\\s\\S]+?)${escapeRegExp(closing)}`, 'g');
    const evaluateRegex = new RegExp(`${escapeRegExp(evaluate)}([\\s\\S]+?)${escapeRegExp(closing)}`, 'g');
    const escapeRegex = new RegExp(`${escapeRegExp(escape)}([\\s\\S]+?)${escapeRegExp(closing)}`, 'g');

    // Replace delimiters with JavaScript code
    let code = template;

    // Process escape first (raw output)
    code = code.replace(escapeRegex, (_, expr) => {
      return `', (${expr}), '`;
    });

    // Process interpolate (HTML escaped output)
    code = code.replace(interpolateRegex, (_, expr) => {
      return `', __escape(${expr}), '`;
    });

    // Process evaluate (raw JavaScript)
    code = code.replace(evaluateRegex, (_, expr) => {
      return `');\n${expr}\n__output.push('`;
    });

    // Handle include/partial syntax: <%- include('partialName') %>
    code = code.replace(/<%-\s*include\(['"]([^'"]+)['"]\)\s*%>/g, (_, partialName) => {
      return `', __renderPartial('${partialName}', __data), '`;
    });

    // Handle layout syntax: <%- layout('layoutName') %>
    code = code.replace(/<%-\s*layout\(['"]([^'"]+)['"]\)\s*%>/g, (_, layoutName) => {
      return `', __renderLayout('${layoutName}', __data, __content), '`;
    });

    // Handle each loop: <%- each(items, (item, index) => ... ) %>
    code = code.replace(/<%-\s*each\(([^)]+)\)\s*%>/g, (_, args) => {
      // Simple transformation for each loops
      return `');\n__helpers.each(${args}, (item, index) => {\n__output.push('`;
    });
    code = code.replace(/<%-\s*endeach\s*%>/g, () => {
      return `');\n});\n__output.push('`;
    });

    // Build the template function
    // Note: Not using strict mode because 'with' statement is not allowed in strict mode
    const functionBody = `
      var __output = [];
      var __escape = function(value) {
        if (value === null || value === undefined) return '';
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };
      var __helpers = {
        e: function(value) { return __escape(value); },
        h: function(value) { return __escape(value); },
        each: function(arr, fn) {
          if (!Array.isArray(arr)) return;
          for (var i = 0; i < arr.length; i++) {
            fn(arr[i], i);
          }
        }
      };
      var __renderPartial = function(name, data) {
        var partial = __partials[name];
        if (!partial) return '[Partial not found: ' + name + ']';
        var partialData = Object.assign({}, __data, data || {});
        var fn = __engine._getCompiled(partial);
        return fn(partialData);
      };
      var __renderLayout = function(name, data, content) {
        var layout = __layouts[name];
        if (!layout) return content;
        var layoutData = Object.assign({}, data, { __content: content });
        var fn = __engine._getCompiled(layout);
        return fn(layoutData);
      };
      var __partials = ${JSON.stringify(Object.fromEntries(this.partials))};
      var __layouts = ${JSON.stringify(Object.fromEntries(this.layouts))};
      var __engine = this;
      var __data = data || {};

      with (__data) {
        with (__helpers) {
          with (Object.keys(__data)) {
            __output.push('${code}');
          }
        }
      }

      return __output.join('');
    `;

    try {
      return new Function('data', functionBody).bind(this);
    } catch (error) {
      logger.error('Template compilation error:', error.message);
      throw new Error(`Failed to compile template: ${error.message}`);
    }
  }

  /**
   * Render template with data
   * @param {string} template - Template content
   * @param {Object} data - Data to render
   * @returns {string}
   */
  render(template, data = {}) {
    const helpers = { ...this.helpers };
    const mergedData = { ...data };

    // Add helpers to data scope
    for (const [name, fn] of Object.entries(helpers)) {
      if (!mergedData.hasOwnProperty(name)) {
        mergedData[name] = fn;
      }
    }

    // Add helper for includes
    mergedData.include = (partialName, partialData) => {
      const partial = this.partials.get(partialName);
      if (!partial) return `[Partial not found: ${partialName}]`;
      const compiled = this._getCompiled(partial);
      return compiled({ ...mergedData, ...partialData });
    };

    // Add helper for layouts
    mergedData.layout = (layoutName, layoutData, content) => {
      const layout = this.layouts.get(layoutName);
      if (!layout) return content;
      const compiled = this._getCompiled(layout);
      return compiled({ ...mergedData, ...layoutData, __content: content });
    };

    // Add each helper
    mergedData.each = (arr, fn) => {
      if (!Array.isArray(arr)) return '';
      let result = '';
      for (let i = 0; i < arr.length; i++) {
        result += fn(arr[i], i);
      }
      return result;
    };

    const compiled = this._getCompiled(template);
    return compiled(mergedData);
  }

  /**
   * Render template from file
   * @param {string} filePath - Template file path
   * @param {Object} data - Data to render
   * @returns {string}
   */
  renderFile(filePath, data = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Template file not found: ${filePath}`);
    }

    const template = fs.readFileSync(filePath, 'utf8');
    return this.render(template, data);
  }

  /**
   * Clear template cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  getCacheSize() {
    return this.cache.size;
  }
}

/**
 * Create a template engine instance
 * @param {Object} options - Engine options
 * @returns {TemplateEngine}
 */
function createEngine(options = {}) {
  return new TemplateEngine(options);
}

// Default engine instance
const engine = new TemplateEngine();

module.exports = {
  TemplateEngine,
  createEngine,
  engine,
  HELPERS,
  DEFAULT_DELIMITERS,
};