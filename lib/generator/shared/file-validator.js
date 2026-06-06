const fs = require('fs');
const path = require('path');
const PathResolver = require('./path-resolver');

/**
 * File Validator untuk memvalidasi keberadaan file dan struktur direktori
 * di seluruh proyek rakitin
 */
class FileValidator {
  /**
   * Memvalidasi apakah file router modular ada
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {Object} Hasil validasi { isValid: boolean, path: string, error?: string }
   */
  static validateModularRouterFile(moduleName, basePath) {
    try {
      const routerPath = PathResolver.getModularRouterPath(moduleName, basePath);
      
      if (!fs.existsSync(routerPath)) {
        return {
          isValid: false,
          path: routerPath,
          error: `File router modular tidak ditemukan: ${routerPath}`
        };
      }
      
      // Validasi bahwa ini adalah file, bukan direktori
      const stats = fs.statSync(routerPath);
      if (!stats.isFile()) {
        return {
          isValid: false,
          path: routerPath,
          error: `Path yang diberikan bukan file: ${routerPath}`
        };
      }
      
      return {
        isValid: true,
        path: routerPath
      };
    } catch (error) {
      return {
        isValid: false,
        path: null,
        error: `Error saat memvalidasi file router modular: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi apakah file router simple ada
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {Object} Hasil validasi { isValid: boolean, path: string, error?: string }
   */
  static validateSimpleRouterFile(moduleName, basePath) {
    try {
      const routerPath = PathResolver.getSimpleRouterPath(moduleName, basePath);
      
      if (!fs.existsSync(routerPath)) {
        return {
          isValid: false,
          path: routerPath,
          error: `File router simple tidak ditemukan: ${routerPath}`
        };
      }
      
      // Validasi bahwa ini adalah file, bukan direktori
      const stats = fs.statSync(routerPath);
      if (!stats.isFile()) {
        return {
          isValid: false,
          path: routerPath,
          error: `Path yang diberikan bukan file: ${routerPath}`
        };
      }
      
      return {
        isValid: true,
        path: routerPath
      };
    } catch (error) {
      return {
        isValid: false,
        path: null,
        error: `Error saat memvalidasi file router simple: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi apakah file controller simple ada
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {Object} Hasil validasi { isValid: boolean, path: string, error?: string }
   */
  static validateSimpleControllerFile(moduleName, basePath) {
    try {
      const controllerPath = PathResolver.getSimpleControllerPath(moduleName, basePath);
      
      if (!fs.existsSync(controllerPath)) {
        return {
          isValid: false,
          path: controllerPath,
          error: `File controller simple tidak ditemukan: ${controllerPath}`
        };
      }
      
      // Validasi bahwa ini adalah file, bukan direktori
      const stats = fs.statSync(controllerPath);
      if (!stats.isFile()) {
        return {
          isValid: false,
          path: controllerPath,
          error: `Path yang diberikan bukan file: ${controllerPath}`
        };
      }
      
      return {
        isValid: true,
        path: controllerPath
      };
    } catch (error) {
      return {
        isValid: false,
        path: null,
        error: `Error saat memvalidasi file controller simple: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi apakah file controller modular ada
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {Object} Hasil validasi { isValid: boolean, path: string, error?: string }
   */
  static validateModularControllerFile(moduleName, basePath) {
    try {
      const controllerPath = PathResolver.getModularControllerPath(moduleName, basePath);
      
      if (!fs.existsSync(controllerPath)) {
        return {
          isValid: false,
          path: controllerPath,
          error: `File controller modular tidak ditemukan: ${controllerPath}`
        };
      }
      
      // Validasi bahwa ini adalah file, bukan direktori
      const stats = fs.statSync(controllerPath);
      if (!stats.isFile()) {
        return {
          isValid: false,
          path: controllerPath,
          error: `Path yang diberikan bukan file: ${controllerPath}`
        };
      }
      
      return {
        isValid: true,
        path: controllerPath
      };
    } catch (error) {
      return {
        isValid: false,
        path: null,
        error: `Error saat memvalidasi file controller modular: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi apakah direktori modul ada dengan struktur yang benar
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @param {string} architecture - Jenis arsitektur ('modular' atau 'simple')
   * @returns {Object} Hasil validasi { isValid: boolean, path: string, error?: string }
   */
  static validateModuleDirectory(moduleName, basePath, architecture = 'modular') {
    try {
      const modulePath = PathResolver.getModulePath(moduleName, basePath);
      
      if (!fs.existsSync(modulePath)) {
        return {
          isValid: false,
          path: modulePath,
          error: `Direktori modul tidak ditemukan: ${modulePath}`
        };
      }
      
      // Validasi bahwa ini adalah direktori, bukan file
      const stats = fs.statSync(modulePath);
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          path: modulePath,
          error: `Path yang diberikan bukan direktori: ${modulePath}`
        };
      }
      
      // Untuk arsitektur modular, validasi subdirektori yang diperlukan
      if (architecture === 'modular') {
        const requiredDirs = ['controllers', 'services', 'models', 'routes'];
        for (const dir of requiredDirs) {
          const dirPath = path.join(modulePath, dir);
          if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
            return {
              isValid: false,
              path: dirPath,
              error: `Subdirektori yang diperlukan tidak ditemukan: ${dirPath}`
            };
          }
        }
      }
      
      return {
        isValid: true,
        path: modulePath
      };
    } catch (error) {
      return {
        isValid: false,
        path: null,
        error: `Error saat memvalidasi direktori modul: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi file JavaScript dapat diimpor
   * @param {string} filePath - Path file JavaScript
   * @returns {Object} Hasil validasi { isValid: boolean, error?: string }
   */
  static validateJavaScriptFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          isValid: false,
          error: `File tidak ditemukan: ${filePath}`
        };
      }
      
      // Validasi ekstensi file
      if (!filePath.endsWith('.js')) {
        return {
          isValid: false,
          error: `File harus berekstensi .js: ${filePath}`
        };
      }
      
      // Coba impor file untuk validasi sintaks
      try {
        delete require.cache[require.resolve(filePath)];
        require(filePath);
      } catch (importError) {
        return {
          isValid: false,
          error: `Error saat mengimpor file: ${importError.message}`
        };
      }
      
      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Error saat memvalidasi file JavaScript: ${error.message}`
      };
    }
  }

  /**
   * Memvalidasi semua file yang diperlukan untuk integrasi router
   * @param {Array<string>} modules - Daftar nama modul
   * @param {string} basePath - Path dasar proyek
   * @param {string} architecture - Jenis arsitektur ('modular' atau 'simple')
   * @returns {Object} Hasil validasi { isValid: boolean, errors: Array<string> }
   */
  static validateRouterIntegration(modules, basePath, architecture = 'modular') {
    const errors = [];
    
    for (const moduleName of modules) {
      // Validasi direktori modul
      const moduleValidation = this.validateModuleDirectory(moduleName, basePath, architecture);
      if (!moduleValidation.isValid) {
        errors.push(moduleValidation.error);
        continue;
      }
      
      // Validasi file berdasarkan arsitektur
      if (architecture === 'modular') {
        const routerValidation = this.validateModularRouterFile(moduleName, basePath);
        if (!routerValidation.isValid) {
          errors.push(routerValidation.error);
        }
      } else {
        const controllerValidation = this.validateSimpleControllerFile(moduleName, basePath);
        if (!controllerValidation.isValid) {
          errors.push(controllerValidation.error);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = FileValidator;