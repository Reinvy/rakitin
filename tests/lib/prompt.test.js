const inquirer = require('inquirer');
const { mainPrompt } = require('../../lib/prompt');

// Mock inquirer
jest.mock('inquirer');

describe('Prompt', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('should call inquirer.prompt with correct configuration', async () => {
    // Mock the prompt method
    const mockPrompt = jest.fn().mockResolvedValue({ feature: 'Module' });
    inquirer.default.prompt = mockPrompt;

    // Call the function
    const result = await mainPrompt();

    // Verify inquirer.prompt was called with correct configuration
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(mockPrompt).toHaveBeenCalledWith([
      {
        type: 'list',
        name: 'feature',
        message: 'Apa yang ingin Anda generate?',
        choices: [
          'Module',
          'Middleware',
          'Util',
          'Config',
          'Router Integration',
        ],
      },
    ]);

    // Verify the result
    expect(result).toEqual({ feature: 'Module' });
  });

  test('should return the selected feature', async () => {
    // Test with different feature selections
    const features = ['Module', 'Middleware', 'Util', 'Config', 'Router Integration'];
    
    for (const feature of features) {
      // Mock the prompt method to return the current feature
      const mockPrompt = jest.fn().mockResolvedValue({ feature });
      inquirer.default.prompt = mockPrompt;

      // Call the function
      const result = await mainPrompt();

      // Verify the result
      expect(result).toEqual({ feature });
    }
  });

  test('should handle inquirer prompt errors', async () => {
    // Mock the prompt method to throw an error
    const mockPrompt = jest.fn().mockRejectedValue(new Error('Prompt error'));
    inquirer.default.prompt = mockPrompt;

    // Call the function and expect it to throw
    await expect(mainPrompt()).rejects.toThrow('Prompt error');
  });
});