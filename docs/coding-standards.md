# 📏 Standar Pengkodean rakitin

## 🇮🇩 Bahasa Indonesia

### Pendahuluan

Dokumen ini menjelaskan standar pengkodean yang digunakan dalam proyek **rakitin**. Standar ini bertujuan untuk menjaga konsistensi, keterbacaan, dan kualitas kode di seluruh proyek.

### Standar Umum

#### 1. Penamaan

##### Variabel dan Fungsi
- Gunakan **camelCase** untuk nama variabel dan fungsi
- Nama harus deskriptif dan jelas
- Hindari singkatan yang tidak umum

```javascript
// Benar
const userName = "John";
const getUserData = () => { ... };

// Salah
const username = "John";  // Tidak konsisten dengan camelCase
const getUsrData = () => { ... };  // Singkatan tidak jelas
```

##### Class dan Constructor
- Gunakan **PascalCase** untuk nama class dan constructor

```javascript
// Benar
class UserController { ... }
const user = new UserController();

// Salah
class userController { ... }
const user = new userController();
```

##### Konstanta
- Gunakan **UPPER_CASE** untuk nama konstanta
- Pisahkan kata dengan underscore (_)

```javascript
// Benar
const MAX_LOGIN_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

// Salah
const maxLoginAttempts = 3;
const apiBaseUrl = "https://api.example.com";
```

##### File
- Gunakan **kebab-case** untuk nama file
- Nama file harus mencerminkan isinya

```javascript
// Benar
// file: user-controller.js
class UserController { ... }

// file: user-service.js
class UserService { ... }

// Salah
// file: userController.js
class UserController { ... }
```

#### 2. Format Kode

##### Indentasi
- Gunakan **2 spasi** untuk indentasi
- Jangan gunakan tab

```javascript
// Benar
function getData() {
  if (condition) {
    return result;
  }
}

// Salah
function getData() {
	if (condition) {
		return result;
	}
}
```

##### Panjang Baris
- Batasi panjang baris hingga **100 karakter**
- Jika perlu, pecah baris dengan logis

```javascript
// Benar
const longVariableName = someFunction(
  parameter1,
  parameter2
);

// Salah
const longVariableName = someFunction(parameter1, parameter2);
```

##### Spasi
- Gunakan spasi setelah koma
- Gunakan spasi di sekitar operator
- Gunakan spasi setelah titik dua dalam objek

```javascript
// Benar
const user = { name: "John", age: 30 };
const sum = a + b;

// Salah
const user = {name:"John",age:30};
const sum = a+b;
```

##### Titik Koma
- Gunakan titik koma di akhir setiap pernyataan

```javascript
// Benar
const name = "John";
console.log(name);

// Salah
const name = "John"
console.log(name)
```

#### 3. Struktur File

##### Urutan Import
- Import dari pihak ketiga
- Import dari modul internal
- Import relatif

```javascript
// Benar
const inquirer = require("inquirer");  // Third party
const constants = require("../../constants");  // Internal module
const utils = require("./utils");  // Relative import

// Salah
const utils = require("./utils");
const inquirer = require("inquirer");
const constants = require("../../constants");
```

##### Komentar File
- Setiap file harus memiliki komentar deskriptif di bagian atas
- Sertakan informasi tentang tujuan file

```javascript
/**
 * Generator untuk modul aplikasi
 * Menangani pembuatan struktur modul dengan berbagai arsitektur
 */

const inquirer = require("inquirer");
// ... rest of the code
```

#### 4. Fungsi

##### Deklarasi Fungsi
- Gunakan arrow function untuk fungsi anonim
- Gunakan function declaration untuk fungsi utama

```javascript
// Benar
async function generateModule() { ... }

const processData = (data) => { ... };

// Salah
const generateModule = async function() { ... };

function processData(data) { ... }
```

##### Dokumentasi Fungsi
- Gunakan JSDoc untuk dokumentasi fungsi publik
- Sertakan deskripsi, parameter, dan return value

```javascript
/**
 * Menghasilkan konfigurasi untuk aplikasi
 * @param {string} configType - Tipe konfigurasi yang akan dibuat
 * @returns {Promise<void>}
 */
async function generateConfig(configType) { ... }
```

##### Parameter Fungsi
- Batasi jumlah parameter (maksimal 3-4)
- Jika banyak parameter, gunakan options object

```javascript
// Benar
function createUser({ name, email, password, role }) { ... }

// Salah
function createUser(name, email, password, role) { ... }
```

#### 5. Komentar

##### Bahasa
- Gunakan **bahasa Indonesia** untuk semua komentar
- Kecuali untuk nama variabel atau fungsi yang sudah umum dalam bahasa Inggris

```javascript
// Benar
// Mendapatkan data user dari database
const userData = await User.findById(id);

// Salah
// Get user data from database
const userData = await User.findById(id);
```

##### Komentar satu baris
- Gunakan `//` untuk komentar satu baris
- Berikan spasi setelah `//`

```javascript
// Benar
// Validasi input user
if (!input) return false;

// Salah
//Validasi input user
if (!input) return false;
```

##### Komentar multi-baris
- Gunakan `/* ... */` untuk komentar multi-baris

```javascript
/*
 * Fungsi ini digunakan untuk menghasilkan file konfigurasi
 * berdasarkan tipe yang dipilih oleh user
 */
function generateConfig() { ... }
```

#### 6. Penanganan Error

##### Try-Catch
- Gunakan try-catch untuk operasi asinkron yang mungkin gagal
- Berikan pesan error yang jelas dan informatif

```javascript
// Benar
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error(`Gagal melakukan operasi: ${error.message}`);
  throw error;
}

// Salah
try {
  const result = await someOperation();
  return result;
} catch (err) {
  console.log("Error");
}
```

##### Error Custom
- Buat error class untuk error spesifik
- Extend dari Error class standar

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Penggunaan
throw new ValidationError("Input tidak valid");
```

#### 7. Promise dan Asynchrony

##### Async/Await
- Gunakan async/await daripada .then/.catch
- Selalu tangani error dengan try-catch

```javascript
// Benar
async function getUserData() {
  try {
    const user = await User.findById(id);
    return user;
  } catch (error) {
    console.error(`Gagal mendapatkan user: ${error.message}`);
    throw error;
  }
}

// Salah
function getUserData() {
  return User.findById(id)
    .then(user => user)
    .catch(error => {
      console.log("Error:", error);
      throw error;
    });
}
```

#### 8. Logging

##### Level Logging
- Gunakan console.error untuk error
- Gunakan console.log untuk informasi umum
- Tambahkan emoji atau prefix untuk memudahkan identifikasi

```javascript
// Benar
console.log("✅ Modul berhasil dibuat");
console.error("❌ Gagal membuat modul");

// Salah
console.log("Module created successfully");
console.error("Failed to create module");
```

### Standar Spesifik rakitin

#### 1. Struktur Generator

##### File Generator
- Setiap generator harus memiliki file utama dengan nama yang sesuai
- File harus berada di direktori `lib/generator/[type]/[name].js`

```javascript
// Struktur yang benar
lib/generator/config/config.js
lib/generator/module/module.js
lib/generator/middleware/middleware.js
```

##### Fungsi Generator
- Setiap generator harus mengexport fungsi utama dengan nama `generate[Name]`
- Fungsi harus async
- Harus memiliki validasi input
- Harus memiliki error handling

```javascript
/**
 * Generator untuk konfigurasi
 * @returns {Promise<void>}
 */
async function generateConfig() {
  try {
    // Validasi input
    if (!input) {
      throw new Error("Input tidak boleh kosong");
    }
    
    // Logika generator
    // ...
    
    console.log("✅ Konfigurasi berhasil dibuat");
  } catch (error) {
    console.error(`❌ Gagal membuat konfigurasi: ${error.message}`);
    throw error;
  }
}

module.exports = generateConfig;
```

#### 2. Prompt Interaktif

##### Struktur Prompt
- Gunakan inquirer untuk prompt interaktif
- Kelompokkan prompt terkait
- Berikan pesan yang jelas dan deskriptif

```javascript
// Benar
const { configType, customName } = await inquirer.default.prompt([
  {
    type: "list",
    name: "configType",
    message: "Pilih jenis config yang ingin dibuat:",
    choices: ["app", "database", "jwt"],
  },
  {
    type: "input",
    name: "customName",
    message: "Nama config custom:",
    when: (answers) => answers.configType === "custom",
  },
]);
```

#### 3. Utilitas

##### Fungsi Utilitas
- Tempatkan fungsi utilitas di `lib/utils.js`
- Berikan JSDoc untuk setiap fungsi
- Buat fungsi yang dapat digunakan kembali

```javascript
/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
```

#### 4. Konstanta

##### Definisi Konstanta
- Tempatkan semua konstanta di `lib/constants.js`
- Gunakan path.join untuk cross-platform compatibility

```javascript
const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
};
```

---

## 🇬🇧 English

### Introduction

This document explains the coding standards used in the **rakitin** project. These standards are intended to maintain consistency, readability, and code quality throughout the project.

### General Standards

#### 1. Naming

##### Variables and Functions
- Use **camelCase** for variable and function names
- Names should be descriptive and clear
- Avoid uncommon abbreviations

```javascript
// Correct
const userName = "John";
const getUserData = () => { ... };

// Incorrect
const username = "John";  // Not consistent with camelCase
const getUsrData = () => { ... };  // Unclear abbreviation
```

##### Classes and Constructors
- Use **PascalCase** for class and constructor names

```javascript
// Correct
class UserController { ... }
const user = new UserController();

// Incorrect
class userController { ... }
const user = new userController();
```

##### Constants
- Use **UPPER_CASE** for constant names
- Separate words with underscore (_)

```javascript
// Correct
const MAX_LOGIN_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

// Incorrect
const maxLoginAttempts = 3;
const apiBaseUrl = "https://api.example.com";
```

##### Files
- Use **kebab-case** for file names
- File names should reflect their content

```javascript
// Correct
// file: user-controller.js
class UserController { ... }

// file: user-service.js
class UserService { ... }

// Incorrect
// file: userController.js
class UserController { ... }
```

#### 2. Code Formatting

##### Indentation
- Use **2 spaces** for indentation
- Do not use tabs

```javascript
// Correct
function getData() {
  if (condition) {
    return result;
  }
}

// Incorrect
function getData() {
	if (condition) {
		return result;
	}
}
```

##### Line Length
- Limit line length to **100 characters**
- If necessary, break lines logically

```javascript
// Correct
const longVariableName = someFunction(
  parameter1,
  parameter2
);

// Incorrect
const longVariableName = someFunction(parameter1, parameter2);
```

##### Spacing
- Use space after comma
- Use space around operators
- Use space after colon in objects

```javascript
// Correct
const user = { name: "John", age: 30 };
const sum = a + b;

// Incorrect
const user = {name:"John",age:30};
const sum = a+b;
```

##### Semicolons
- Use semicolons at the end of each statement

```javascript
// Correct
const name = "John";
console.log(name);

// Incorrect
const name = "John"
console.log(name)
```

#### 3. File Structure

##### Import Order
- Third-party imports
- Internal module imports
- Relative imports

```javascript
// Correct
const inquirer = require("inquirer");  // Third party
const constants = require("../../constants");  // Internal module
const utils = require("./utils");  // Relative import

// Incorrect
const utils = require("./utils");
const inquirer = require("inquirer");
const constants = require("../../constants");
```

##### File Comments
- Each file should have a descriptive comment at the top
- Include information about the file's purpose

```javascript
/**
 * Generator for application modules
 * Handles creation of module structures with various architectures
 */

const inquirer = require("inquirer");
// ... rest of the code
```

#### 4. Functions

##### Function Declaration
- Use arrow functions for anonymous functions
- Use function declarations for main functions

```javascript
// Correct
async function generateModule() { ... }

const processData = (data) => { ... };

// Incorrect
const generateModule = async function() { ... };

function processData(data) { ... }
```

##### Function Documentation
- Use JSDoc for public function documentation
- Include description, parameters, and return value

```javascript
/**
 * Generates configuration for the application
 * @param {string} configType - Type of configuration to create
 * @returns {Promise<void>}
 */
async function generateConfig(configType) { ... }
```

##### Function Parameters
- Limit number of parameters (max 3-4)
- If many parameters, use options object

```javascript
// Correct
function createUser({ name, email, password, role }) { ... }

// Incorrect
function createUser(name, email, password, role) { ... }
```

#### 5. Comments

##### Language
- Use **Indonesian** for all comments
- Except for variable or function names that are already common in English

```javascript
// Correct
// Mendapatkan data user dari database
const userData = await User.findById(id);

// Incorrect
// Get user data from database
const userData = await User.findById(id);
```

##### Single-line Comments
- Use `//` for single-line comments
- Provide space after `//`

```javascript
// Correct
// Validasi input user
if (!input) return false;

// Incorrect
//Validasi input user
if (!input) return false;
```

##### Multi-line Comments
- Use `/* ... */` for multi-line comments

```javascript
/*
 * Fungsi ini digunakan untuk menghasilkan file konfigurasi
 * berdasarkan tipe yang dipilih oleh user
 */
function generateConfig() { ... }
```

#### 6. Error Handling

##### Try-Catch
- Use try-catch for asynchronous operations that might fail
- Provide clear and informative error messages

```javascript
// Correct
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error(`Gagal melakukan operasi: ${error.message}`);
  throw error;
}

// Incorrect
try {
  const result = await someOperation();
  return result;
} catch (err) {
  console.log("Error");
}
```

##### Custom Errors
- Create error classes for specific errors
- Extend from standard Error class

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Usage
throw new ValidationError("Input tidak valid");
```

#### 7. Promises and Asynchrony

##### Async/Await
- Use async/await instead of .then/.catch
- Always handle errors with try-catch

```javascript
// Correct
async function getUserData() {
  try {
    const user = await User.findById(id);
    return user;
  } catch (error) {
    console.error(`Gagal mendapatkan user: ${error.message}`);
    throw error;
  }
}

// Incorrect
function getUserData() {
  return User.findById(id)
    .then(user => user)
    .catch(error => {
      console.log("Error:", error);
      throw error;
    });
}
```

#### 8. Logging

##### Logging Levels
- Use console.error for errors
- Use console.log for general information
- Add emoji or prefix for easier identification

```javascript
// Correct
console.log("✅ Modul berhasil dibuat");
console.error("❌ Gagal membuat modul");

// Incorrect
console.log("Module created successfully");
console.error("Failed to create module");
```

### rakitin-Specific Standards

#### 1. Generator Structure

##### Generator Files
- Each generator should have a main file with an appropriate name
- File should be in directory `lib/generator/[type]/[name].js`

```javascript
// Correct structure
lib/generator/config/config.js
lib/generator/module/module.js
lib/generator/middleware/middleware.js
```

##### Generator Functions
- Each generator should export a main function named `generate[Name]`
- Function should be async
- Should have input validation
- Should have error handling

```javascript
/**
 * Generator for configuration
 * @returns {Promise<void>}
 */
async function generateConfig() {
  try {
    // Input validation
    if (!input) {
      throw new Error("Input tidak boleh kosong");
    }
    
    // Generator logic
    // ...
    
    console.log("✅ Konfigurasi berhasil dibuat");
  } catch (error) {
    console.error(`❌ Gagal membuat konfigurasi: ${error.message}`);
    throw error;
  }
}

module.exports = generateConfig;
```

#### 2. Interactive Prompts

##### Prompt Structure
- Use inquirer for interactive prompts
- Group related prompts
- Provide clear and descriptive messages

```javascript
// Correct
const { configType, customName } = await inquirer.default.prompt([
  {
    type: "list",
    name: "configType",
    message: "Pilih jenis config yang ingin dibuat:",
    choices: ["app", "database", "jwt"],
  },
  {
    type: "input",
    name: "customName",
    message: "Nama config custom:",
    when: (answers) => answers.configType === "custom",
  },
]);
```

#### 3. Utilities

##### Utility Functions
- Place utility functions in `lib/utils.js`
- Provide JSDoc for each function
- Create reusable functions

```javascript
/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
```

#### 4. Constants

##### Constant Definitions
- Place all constants in `lib/constants.js`
- Use path.join for cross-platform compatibility

```javascript
const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
};```javascript
/**
 * Generator untuk modul aplikasi
 * Menangani pembuatan struktur modul dengan berbagai arsitektur
 */

const inquirer = require("inquirer");
// ... rest of the code
```

#### 4. Fungsi

##### Deklarasi Fungsi
- Gunakan arrow function untuk fungsi anonim
- Gunakan function declaration untuk fungsi utama

```javascript
// Benar
async function generateModule() { ... }

const processData = (data) => { ... };

// Salah
const generateModule = async function() { ... };

function processData(data) { ... }
```

##### Dokumentasi Fungsi
- Gunakan JSDoc untuk dokumentasi fungsi publik
- Sertakan deskripsi, parameter, dan return value

```javascript
/**
 * Menghasilkan konfigurasi untuk aplikasi
 * @param {string} configType - Tipe konfigurasi yang akan dibuat
 * @returns {Promise<void>}
 */
async function generateConfig(configType) { ... }
```

##### Parameter Fungsi
- Batasi jumlah parameter (maksimal 3-4)
- Jika banyak parameter, gunakan options object

```javascript
// Benar
function createUser({ name, email, password, role }) { ... }

// Salah
function createUser(name, email, password, role) { ... }
```

#### 5. Komentar

##### Bahasa
- Gunakan **bahasa Indonesia** untuk semua komentar
- Kecuali untuk nama variabel atau fungsi yang sudah umum dalam bahasa Inggris

```javascript
// Benar
// Mendapatkan data user dari database
const userData = await User.findById(id);

// Salah
// Get user data from database
const userData = await User.findById(id);
```

##### Komentar satu baris
- Gunakan `//` untuk komentar satu baris
- Berikan spasi setelah `//`

```javascript
// Benar
// Validasi input user
if (!input) return false;

// Salah
//Validasi input user
if (!input) return false;
```

##### Komentar multi-baris
- Gunakan `/* ... */` untuk komentar multi-baris

```javascript
/*
 * Fungsi ini digunakan untuk menghasilkan file konfigurasi
 * berdasarkan tipe yang dipilih oleh user
 */
function generateConfig() { ... }
```

#### 6. Penanganan Error

##### Try-Catch
- Gunakan try-catch untuk operasi asinkron yang mungkin gagal
- Berikan pesan error yang jelas dan informatif

```javascript
// Benar
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error(`Gagal melakukan operasi: ${error.message}`);
  throw error;
}

// Salah
try {
  const result = await someOperation();
  return result;
} catch (err) {
  console.log("Error");
}
```

##### Error Custom
- Buat error class untuk error spesifik
- Extend dari Error class standar

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Penggunaan
throw new ValidationError("Input tidak valid");
```

#### 7. Promise dan Asynchrony

##### Async/Await
- Gunakan async/await daripada .then/.catch
- Selalu tangani error dengan try-catch

```javascript
// Benar
async function getUserData() {
  try {
    const user = await User.findById(id);
    return user;
  } catch (error) {
    console.error(`Gagal mendapatkan user: ${error.message}`);
    throw error;
  }
}

// Salah
function getUserData() {
  return User.findById(id)
    .then(user => user)
    .catch(error => {
      console.log("Error:", error);
      throw error;
    });
}
```

#### 8. Logging

##### Level Logging
- Gunakan console.error untuk error
- Gunakan console.log untuk informasi umum
- Tambahkan emoji atau prefix untuk memudahkan identifikasi

```javascript
// Benar
console.log("✅ Modul berhasil dibuat");
console.error("❌ Gagal membuat modul");

// Salah
console.log("Module created successfully");
console.error("Failed to create module");
```

### Standar Spesifik rakitin

#### 1. Struktur Generator

##### File Generator
- Setiap generator harus memiliki file utama dengan nama yang sesuai
- File harus berada di direktori `lib/generator/[type]/[name].js`

```javascript
// Struktur yang benar
lib/generator/config/config.js
lib/generator/module/module.js
lib/generator/middleware/middleware.js
```

##### Fungsi Generator
- Setiap generator harus mengexport fungsi utama dengan nama `generate[Name]`
- Fungsi harus async
- Harus memiliki validasi input
- Harus memiliki error handling

```javascript
/**
 * Generator untuk konfigurasi
 * @returns {Promise<void>}
 */
async function generateConfig() {
  try {
    // Validasi input
    if (!input) {
      throw new Error("Input tidak boleh kosong");
    }
    
    // Logika generator
    // ...
    
    console.log("✅ Konfigurasi berhasil dibuat");
  } catch (error) {
    console.error(`❌ Gagal membuat konfigurasi: ${error.message}`);
    throw error;
  }
}

module.exports = generateConfig;
```

#### 2. Prompt Interaktif

##### Struktur Prompt
- Gunakan inquirer untuk prompt interaktif
- Kelompokkan prompt terkait
- Berikan pesan yang jelas dan deskriptif

```javascript
// Benar
const { configType, customName } = await inquirer.default.prompt([
  {
    type: "list",
    name: "configType",
    message: "Pilih jenis config yang ingin dibuat:",
    choices: ["app", "database", "jwt"],
  },
  {
    type: "input",
    name: "customName",
    message: "Nama config custom:",
    when: (answers) => answers.configType === "custom",
  },
]);
```

#### 3. Utilitas

##### Fungsi Utilitas
- Tempatkan fungsi utilitas di `lib/utils.js`
- Berikan JSDoc untuk setiap fungsi
- Buat fungsi yang dapat digunakan kembali

```javascript
/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
```

#### 4. Konstanta

##### Definisi Konstanta
- Tempatkan semua konstanta di `lib/constants.js`
- Gunakan path.join untuk cross-platform compatibility

```javascript
const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
};
```

---

## 🇬🇧 English

### Introduction

This document explains the coding standards used in the **rakitin** project. These standards are intended to maintain consistency, readability, and code quality throughout the project.

### General Standards

#### 1. Naming

##### Variables and Functions
- Use **camelCase** for variable and function names
- Names should be descriptive and clear
- Avoid uncommon abbreviations

```javascript
// Correct
const userName = "John";
const getUserData = () => { ... };

// Incorrect
const username = "John";  // Not consistent with camelCase
const getUsrData = () => { ... };  // Unclear abbreviation
```

##### Classes and Constructors
- Use **PascalCase** for class and constructor names

```javascript
// Correct
class UserController { ... }
const user = new UserController();

// Incorrect
class userController { ... }
const user = new userController();
```

##### Constants
- Use **UPPER_CASE** for constant names
- Separate words with underscore (_)

```javascript
// Correct
const MAX_LOGIN_ATTEMPTS = 3;
const API_BASE_URL = "https://api.example.com";

// Incorrect
const maxLoginAttempts = 3;
const apiBaseUrl = "https://api.example.com";
```

##### Files
- Use **kebab-case** for file names
- File names should reflect their content

```javascript
// Correct
// file: user-controller.js
class UserController { ... }

// file: user-service.js
class UserService { ... }

// Incorrect
// file: userController.js
class UserController { ... }
```

#### 2. Code Formatting

##### Indentation
- Use **2 spaces** for indentation
- Do not use tabs

```javascript
// Correct
function getData() {
  if (condition) {
    return result;
  }
}

// Incorrect
function getData() {
	if (condition) {
		return result;
	}
}
```

##### Line Length
- Limit line length to **100 characters**
- If necessary, break lines logically

```javascript
// Correct
const longVariableName = someFunction(
  parameter1,
  parameter2
);

// Incorrect
const longVariableName = someFunction(parameter1, parameter2);
```

##### Spacing
- Use space after comma
- Use space around operators
- Use space after colon in objects

```javascript
// Correct
const user = { name: "John", age: 30 };
const sum = a + b;

// Incorrect
const user = {name:"John",age:30};
const sum = a+b;
```

##### Semicolons
- Use semicolons at the end of each statement

```javascript
// Correct
const name = "John";
console.log(name);

// Incorrect
const name = "John"
console.log(name)
```

#### 3. File Structure

##### Import Order
- Third-party imports
- Internal module imports
- Relative imports

```javascript
// Correct
const inquirer = require("inquirer");  // Third party
const constants = require("../../constants");  // Internal module
const utils = require("./utils");  // Relative import

// Incorrect
const utils = require("./utils");
const inquirer = require("inquirer");
const constants = require("../../constants");
```

##### File Comments
- Each file should have a descriptive comment at the top
- Include information about the file's purpose

```javascript
/**
 * Generator for application modules
 * Handles creation of module structures with various architectures
 */

const inquirer = require("inquirer");
// ... rest of the code
```

#### 4. Functions

##### Function Declaration
- Use arrow functions for anonymous functions
- Use function declarations for main functions

```javascript
// Correct
async function generateModule() { ... }

const processData = (data) => { ... };

// Incorrect
const generateModule = async function() { ... };

function processData(data) { ... }
```

##### Function Documentation
- Use JSDoc for public function documentation
- Include description, parameters, and return value

```javascript
/**
 * Generates configuration for the application
 * @param {string} configType - Type of configuration to create
 * @returns {Promise<void>}
 */
async function generateConfig(configType) { ... }
```

##### Function Parameters
- Limit number of parameters (max 3-4)
- If many parameters, use options object

```javascript
// Correct
function createUser({ name, email, password, role }) { ... }

// Incorrect
function createUser(name, email, password, role) { ... }
```

#### 5. Comments

##### Language
- Use **Indonesian** for all comments
- Except for variable or function names that are already common in English

```javascript
// Correct
// Mendapatkan data user dari database
const userData = await User.findById(id);

// Incorrect
// Get user data from database
const userData = await User.findById(id);
```

##### Single-line Comments
- Use `//` for single-line comments
- Provide space after `//`

```javascript
// Correct
// Validasi input user
if (!input) return false;

// Incorrect
//Validasi input user
if (!input) return false;
```

##### Multi-line Comments
- Use `/* ... */` for multi-line comments

```javascript
/*
 * Fungsi ini digunakan untuk menghasilkan file konfigurasi
 * berdasarkan tipe yang dipilih oleh user
 */
function generateConfig() { ... }
```

#### 6. Error Handling

##### Try-Catch
- Use try-catch for asynchronous operations that might fail
- Provide clear and informative error messages

```javascript
// Correct
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error(`Gagal melakukan operasi: ${error.message}`);
  throw error;
}

// Incorrect
try {
  const result = await someOperation();
  return result;
} catch (err) {
  console.log("Error");
}
```

##### Custom Errors
- Create error classes for specific errors
- Extend from standard Error class

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

// Usage
throw new ValidationError("Input tidak valid");
```

#### 7. Promises and Asynchrony

##### Async/Await
- Use async/await instead of .then/.catch
- Always handle errors with try-catch

```javascript
// Correct
async function getUserData() {
  try {
    const user = await User.findById(id);
    return user;
  } catch (error) {
    console.error(`Gagal mendapatkan user: ${error.message}`);
    throw error;
  }
}

// Incorrect
function getUserData() {
  return User.findById(id)
    .then(user => user)
    .catch(error => {
      console.log("Error:", error);
      throw error;
    });
}
```

#### 8. Logging

##### Logging Levels
- Use console.error for errors
- Use console.log for general information
- Add emoji or prefix for easier identification

```javascript
// Correct
console.log("✅ Modul berhasil dibuat");
console.error("❌ Gagal membuat modul");

// Incorrect
console.log("Module created successfully");
console.error("Failed to create module");
```

### rakitin-Specific Standards

#### 1. Generator Structure

##### Generator Files
- Each generator should have a main file with an appropriate name
- File should be in directory `lib/generator/[type]/[name].js`

```javascript
// Correct structure
lib/generator/config/config.js
lib/generator/module/module.js
lib/generator/middleware/middleware.js
```

##### Generator Functions
- Each generator should export a main function named `generate[Name]`
- Function should be async
- Should have input validation
- Should have error handling

```javascript
/**
 * Generator for configuration
 * @returns {Promise<void>}
 */
async function generateConfig() {
  try {
    // Input validation
    if (!input) {
      throw new Error("Input tidak boleh kosong");
    }
    
    // Generator logic
    // ...
    
    console.log("✅ Konfigurasi berhasil dibuat");
  } catch (error) {
    console.error(`❌ Gagal membuat konfigurasi: ${error.message}`);
    throw error;
  }
}

module.exports = generateConfig;
```

#### 2. Interactive Prompts

##### Prompt Structure
- Use inquirer for interactive prompts
- Group related prompts
- Provide clear and descriptive messages

```javascript
// Correct
const { configType, customName } = await inquirer.default.prompt([
  {
    type: "list",
    name: "configType",
    message: "Pilih jenis config yang ingin dibuat:",
    choices: ["app", "database", "jwt"],
  },
  {
    type: "input",
    name: "customName",
    message: "Nama config custom:",
    when: (answers) => answers.configType === "custom",
  },
]);
```

#### 3. Utilities

##### Utility Functions
- Place utility functions in `lib/utils.js`
- Provide JSDoc for each function
- Create reusable functions

```javascript
/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
```

#### 4. Constants

##### Constant Definitions
- Place all constants in `lib/constants.js`
- Use path.join for cross-platform compatibility

```javascript
const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
};
