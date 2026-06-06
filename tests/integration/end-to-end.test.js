const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const index = require('../../index');

// Mock dependencies
jest.mock('inquirer');
jest.mock('../../lib/prompt');
jest.mock('../../lib/generator/module/module');
jest.mock('../../lib/generator/middleware/middleware');
jest.mock('../../lib/generator/util/util');
jest.mock('../../lib/generator/config/config');
jest.mock('../../lib/generator/router/router');

const { mainPrompt } = require('../../lib/prompt');
const generateModule = require('../../lib/generator/module/module');
const generateMiddleware = require('../../lib/generator/middleware/middleware');
const generateUtil = require('../../lib/generator/util/util');
const generateConfig = require('../../lib/generator/config/config');
const { integrateRouter } = require('../../lib/generator/router/router');

describe('End-to-End Integration Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock console.log to reduce noise
    console.log = jest.fn();
    console.error = jest.fn();
  });

  test('should handle module generation flow', async () => {
    // Mock mainPrompt to return Module
    mainPrompt.mockResolvedValue({ feature: 'Module' });
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateModule was called
    expect(generateModule).toHaveBeenCalledTimes(1);
    
    // Verify other generators were not called
    expect(generateMiddleware).not.toHaveBeenCalled();
    expect(generateUtil).not.toHaveBeenCalled();
    expect(generateConfig).not.toHaveBeenCalled();
    expect(integrateRouter).not.toHaveBeenCalled();
  });

  test('should handle middleware generation flow', async () => {
    // Mock mainPrompt to return Middleware
    mainPrompt.mockResolvedValue({ feature: 'Middleware' });
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateMiddleware was called
    expect(generateMiddleware).toHaveBeenCalledTimes(1);
    
    // Verify other generators were not called
    expect(generateModule).not.toHaveBeenCalled();
    expect(generateUtil).not.toHaveBeenCalled();
    expect(generateConfig).not.toHaveBeenCalled();
    expect(integrateRouter).not.toHaveBeenCalled();
  });

  test('should handle util generation flow', async () => {
    // Mock mainPrompt to return Util
    mainPrompt.mockResolvedValue({ feature: 'Util' });
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateUtil was called
    expect(generateUtil).toHaveBeenCalledTimes(1);
    
    // Verify other generators were not called
    expect(generateModule).not.toHaveBeenCalled();
    expect(generateMiddleware).not.toHaveBeenCalled();
    expect(generateConfig).not.toHaveBeenCalled();
    expect(integrateRouter).not.toHaveBeenCalled();
  });

  test('should handle config generation flow', async () => {
    // Mock mainPrompt to return Config
    mainPrompt.mockResolvedValue({ feature: 'Config' });
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateConfig was called
    expect(generateConfig).toHaveBeenCalledTimes(1);
    
    // Verify other generators were not called
    expect(generateModule).not.toHaveBeenCalled();
    expect(generateMiddleware).not.toHaveBeenCalled();
    expect(generateUtil).not.toHaveBeenCalled();
    expect(integrateRouter).not.toHaveBeenCalled();
  });

  test('should handle router integration flow', async () => {
    // Mock mainPrompt to return Router Integration
    mainPrompt.mockResolvedValue({ feature: 'Router Integration' });
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify integrateRouter was called
    expect(integrateRouter).toHaveBeenCalledTimes(1);
    
    // Verify other generators were not called
    expect(generateModule).not.toHaveBeenCalled();
    expect(generateMiddleware).not.toHaveBeenCalled();
    expect(generateUtil).not.toHaveBeenCalled();
    expect(generateConfig).not.toHaveBeenCalled();
  });

  test('should handle cancellation flow', async () => {
    // Mock mainPrompt to throw ExitPromptError
    const exitPromptError = new Error('ExitPromptError');
    exitPromptError.name = 'ExitPromptError';
    mainPrompt.mockRejectedValue(exitPromptError);
    
    // Mock console.log to capture output
    console.log = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify console.log was called with cancellation message
    expect(console.log).toHaveBeenCalledWith('❌ Proses dibatalkan oleh pengguna.');
  });

  test('should handle SIGINT flow', async () => {
    // Mock mainPrompt to throw SIGINT error
    const sigintError = new Error('SIGINT');
    mainPrompt.mockRejectedValue(sigintError);
    
    // Mock console.log to capture output
    console.log = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify console.log was called with cancellation message
    expect(console.log).toHaveBeenCalledWith('❌ Proses dibatalkan oleh pengguna.');
  });

  test('should handle general errors', async () => {
    // Mock mainPrompt to throw general error
    const generalError = new Error('General error');
    mainPrompt.mockRejectedValue(generalError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', generalError);
  });

  test('should complete module generation successfully', async () => {
    // Mock mainPrompt to return Module
    mainPrompt.mockResolvedValue({ feature: 'Module' });
    
    // Mock generateModule to resolve successfully
    generateModule.mockResolvedValue();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateModule was called
    expect(generateModule).toHaveBeenCalledTimes(1);
  });

  test('should handle errors in module generation', async () => {
    // Mock mainPrompt to return Module
    mainPrompt.mockResolvedValue({ feature: 'Module' });
    
    // Mock generateModule to throw an error
    const moduleError = new Error('Module generation error');
    generateModule.mockRejectedValue(moduleError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateModule was called
    expect(generateModule).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', moduleError);
  });

  test('should handle errors in middleware generation', async () => {
    // Mock mainPrompt to return Middleware
    mainPrompt.mockResolvedValue({ feature: 'Middleware' });
    
    // Mock generateMiddleware to throw an error
    const middlewareError = new Error('Middleware generation error');
    generateMiddleware.mockRejectedValue(middlewareError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateMiddleware was called
    expect(generateMiddleware).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', middlewareError);
  });

  test('should handle errors in util generation', async () => {
    // Mock mainPrompt to return Util
    mainPrompt.mockResolvedValue({ feature: 'Util' });
    
    // Mock generateUtil to throw an error
    const utilError = new Error('Util generation error');
    generateUtil.mockRejectedValue(utilError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateUtil was called
    expect(generateUtil).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', utilError);
  });

  test('should handle errors in config generation', async () => {
    // Mock mainPrompt to return Config
    mainPrompt.mockResolvedValue({ feature: 'Config' });
    
    // Mock generateConfig to throw an error
    const configError = new Error('Config generation error');
    generateConfig.mockRejectedValue(configError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify generateConfig was called
    expect(generateConfig).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', configError);
  });

  test('should handle errors in router integration', async () => {
    // Mock mainPrompt to return Router Integration
    mainPrompt.mockResolvedValue({ feature: 'Router Integration' });
    
    // Mock integrateRouter to throw an error
    const routerError = new Error('Router integration error');
    integrateRouter.mockRejectedValue(routerError);
    
    // Mock console.error to capture output
    console.error = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify integrateRouter was called
    expect(integrateRouter).toHaveBeenCalledTimes(1);
    
    // Verify console.error was called with error message
    expect(console.error).toHaveBeenCalledWith('❌ Terjadi error:', routerError);
  });

  test('should handle default case when no feature is selected', async () => {
    // Mock mainPrompt to return an unknown feature
    mainPrompt.mockResolvedValue({ feature: 'Unknown Feature' });
    
    // Mock console.log to capture output
    console.log = jest.fn();
    
    // Call the main function
    await index.main();
    
    // Verify mainPrompt was called
    expect(mainPrompt).toHaveBeenCalledTimes(1);
    
    // Verify console.log was called with cancellation message
    expect(console.log).toHaveBeenCalledWith('Batal.');
    
    // Verify no generators were called
    expect(generateModule).not.toHaveBeenCalled();
    expect(generateMiddleware).not.toHaveBeenCalled();
    expect(generateUtil).not.toHaveBeenCalled();
    expect(generateConfig).not.toHaveBeenCalled();
    expect(integrateRouter).not.toHaveBeenCalled();
  });
});