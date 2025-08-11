const path = require("path");
const { prismaPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toPascalCase,
} = require("../../../utils");

async function prismaORM(moduleName) {
  const kebabName = toKebabCase(moduleName);
  const modelName = toPascalCase(moduleName); // misalnya 'user-profile' jadi 'UserProfile'
  const filePath = path.join(prismaPath, `${kebabName}.prisma`);

  // Pastikan folder prisma sudah ada
  ensureDir(prismaPath);

  const boilerplate = `// ${modelName} model

model ${modelName} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

  writeFileIfNotExists(filePath, boilerplate);
}

module.exports = { prismaORM };
