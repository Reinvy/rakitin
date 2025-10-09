const path = require('path');
const constants = require('../../lib/constants');

describe('Constants', () => {
  test('should export all required constants', () => {
    expect(constants).toHaveProperty('basePath');
    expect(constants).toHaveProperty('modulesPath');
    expect(constants).toHaveProperty('sharedPath');
    expect(constants).toHaveProperty('prismaPath');
    expect(constants).toHaveProperty('typeormEntitiesPath');
    expect(constants).toHaveProperty('mongooseModelsPath');
  });

  test('should have correct path structure', () => {
    const expectedBasePath = path.join(process.cwd(), 'app');
    expect(constants.basePath).toBe(expectedBasePath);
    
    const expectedModulesPath = path.join(expectedBasePath, 'modules');
    expect(constants.modulesPath).toBe(expectedModulesPath);
    
    const expectedSharedPath = path.join(expectedBasePath, 'shared');
    expect(constants.sharedPath).toBe(expectedSharedPath);
  });

  test('should have correct ORM paths', () => {
    const expectedPrismaPath = path.join(process.cwd(), 'prisma', 'models');
    expect(constants.prismaPath).toBe(expectedPrismaPath);
    
    const expectedTypeormEntitiesPath = path.join(process.cwd(), 'app', 'modules');
    expect(constants.typeormEntitiesPath).toBe(expectedTypeormEntitiesPath);
    
    const expectedMongooseModelsPath = path.join(process.cwd(), 'app', 'modules');
    expect(constants.mongooseModelsPath).toBe(expectedMongooseModelsPath);
  });

  test('should have consistent paths for typeorm and mongoose', () => {
    expect(constants.typeormEntitiesPath).toBe(constants.mongooseModelsPath);
  });
});