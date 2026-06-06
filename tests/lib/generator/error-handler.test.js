const fs = require('fs');
const path = require('path');
const ErrorHandler = require('../../../lib/generator/shared/error-handler');

// Mock dependencies
jest.mock('fs');

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  describe('createError', () => {
    test('should create custom error with type, message, and details', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      const details = { key: 'value' };
      
      const error = ErrorHandler.createError(type, message, details);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(type);
      expect(error.message).toBe(message);
      expect(error.details).toEqual(details);
      expect(error.timestamp).toBeDefined();
    });

    test('should create custom error with empty details', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      
      const error = ErrorHandler.createError(type, message);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe(type);
      expect(error.message).toBe(message);
      expect(error.details).toEqual({});
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('handleError', () => {
    test('should log error and rethrow when shouldThrow is true', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      const details = { key: 'value' };
      const context = 'Test Context';
      
      const error = ErrorHandler.createError(type, message, details);
      
      // Mock console.error
      console.error = jest.fn();
      
      // Mock logToFile
      ErrorHandler.logToFile = jest.fn();
      
      expect(() => {
        ErrorHandler.handleError(error, context, true);
      }).toThrow(error);
      
      expect(console.error).toHaveBeenCalledWith(
        `❌ [${type}] ${context}: ${message}`
      );
      expect(console.error).toHaveBeenCalledWith(
        '   Details:', JSON.stringify(details, null, 2)
      );
      expect(ErrorHandler.logToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          message,
          context,
          details,
          timestamp: error.timestamp
        })
      );
    });

    test('should log error and not rethrow when shouldThrow is false', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      const details = { key: 'value' };
      const context = 'Test Context';
      
      const error = ErrorHandler.createError(type, message, details);
      
      // Mock console.error
      console.error = jest.fn();
      
      // Mock logToFile
      ErrorHandler.logToFile = jest.fn();
      
      const result = ErrorHandler.handleError(error, context, false);
      
      expect(result).toEqual(
        expect.objectContaining({
          type,
          message,
          context,
          details,
          timestamp: error.timestamp
        })
      );
      
      expect(console.error).toHaveBeenCalledWith(
        `❌ [${type}] ${context}: ${message}`
      );
      expect(console.error).toHaveBeenCalledWith(
        '   Details:', JSON.stringify(details, null, 2)
      );
      expect(ErrorHandler.logToFile).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          message,
          context,
          details,
          timestamp: error.timestamp
        })
      );
    });
  });

  describe('formatError', () => {
    test('should format error with all fields', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      const details = { key: 'value' };
      const context = 'Test Context';
      const stack = 'Error stack trace';
      const timestamp = '2023-01-01T00:00:00.000Z';
      
      const error = {
        type,
        message,
        details,
        stack,
        timestamp
      };
      
      const formattedError = ErrorHandler.formatError(error, context);
      
      expect(formattedError).toEqual({
        type,
        message,
        context,
        details,
        stack,
        timestamp
      });
    });

    test('should format error with missing fields', () => {
      const message = 'Test error message';
      const context = 'Test Context';
      
      const error = {
        message
      };
      
      const formattedError = ErrorHandler.formatError(error, context);
      
      expect(formattedError).toEqual({
        type: ErrorHandler.ERROR_TYPES.UNKNOWN_ERROR,
        message,
        context,
        details: {},
        stack: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('logToFile', () => {
    test('should be a function', () => {
      expect(typeof ErrorHandler.logToFile).toBe('function');
    });
  });

  describe('handleRouterIntegrationErrors', () => {
    test('should create and handle router integration error', () => {
      const errors = ['Error 1', 'Error 2'];
      const modules = ['module1', 'module2'];
      const context = 'Test Context';
      
      // Mock createError
      ErrorHandler.createError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.ROUTER_INTEGRATION,
        message: `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
        details: { errors, failedModules: modules }
      });
      
      // Mock handleError
      ErrorHandler.handleError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.ROUTER_INTEGRATION,
        message: `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
        details: { errors, failedModules: modules }
      });
      
      const result = ErrorHandler.handleRouterIntegrationErrors(errors, modules, context);
      
      expect(ErrorHandler.createError).toHaveBeenCalledWith(
        ErrorHandler.ERROR_TYPES.ROUTER_INTEGRATION,
        `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
        { errors, failedModules: modules }
      );
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.ROUTER_INTEGRATION,
          message: `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
          details: { errors, failedModules: modules }
        }),
        context,
        false
      );
      
      expect(result).toEqual(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.ROUTER_INTEGRATION,
          message: `Gagal mengintegrasikan ${modules.length} modul: ${modules.join(', ')}`,
          details: { errors, failedModules: modules }
        })
      );
    });

    test('should return null when no errors', () => {
      const errors = [];
      const modules = ['module1', 'module2'];
      
      const result = ErrorHandler.handleRouterIntegrationErrors(errors, modules);
      
      expect(result).toBeUndefined();
    });
  });

  describe('handleModuleValidationError', () => {
    test('should create and handle module validation error', () => {
      const moduleName = 'testModule';
      const validationError = 'Validation failed';
      const context = 'Test Context';
      
      // Mock createError
      ErrorHandler.createError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.MODULE_VALIDATION,
        message: `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
        details: { moduleName, originalError: validationError }
      });
      
      // Mock handleError
      ErrorHandler.handleError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.MODULE_VALIDATION,
        message: `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
        details: { moduleName, originalError: validationError }
      });
      
      const result = ErrorHandler.handleModuleValidationError(moduleName, validationError, context);
      
      expect(ErrorHandler.createError).toHaveBeenCalledWith(
        ErrorHandler.ERROR_TYPES.MODULE_VALIDATION,
        `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
        { moduleName, originalError: validationError }
      );
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.MODULE_VALIDATION,
          message: `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
          details: { moduleName, originalError: validationError }
        }),
        context,
        false
      );
      
      expect(result).toEqual(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.MODULE_VALIDATION,
          message: `Validasi modul gagal untuk '${moduleName}': ${validationError}`,
          details: { moduleName, originalError: validationError }
        })
      );
    });
  });

  describe('handleFileNotFoundError', () => {
    test('should create and handle file not found error', () => {
      const filePath = '/path/to/file.js';
      const context = 'Test Context';
      
      // Mock createError
      ErrorHandler.createError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.FILE_NOT_FOUND,
        message: `File tidak ditemukan: ${filePath}`,
        details: { filePath }
      });
      
      // Mock handleError
      ErrorHandler.handleError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.FILE_NOT_FOUND,
        message: `File tidak ditemukan: ${filePath}`,
        details: { filePath }
      });
      
      const result = ErrorHandler.handleFileNotFoundError(filePath, context);
      
      expect(ErrorHandler.createError).toHaveBeenCalledWith(
        ErrorHandler.ERROR_TYPES.FILE_NOT_FOUND,
        `File tidak ditemukan: ${filePath}`,
        { filePath }
      );
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.FILE_NOT_FOUND,
          message: `File tidak ditemukan: ${filePath}`,
          details: { filePath }
        }),
        context,
        false
      );
      
      expect(result).toEqual(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.FILE_NOT_FOUND,
          message: `File tidak ditemukan: ${filePath}`,
          details: { filePath }
        })
      );
    });
  });

  describe('handleFileCreationError', () => {
    test('should create and handle file creation error', () => {
      const filePath = '/path/to/file.js';
      const originalError = new Error('Failed to create file');
      const context = 'Test Context';
      
      // Mock createError
      ErrorHandler.createError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.FILE_CREATION,
        message: `Gagal membuat file: ${filePath}`,
        details: { filePath, originalError: originalError.message }
      });
      
      // Mock handleError
      ErrorHandler.handleError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.FILE_CREATION,
        message: `Gagal membuat file: ${filePath}`,
        details: { filePath, originalError: originalError.message }
      });
      
      const result = ErrorHandler.handleFileCreationError(filePath, originalError, context);
      
      expect(ErrorHandler.createError).toHaveBeenCalledWith(
        ErrorHandler.ERROR_TYPES.FILE_CREATION,
        `Gagal membuat file: ${filePath}`,
        { filePath, originalError: originalError.message }
      );
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.FILE_CREATION,
          message: `Gagal membuat file: ${filePath}`,
          details: { filePath, originalError: originalError.message }
        }),
        context,
        false
      );
      
      expect(result).toEqual(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.FILE_CREATION,
          message: `Gagal membuat file: ${filePath}`,
          details: { filePath, originalError: originalError.message }
        })
      );
    });
  });

  describe('handleInvalidPathError', () => {
    test('should create and handle invalid path error', () => {
      const filePath = '/invalid/path';
      const context = 'Test Context';
      
      // Mock createError
      ErrorHandler.createError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.INVALID_PATH,
        message: `Path tidak valid: ${filePath}`,
        details: { filePath }
      });
      
      // Mock handleError
      ErrorHandler.handleError = jest.fn().mockReturnValue({
        type: ErrorHandler.ERROR_TYPES.INVALID_PATH,
        message: `Path tidak valid: ${filePath}`,
        details: { filePath }
      });
      
      const result = ErrorHandler.handleInvalidPathError(filePath, context);
      
      expect(ErrorHandler.createError).toHaveBeenCalledWith(
        ErrorHandler.ERROR_TYPES.INVALID_PATH,
        `Path tidak valid: ${filePath}`,
        { filePath }
      );
      
      expect(ErrorHandler.handleError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.INVALID_PATH,
          message: `Path tidak valid: ${filePath}`,
          details: { filePath }
        }),
        context,
        false
      );
      
      expect(result).toEqual(
        expect.objectContaining({
          type: ErrorHandler.ERROR_TYPES.INVALID_PATH,
          message: `Path tidak valid: ${filePath}`,
          details: { filePath }
        })
      );
    });
  });

  describe('displayUserFriendlyError', () => {
    test('should display user-friendly error message', () => {
      const type = 'TEST_ERROR';
      const message = 'Test error message';
      const context = 'Test Context';
      
      const error = {
        type,
        message
      };
      
      // Mock console.log
      console.log = jest.fn();
      
      // Mock getSuggestion
      ErrorHandler.getSuggestion = jest.fn().mockReturnValue('Test suggestion');
      
      ErrorHandler.displayUserFriendlyError(error, context);
      
      expect(console.log).toHaveBeenCalledWith('\n❌ Terjadi kesalahan:');
      expect(console.log).toHaveBeenCalledWith(`   Operasi: ${context}`);
      expect(console.log).toHaveBeenCalledWith(`   Pesan: ${message}`);
      expect(console.log).toHaveBeenCalledWith('\n💡 Saran perbaikan:');
      expect(console.log).toHaveBeenCalledWith(`   Test suggestion`);
      expect(console.log).toHaveBeenCalledWith('');
    });
  });

  describe('getSuggestion', () => {
    test('should have suggestions defined', () => {
      // Check if ERROR_TYPES is defined
      expect(ErrorHandler.ERROR_TYPES).toBeDefined();
      
      // Check if getSuggestion function exists
      expect(typeof ErrorHandler.getSuggestion).toBe('function');
    });
  });
});