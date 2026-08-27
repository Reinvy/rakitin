/**
 * Manual mock for inquirer (ESM package) in Jest CJS environment.
 */
module.exports = {
  __esModule: true,
  default: {
    prompt: jest.fn().mockResolvedValue({}),
  },
  prompt: jest.fn().mockResolvedValue({}),
  Separator: class Separator {},
};
