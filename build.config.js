/**
 * esbuild Configuration for rakitin library
 * Builds dual CJS and ESM outputs with TypeScript declarations
 */

const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// Package info
const packageJson = require("./package.json");

// Build directories
const DIST_CJS = "dist/cjs";
const DIST_ESM = "dist/esm";

// Files to include in bundle
const _ENTRY_POINTS = {
  "index.js": "index.js",
  "bin/rakitin.js": "bin/rakitin.js",
};

/**
 * Common build options
 */
const commonOptions = {
  bundle: true,
  minify: process.env.NODE_ENV === "production",
  sourcemap: true,
  target: ["node14", "node16", "node18"],
  platform: "node",
  logLevel: "info",
};

/**
 * Common external packages (don't bundle these)
 */
const EXTERNAL = [
  "fs",
  "path",
  "os",
  "crypto",
  "util",
  "events",
  "stream",
  "buffer",
  "http",
  "https",
  "url",
  "querystring",
  "child_process",
  "inquirer",
  "yargs",
];

/**
 * Build CommonJS output
 */
async function buildCJS() {
  console.log("🏗️  Building CommonJS output...");

  // Ensure output directory exists
  if (!fs.existsSync(DIST_CJS)) {
    fs.mkdirSync(DIST_CJS, { recursive: true });
  }

  // Main library entry
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["index.js"],
    outfile: `${DIST_CJS}/index.js`,
    format: "cjs",
    platform: "node",
    external: EXTERNAL,
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  // CLI entry
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["bin/rakitin.js"],
    outfile: `${DIST_CJS}/bin/rakitin.js`,
    format: "cjs",
    platform: "node",
    external: [...EXTERNAL, `./${DIST_CJS}/index.js`],
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  // Copy submodules
  await copySubmodules(DIST_CJS);

  console.log("✅ CommonJS build complete");
}

/**
 * Build ESM output
 */
async function buildESM() {
  console.log("🏗️  Building ESM output...");

  // Ensure output directory exists
  if (!fs.existsSync(DIST_ESM)) {
    fs.mkdirSync(DIST_ESM, { recursive: true });
  }

  // Main library entry
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["index.js"],
    outfile: `${DIST_ESM}/index.js`,
    format: "esm",
    platform: "node",
    external: EXTERNAL,
  });

  // CLI entry
  await esbuild.build({
    ...commonOptions,
    entryPoints: ["bin/rakitin.js"],
    outfile: `${DIST_ESM}/bin/rakitin.js`,
    format: "esm",
    platform: "node",
    external: [...EXTERNAL, `./${DIST_ESM}/index.js`],
    banner: {
      js: "#!/usr/bin/env node",
    },
  });

  // Copy submodules
  await copySubmodules(DIST_ESM);

  console.log("✅ ESM build complete");
}

/**
 * Copy submodule directories
 * @param {string} outputDir - Output directory
 */
async function copySubmodules(outputDir) {
  const submodules = ["config", "utils", "ui", "template"];

  for (const submodule of submodules) {
    const srcDir = path.join("lib", submodule);
    const destDir = path.join(outputDir, submodule);

    if (fs.existsSync(srcDir)) {
      // Create destination directory
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy files
      const files = fs.readdirSync(srcDir);
      for (const file of files) {
        if (file.endsWith(".js")) {
          const srcFile = path.join(srcDir, file);
          const destFile = path.join(destDir, file);

          await esbuild.build({
            ...commonOptions,
            entryPoints: [srcFile],
            outfile: destFile,
            format: outputDir === DIST_CJS ? "cjs" : "esm",
            platform: "node",
            external: EXTERNAL,
          });
        }
      }
    }
  }
}

/**
 * Copy TypeScript declarations
 */
function copyDeclarations() {
  console.log("📝 Copying TypeScript declarations...");

  const typesDir = "dist/types";
  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }

  // Copy types
  const typesFiles = fs.readdirSync("types");
  for (const file of typesFiles) {
    if (file.endsWith(".d.ts")) {
      fs.copyFileSync(path.join("types", file), path.join(typesDir, file));
    }
  }

  console.log("✅ TypeScript declarations copied");
}

/**
 * Generate package.json for dist
 */
function generateDistPackageJson() {
  console.log("📦 Generating package.json for dist...");

  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    author: packageJson.author,
    license: packageJson.license,
    main: "./cjs/index.js",
    module: "./esm/index.js",
    types: "./types/index.d.ts",
    exports: {
      ".": {
        import: "./esm/index.js",
        require: "./cjs/index.js",
        types: "./types/index.d.ts",
      },
      "./config": {
        import: "./esm/config/index.js",
        require: "./cjs/config/index.js",
      },
      "./utils": {
        import: "./esm/utils/index.js",
        require: "./cjs/utils/index.js",
      },
      "./utils/logger": {
        import: "./esm/utils/logger.js",
        require: "./cjs/utils/logger.js",
      },
      "./ui": {
        import: "./esm/ui/index.js",
        require: "./cjs/ui/index.js",
      },
      "./ui/progress": {
        import: "./esm/ui/progress.js",
        require: "./cjs/ui/progress.js",
      },
      "./template": {
        import: "./esm/template/index.js",
        require: "./cjs/template/index.js",
      },
      "./template/engine": {
        import: "./esm/template/engine.js",
        require: "./cjs/template/engine.js",
      },
    },
    bin: {
      rakitin: "./cjs/bin/rakitin.js",
    },
    files: ["dist/cjs", "dist/esm", "dist/types"],
   engines: {
      node: ">=14.0.0",
    },
  };

  fs.writeFileSync(
    "dist/package.json",
    JSON.stringify(distPackageJson, null, 2),
    "utf8"
  );

  console.log("✅ package.json generated");
}

/**
 * Clean build directory
 */
function cleanDist() {
  console.log("🧹 Cleaning dist directory...");

  if (fs.existsSync("dist")) {
    fs.rmSync("dist", { recursive: true, force: true });
  }

  console.log("✅ Clean complete");
}

/**
 * Main build function
 */
async function build() {
  const startTime = Date.now();

  console.log("🚀 Starting build process...\n");

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const clean = args.includes("--clean");
    const cjsOnly = args.includes("--cjs");
    const esmOnly = args.includes("--esm");

    // Clean if requested
    if (clean) {
      await cleanDist();
    }

    // Build based on flags
    if (esmOnly) {
      await buildESM();
    } else if (cjsOnly) {
      await buildCJS();
    } else {
      // Full build
      await buildCJS();
      await buildESM();
    }

    // Copy TypeScript declarations
    copyDeclarations();

    // Generate package.json for dist
    generateDistPackageJson();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Build completed in ${duration}s`);
  } catch (error) {
    console.error("❌ Build failed:", error.message);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = {
  buildCJS,
  buildESM,
  copyDeclarations,
  generateDistPackageJson,
  cleanDist,
};

// Run if called directly
if (require.main === module) {
  build();
}