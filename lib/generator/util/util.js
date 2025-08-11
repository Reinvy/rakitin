const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { sharedPath } = require("../../constants");
const { toKebabCase } = require("../../utils");

async function generateUtil() {
  const { utilType } = await inquirer.default.prompt([
    {
      type: "list",
      name: "utilType",
      message: "Pilih jenis util yang ingin dibuat:",
      choices: [
        "Custom",
        "date",
        "string",
        "number",
        "array",
        "object",
        "file",
        "crypto",
        "uuid",
        "env",
        "url",
        "color",
        "math",
        "validation",
        "regex",
        "time",
      ],
    },
  ]);

  const utilDir = path.join(sharedPath, "utils");
  if (!fs.existsSync(utilDir)) {
    fs.mkdirSync(utilDir, { recursive: true });
    console.log(`📁 Folder 'app/utils' dibuat`);
  }

  let name = utilType;
  let content = "";

  if (utilType === "Custom") {
    const res = await inquirer.default.prompt([
      {
        type: "input",
        name: "name",
        message: "Nama util (custom, contoh: kebab-case):",
      },
    ]);
    name = res.name;
    content = `// Util: ${name}

function exampleFunction() {
  // TODO: implement me
}

module.exports = { exampleFunction };`;
  } else {
    const predefined = getUtilContent(utilType);
    name = `${utilType}.util`;
    content = predefined.content;
  }

  const filePath = path.join(utilDir, `${name}.js`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Util '${name}' berhasil dibuat di 'app/utils/${name}.js'!`);
  } else {
    console.log("⚠️ File util sudah ada. Tidak ada yang diubah.");
  }
}

function getUtilContent(type) {
  const utils = {
    date: `// Util: date
const dayjs = require('dayjs');

function now() {
  return dayjs().toISOString();
}
function format(date, fmt = 'YYYY-MM-DD') {
  return dayjs(date).format(fmt);
}
function add(date, unit, value) {
  return dayjs(date).add(value, unit).toISOString();
}
function subtract(date, unit, value) {
  return dayjs(date).subtract(value, unit).toISOString();
}
function isBefore(a, b) {
  return dayjs(a).isBefore(b);
}
function isAfter(a, b) {
  return dayjs(a).isAfter(b);
}

module.exports = { now, format, add, subtract, isBefore, isAfter };`,

    string: `// Util: string
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function kebabCase(str) {
  return str.replace(/\\s+/g, '-').toLowerCase();
}
function camelCase(str) {
  return str.replace(/[-_\\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
}
function truncate(str, len = 100) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
function reverse(str) {
  return str.split('').reverse().join('');
}

module.exports = { capitalize, kebabCase, camelCase, truncate, reverse };`,

    number: `// Util: number
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
function isEven(n) {
  return n % 2 === 0;
}
function isOdd(n) {
  return n % 2 !== 0;
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function toCurrency(n, currency = 'IDR') {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency }).format(n);
}

module.exports = { clamp, isEven, isOdd, randomInt, toCurrency };`,

    array: `// Util: array
function unique(arr) {
  return [...new Set(arr)];
}
function flatten(arr) {
  return arr.flat(Infinity);
}
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
function compact(arr) {
  return arr.filter(Boolean);
}

module.exports = { unique, flatten, chunk, compact };`,

    object: `// Util: object
function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function merge(...objs) {
  return Object.assign({}, ...objs);
}

module.exports = { isEmpty, deepClone, merge };`,

    file: `// Util: file
const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function writeJson(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}
function exists(path) {
  return fs.existsSync(path);
}

module.exports = { readJson, writeJson, exists };`,

    crypto: `// Util: crypto
const crypto = require('crypto');

function hashSHA256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}
function randomHex(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { hashSHA256, randomHex };`,

    uuid: `// Util: uuid
const { v4: uuidv4 } = require('uuid');

function generate() {
  return uuidv4();
}
function short() {
  return uuidv4().split('-')[0];
}

module.exports = { generate, short };`,

    env: `// Util: env
require('dotenv').config();

function get(key, fallback = '') {
  return process.env[key] || fallback;
}
function requireEnv(key) {
  if (!process.env[key]) throw new Error(\`Missing env: \${key}\`);
  return process.env[key];
}

module.exports = { get, requireEnv };`,

    url: `// Util: url
const { URL } = require('url');

function parse(urlStr) {
  return new URL(urlStr);
}
function getHostname(urlStr) {
  return new URL(urlStr).hostname;
}

module.exports = { parse, getHostname };`,

    color: `// Util: color
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

module.exports = { hexToRgb };`,

    math: `// Util: math
function sum(...nums) {
  return nums.reduce((acc, n) => acc + n, 0);
}
function average(...nums) {
  return sum(...nums) / nums.length;
}
function max(...nums) {
  return Math.max(...nums);
}

module.exports = { sum, average, max };`,

    validation: `// Util: validation
function isEmail(str) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(str);
}
function isUrl(str) {
  try {
    new URL(str);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { isEmail, isUrl };`,

    regex: `// Util: regex
function matchAll(pattern, str) {
  return [...str.matchAll(pattern)];
}
function escape(str) {
  return str.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}

module.exports = { matchAll, escape };`,

    time: `// Util: time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function now() {
  return Date.now();
}

module.exports = { sleep, now };`,
  };

  return {
    content: utils[type] || `// Util '${type}' belum tersedia.`,
  };
}

module.exports = generateUtil;
