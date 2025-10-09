const fs = require('fs');
const path = require('path');

/**
 * Error Handler untuk menangani error dengan konsisten
 * di seluruh proyek rakitin
 */
class ErrorHandler {
  /**
   * Jenis-jenis error yang dikenali
   */
  static ERROR_TYPES = {
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    INVALID_PATH: 'INVALID_PATH',
    MODULE_VALIDATION: 'MODULE_VALIDATION',
    ROUTER_INTEGRATION: 'ROUTER_INTEGRATION',
    FILE_CREATION: 'FILE_CREATION',
    DIRECTORY_CREATION: 'DIRECTORY_CREATION',
    IMPORT_ERROR: 'IMPORT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  /**
   * Membuat custom error dengan jenis yang spesifik
   * @param {string} type - Jenis error
   * @param {string} message - Pesan error
   * @param {Object} details - Detail tambahan error
   * @returns {Error} Custom error object
   */
  static createError(type, message, details = {}) {
    const error = new Error(message);
    error.type = type;
    error.details = details;
    error.timestamp = new Date().toISOString();
    
    return error;
  }

  /**
   * Menangani error dengan logging dan format yang konsisten
   * @param {Error} error - Error yang akan ditangani
   * @param {string} context - Konteks terjadinya error
   * @param {boolean} shouldThrow - Apakah error harus dilempar kembali
   * @returns {Object} Informasi error yang sudah diformat
   */
  static handleError(error, context = 'Unknown', shouldThrow = true) {
    const errorInfo = this.formatError(error, context);
    
    // Log error ke konsol
    console.error(`❌ [${errorInfo.type}] ${errorInfo.context}: ${errorInfo.message}`);
    
    if (errorInfo.details && Object.keys(errorInfo.details).length > 0) {
      console.error('   Details:', JSON.stringify(errorInfo.details, null, 2));
    }
    
    // Log ke file jika diperlukan
    this.logToFile(errorInfo);
    
    if (shouldThrow) {
      throw error;
    }
    
    return errorInfo;
  }

  /**
   * Memformat error untuk konsistensi
   * @param {Error} error - Error yang akan diformat
   * @param {string} context - Konteks terjadinya error
   * @returns {Object} Error yang sudah diformat
   */
  static formatError(error, context) {
    return {
      type: error.type || this.ERROR_TYPES.UNKNOWN_ERROR,
      message: error.message,
      context,
      stack: error.stack,
      details: error.details || {},
      timestamp: error.timestamp || new Date().toISOString()
    };
  }

  /**
   * Menyimpan log error ke file
   * @param {Object} errorInfo - Informasi error yang akan disimpan
   */
  static logToFile(errorInfo) {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logFile = path.join(logDir, 'rakitin-errors.log');
      const logEntry = `${errorInfo.timestamp} [${errorInfo.type}] ${errorInfo.context}: ${errorInfo.message}\n`;
      
      fs.appendFileSync(logFile, logEntry, 'utf8');
    } catch (logError) {
      // Jangan lempar error saat mencoba menulis log
      console.warn('⚠️  Gagal menulis error log:', logError.message);
    }
  }

  /**
   * Menangani error saat integrasi router
   * @param {Array<string>} errors - Daftar error yang terjadi
   * @param {Array<string>} modules - Daftar modul yang gagal diintegrasikan
   * @param {string} context - Konteks error
   */
  static handleRouterIntegrationErrors(errors, modules, context = 'Router Integration') {
    if (errors.length === 0) return;
    
    const error = this.createError(
      this.ERROR_TYPES.ROUTER_INTEGRATION,
      `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
      { errors, failedModules: modules }
    );
    
    return this.handleError(error, context, false);
  }

  /**
   * Menangani error validasi modul
   * @param {string} moduleName - Nama modul
   * @param {string} validationError - Pesan error validasi
   * @param {string} context - Konteks error
   */
  static handleModuleValidationError(moduleName, validationError, context = 'Module Validation') {
    const error = this.createError(
      this.ERROR_TYPES.MODULE_VALIDATION,
      `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
      { moduleName, originalError: validationError }
    );
    
    return this.handleError(error, context, false);
  }

  /**
   * Menangani error file tidak ditemukan
   * @param {string} filePath - Path file yang tidak ditemukan
   * @param {string} context - Konteks error
   */
  static handleFileNotFoundError(filePath, context = 'File Operation') {
    const error = this.createError(
      this.ERROR_TYPES.FILE_NOT_FOUND,
      `File tidak ditemukan: ${filePath}`,
      { filePath }
    );
    
    return this.handleError(error, context, false);
  }

  /**
   * Menangani error pembuatan file
   * @param {string} filePath - Path file yang gagal dibuat
   * @param {Error} originalError - Error asli
   * @param {string} context - Konteks error
   */
  static handleFileCreationError(filePath, originalError, context = 'File Creation') {
    const error = this.createError(
      this.ERROR_TYPES.FILE_CREATION,
      `Gagal membuat file: ${filePath}`,
      { filePath, originalError: originalError.message }
    );
    
    return this.handleError(error, context, false);
  }

  /**
   * Menangani error path tidak valid
   * @param {string} filePath - Path yang tidak valid
   * @param {string} context - Konteks error
   */
  static handleInvalidPathError(filePath, context = 'Path Resolution') {
    const error = this.createError(
      this.ERROR_TYPES.INVALID_PATH,
      `Path tidak valid: ${filePath}`,
      { filePath }
    );
    
    return this.handleError(error, context, false);
  }

  /**
   * Menampilkan pesan error yang user-friendly
   * @param {Error} error - Error yang akan ditampilkan
   * @param {string} context - Konteks error
   */
  static displayUserFriendlyError(error, context = 'Operation') {
    const errorInfo = this.formatError(error, context);
    
    console.log('\n❌ Terjadi kesalahan:');
    console.log(`   Operasi: ${errorInfo.context}`);
    console.log(`   Pesan: ${errorInfo.message}`);
    
    // Tampilkan saran perbaikan berdasarkan jenis error
    const suggestion = this.getSuggestion(errorInfo.type);
    if (suggestion) {
      console.log(`\n💡 Saran perbaikan:`);
      console.log(`   ${suggestion}`);
    }
    
    console.log('');
  }

  /**
   * Mendapatkan saran perbaikan berdasarkan jenis error
   * @param {string} errorType - Jenis error
   * @returns {string|null} Saran perbaikan
   */
  static getSuggestion(errorType) {
    const suggestions = {
      [this.ERROR_TYPES.FILE_NOT_FOUND]: 'Periksa kembali path file dan pastikan file tersebut ada.',
      [this.ERROR_TYPES.INVALID_PATH]: 'Pastikan format path yang diberikan valid.',
      [this.ERROR_TYPES.MODULE_VALIDATION]: 'Periksa kembali nama modul dan parameter yang diberikan.',
      [this.ERROR_TYPES.ROUTER_INTEGRATION]: 'Pastikan semua file yang diperlukan sudah ada dan valid.',
      [this.ERROR_TYPES.FILE_CREATION]: 'Periksa izin akses direktori dan pastikan path valid.',
      [this.ERROR_TYPES.DIRECTORY_CREATION]: 'Periksa izin akses dan pastikan parent directory ada.',
      [this.ERROR_TYPES.IMPORT_ERROR]: 'Periksa sintaks file dan dependensi yang diperlukan.',
      [this.ERROR_TYPES.VALIDATION_ERROR]: 'Periksa kembali input yang diberikan.'
    };
    
    return suggestions[errorType] || 'Periksa kembali konfigurasi dan input yang diberikan.';
  }
}

module.exports = ErrorHandler;