const fs = require("fs");
const path = require("path");
const { modulesPath, sharedPath, basePath } = require("./constants");

/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  // fs.mkdirSync dengan { recursive: true } sudah menangani kasus jika direktori sudah ada,
  // jadi pemeriksaan fs.existsSync() tidak diperlukan.
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Menulis konten ke file hanya jika file tersebut belum ada.
 * @param {string} filePath Path ke file.
 * @param {string} content Konten yang akan ditulis.
 */
function writeFileIfNotExists(filePath, content = "") {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

/**
 * Memastikan struktur direktori dasar aplikasi ada. Jika belum, strukturnya akan dibuat.
 * Struktur direktori dasar yang dimaksud adalah app/, app/modules/, app/shared/, dan folder
 * di dalam app/shared/, yaitu config/, interfaces/, middlewares/, dan utils/. File app.js
 * dan server.js juga akan dibuat jika belum ada.
 */
function ensureBaseStructure() {
  [modulesPath, sharedPath].forEach(ensureDir);
  ["middlewares", "config", "utils", "interfaces"].forEach((sub) =>
    // Menggunakan path.join untuk kompatibilitas lintas platform yang lebih baik.
    ensureDir(path.join(sharedPath, sub))
  );
  writeFileIfNotExists(path.join(basePath, "app.js"), `// Express app init`);
  writeFileIfNotExists(path.join(basePath, "server.js"), `// App entry point`);
}

/**
 * Mengkonversi string ke dalam format PascalCase.
 * Contoh: "Hello World" menjadi "HelloWorld".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toPascalCase(str) {
  // Menambahkan validasi input untuk mencegah error.
  if (typeof str !== "string" || !str) return "";
  // Memanfaatkan toCamelCase untuk logika yang lebih andal dan konsisten.
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Mengkonversi string ke dalam format kebab-case.
 * Contoh: "Hello World" menjadi "hello-world".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toKebabCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Mengkonversi string ke dalam format camelCase.
 * Contoh: "Hello World" menjadi "helloWorld".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toCamelCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Mengkonversi string ke dalam format snake_case.
 * Contoh: "Hello World" menjadi "hello_world".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toSnakeCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

/**
 * Mengkonversi string ke dalam format title case.
 * Contoh: "hello world" menjadi "Hello World".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toTitleCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Mengkonversi string ke dalam format konstanta (UPPER_CASE_WITH_UNDERSCORES).
 * Contoh: "hello world" menjadi "HELLO_WORLD".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toConstantCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();
}

module.exports = {
  ensureDir,
  writeFileIfNotExists,
  ensureBaseStructure,
  toPascalCase,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
};
