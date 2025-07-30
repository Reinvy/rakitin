const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("./arch/arch");
const { prismaORM, sequelizeORM } = require("./orm/orm");

async function generateModule() {
  const { moduleName, architecture, useORM, orm } =
    await inquirer.default.prompt([
      {
        type: "input",
        name: "moduleName",
        message: "Nama modul:",
      },
      {
        type: "list",
        name: "architecture",
        message: "Pilih arsitektur:",
        choices: ["Simple", "Modular"],
      },
      {
        type: "list",
        name: "useORM",
        message: "Apakah ingin menggunakan ORM?",
        choices: ["Yes", "No"],
        default: "Yes",
      },
      {
        type: "list",
        name: "orm",
        message: "Pilih ORM/Database:",
        choices: ["Prisma", "Sequelize", "Mongoose", "TypeORM"],
        when: (answers) => answers.useORM === "Yes",
      },
    ]);

  if (architecture === "Simple") {
    await simpleArch(moduleName);
    if (useORM === "Yes") {
      console.log(`Menggunakan ORM: ${orm}`);
      if (orm === "Prisma") {
        await prismaORM(moduleName);
        console.log("Prisma akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "Sequelize") {
        await sequelizeORM(moduleName, architecture);
        console.log("Sequelize akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "Mongoose") {
        console.log("Mongoose akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "TypeORM") {
        console.log("TypeORM akan diintegrasikan ke dalam modul ini.");
      } else {
        console.log("ORM tidak dikenali. Tidak ada integrasi yang dilakukan.");
      }
    } else {
      console.log(
        "Tidak menggunakan ORM. Modul akan dibuat tanpa integrasi ORM."
      );
    }
  } else if (architecture === "Modular") {
    await modularArch(moduleName);
    if (useORM === "Yes") {
      console.log(`Menggunakan ORM: ${orm}`);
      if (orm === "Prisma") {
        await prismaORM(moduleName);
        console.log("Prisma akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "Sequelize") {
        await sequelizeORM(moduleName, architecture);
        console.log("Sequelize akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "Mongoose") {
        console.log("Mongoose akan diintegrasikan ke dalam modul ini.");
      } else if (orm === "TypeORM") {
        console.log("TypeORM akan diintegrasikan ke dalam modul ini.");
      } else {
        console.log("ORM tidak dikenali. Tidak ada integrasi yang dilakukan.");
      }
    } else {
      console.log(
        "Tidak menggunakan ORM. Modul akan dibuat tanpa integrasi ORM."
      );
    }
  }

  console.log(
    `\n✅ Modul \"${moduleName}\" berhasil dibuat dengan arsitektur ${architecture}\n`
  );
}

module.exports = generateModule;
