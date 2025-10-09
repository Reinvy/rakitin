#!/usr/bin/env node

// Fungsi untuk mengecek dan menginstall package jika diperlukan
function ensurePackage(packageName) {
  try {
    require(packageName);
  } catch (e) {
    console.log(`📦 Menginstall ${packageName}...`);
    const { execSync } = require('child_process');
    try {
      execSync(`npm install ${packageName}`, { stdio: 'inherit' });
      console.log(`✅ ${packageName} berhasil diinstall`);
    } catch (installError) {
      console.error(`❌ Gagal menginstall ${packageName}: ${installError.message}`);
      process.exit(1);
    }
  }
}

// Pastikan yargs terinstall
ensurePackage("yargs");

const yargs = require("yargs");
const { integrateRouter } = require("../lib/generator/router/router");

const options = yargs
  .usage("Usage: $0 <command> [options]")
  .command("router", "Integrasi router dengan modul yang sudah ada", {}, () => {
    integrateRouter().catch((err) => {
      console.error("❌ Terjadi error saat integrasi router:", err);
      process.exit(1);
    });
  })
  .help()
  .alias("help", "h").argv;

// Jika tidak ada command yang diberikan, tampilkan menu utama
if (options._.length === 0) {
  console.log("🚀 Hai Sayang! Ini CLI rakitin-mu!");
  require("../index.js");
}
