const fs = require("fs-extra");
const path = require("path");

describe("Router Integration - Import Tests", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  test("should import path-resolver module", () => {
    const PathResolver = require("../../../lib/generator/shared/path-resolver");

    expect(PathResolver).toBeDefined();
    expect(typeof PathResolver.getModularRouterPath).toBe("function");
    expect(typeof PathResolver.getSimpleControllerPath).toBe("function");
    expect(typeof PathResolver.getModularRouterImportPath).toBe("function");
    expect(typeof PathResolver.getSimpleControllerImportPath).toBe("function");
    expect(typeof PathResolver.normalizeModuleName).toBe("function");
    expect(typeof PathResolver.ensureDirectoryExists).toBe("function");
    expect(typeof PathResolver.getModulePath).toBe("function");
    expect(typeof PathResolver.isValidPath).toBe("function");
  });

  test("should import file-validator module", () => {
    const FileValidator = require("../../../lib/generator/shared/file-validator");

    expect(FileValidator).toBeDefined();
    expect(typeof FileValidator.validateModularRouterFile).toBe("function");
    expect(typeof FileValidator.validateSimpleControllerFile).toBe("function");
    expect(typeof FileValidator.validateModuleDirectory).toBe("function");
    expect(typeof FileValidator.validateJavaScriptFile).toBe("function");
    expect(typeof FileValidator.validateRouterIntegration).toBe("function");
  });

  test("should import error-handler module", () => {
    const ErrorHandler = require("../../../lib/generator/shared/error-handler");

    expect(ErrorHandler).toBeDefined();
    expect(typeof ErrorHandler.createError).toBe("function");
    expect(typeof ErrorHandler.handleError).toBe("function");
    expect(typeof ErrorHandler.formatError).toBe("function");
    expect(typeof ErrorHandler.logToFile).toBe("function");
    expect(typeof ErrorHandler.handleRouterIntegrationErrors).toBe("function");
    expect(typeof ErrorHandler.handleModuleValidationError).toBe("function");
    expect(typeof ErrorHandler.handleFileNotFoundError).toBe("function");
    expect(typeof ErrorHandler.handleFileCreationError).toBe("function");
    expect(typeof ErrorHandler.handleInvalidPathError).toBe("function");
    expect(typeof ErrorHandler.displayUserFriendlyError).toBe("function");
    expect(typeof ErrorHandler.getSuggestion).toBe("function");
    expect(ErrorHandler.ERROR_TYPES).toBeDefined();
  });

  test("should import router module", () => {
    const { integrateRouter } = require("../../../lib/generator/router/router");

    expect(integrateRouter).toBeDefined();
    expect(typeof integrateRouter).toBe("function");
  });

  test("should import modular.arch module", () => {
    const { modularArch } = require("../../../lib/generator/module/arch/modular.arch");

    expect(modularArch).toBeDefined();
    expect(typeof modularArch).toBe("function");
  });

  test("should import simple.arch module", () => {
    const { simpleArch } = require("../../../lib/generator/module/arch/simple.arch");

    expect(simpleArch).toBeDefined();
    expect(typeof simpleArch).toBe("function");
  });

  test("should import utils module with normalizeModuleName function", () => {
    const utils = require("../../../lib/utils");

    expect(utils).toBeDefined();
    expect(typeof utils.normalizeModuleName).toBe("function");
  });

  test("should import constants module", () => {
    const constants = require("../../../lib/constants");

    expect(constants).toBeDefined();
    expect(constants.basePath).toBeDefined();
    expect(constants.modulesPath).toBeDefined();
    expect(constants.sharedPath).toBeDefined();
  });
});
