/**
 * lib/commands/info.js - `rakitin info` / `rakitin doctor` / `rakitin list`
 * Introspection & health-check of the current project, with warnings a
 * maintainer actually acts on.
 */

const { detectProject } = require("../project/detector");

/**
 * Health checks over the detected project.
 * @returns {{checks: Array<{name, status: "ok"|"warn"|"fail"|"info", detail?: string}>, project: object}}
 */
function doctorCommand() {
  const root = process.cwd();
  const project = detectProject(root);
  const checks = [];
  const s = project.structure;

  checks.push({
    name: "package.json",
    status: project.isNpmProject ? "ok" : "fail",
    detail: project.isNpmProject
      ? `${project.packageName || "(tanpa nama)"} · engine ${project.nodeEngine || "tidak diset"}`
      : "Tidak ada package.json di direktori ini",
  });

  checks.push({
    name: "Express",
    status: project.hasExpress ? "ok" : "warn",
    detail: project.hasExpress
      ? `v${project.expressVersion}`
      : "Belum terpasang - generator basic tetap bisa dipakai",
  });

  checks.push({
    name: "Struktur app/",
    status: s.hasAppBase ? "ok" : "info",
    detail: s.hasAppBase
      ? "app/ ditemukan"
      : "app/ belum ada (akan dibuat saat generate)",
  });

  const moduleStatus = s.mixedArchitectures
    ? "warn"
    : modulesCount(s) > 0
      ? "ok"
      : "info";
  checks.push({
    name: "Modul",
    status: moduleStatus,
    detail:
      modulesCount(s) === 0
        ? "Belum ada modul"
        : `${s.modularCount} modular · ${s.simpleCount} simple${
            s.mixedArchitectures
              ? " (arsitektur campuran - auto-router tetap mendukung)"
              : ""
          }`,
  });

  checks.push({
    name: "Router utama",
    status: !s.hasMainRouter ? "info" : s.routerHasMarkers ? "ok" : "warn",
    detail: !s.hasMainRouter
      ? "app/routes/index.js belum ada"
      : s.routerHasMarkers
        ? "menggunakan marker rakitin (aman diregenerasi)"
        : "ada tapi tanpa marker - integrasi akan menyisipkan blok dengan backup .bak",
  });

  // Dependency vs generated-code audit: middleware files reference packages.
  const missingDeps = [];
  const needsJsonWebToken =
    s.availableMiddlewares.includes("auth") && !project.dependencies.jsonwebtoken;
  if (needsJsonWebToken) missingDeps.push("jsonwebtoken");
  if (missingDeps.length) {
    checks.push({
      name: "Dependency middleware",
      status: "warn",
      detail: `Dibutuhkan tapi belum terpasang: ${missingDeps.join(", ")}`,
    });
  }

  return { checks, project };
}

function modulesCount(s) {
  return s.modularCount + s.simpleCount;
}

/** `rakitin info` - compact JSON-ish overview */
function infoCommand() {
  const project = detectProject(process.cwd());
  return {
    summary: {
      root: project.root,
      npmProject: project.isNpmProject,
      express: project.expressVersion,
      packageManager: project.packageManager,
      preset: project.config.preset,
      modules: {
        modular: project.structure.modularCount,
        simple: project.structure.simpleCount,
        mixed: project.structure.mixedArchitectures,
      },
      mainRouter: {
        exists: project.structure.hasMainRouter,
        markerManaged: project.structure.routerHasMarkers,
      },
      middlewares: project.structure.availableMiddlewares,
    },
    raw: project,
  };
}

/** `rakitin list` - catalog of what this CLI can generate. */
const CATALOG = [
  {
    command: "add module <name>",
    tiers: ["basic", "intermediate", "advanced"],
    desc: "Controller/service/router (+ORM wiring di tier atas)",
  },
  {
    command: "add middleware <kind>",
    tiers: ["basic"],
    kind: ["custom", "auth", "logger", "error", "request-time"],
    desc: "Middleware Express siap pakai",
  },
  {
    command: "add util <kind>",
    tiers: ["basic"],
    kind: [
      "custom",
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
    desc: "Utility fungsi umum",
  },
  {
    command: "add config <kind>",
    tiers: ["basic"],
    kind: [
      "app",
      "database",
      "jwt",
      "cors",
      "logger",
      "mailer",
      "cloud",
      "payment",
      "redis",
      "socket",
      "env",
      "custom",
    ],
    desc: "Config file berbasis env",
  },
  {
    command: "add endpoint <resource>",
    tiers: ["intermediate"],
    kind: ["pagination", "filtering", "joi"],
    desc: "CRUD endpoint untuk modul existing",
  },
  {
    command: "add validation [name]",
    tiers: ["intermediate"],
    kind: ["module", "new", "common"],
    desc: "Skema validasi Joi",
  },
  {
    command: "add docs <kind>",
    tiers: ["advanced"],
    kind: ["openapi-json", "openapi-yaml", "swagger-ui", "complete"],
    desc: "OpenAPI/Swagger scaffolding",
  },
  {
    command: "recipe auth",
    tiers: ["advanced"],
    desc: "JWT auth lengkap (middleware + user module + joi)",
  },
  {
    command: "recipe swagger",
    tiers: ["advanced"],
    desc: "OpenAPI 3 + swagger-ui terhubung modul",
  },
  {
    command: "recipe test",
    tiers: ["advanced"],
    desc: "Scaffold jest + supertest per modul",
  },
  {
    command: "recipe docker",
    tiers: ["advanced"],
    desc: "Dockerfile multi-stage + compose",
  },
  {
    command: "integrate",
    tiers: ["basic"],
    desc: "Sambungkan router utama (marker-based, idempotent)",
  },
];

function listCommand() {
  return { catalog: CATALOG };
}

module.exports = { doctorCommand, infoCommand, listCommand, CATALOG };
