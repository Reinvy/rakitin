/**
 * TypeScript definitions for rakitin (v3).
 *
 * This file is the `types` entry for the package root AND for every
 * `exports` subpath (`rakitin/config`, `rakitin/naming`, `rakitin/safety`,
 * `rakitin/utils`, `rakitin/utils/logger`, `rakitin/ui`,
 * `rakitin/ui/progress`, `rakitin/template`, `rakitin/template/engine`),
 * so it declares the complete runtime surface in one place.
 */

// ============================================================================
// SHARED TYPES
// ============================================================================

export type ORMName = "none" | "prisma" | "sequelize" | "mongoose" | "typeorm";
export type Architecture = "simple" | "modular";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type Preset = "basic" | "intermediate" | "advanced";
export type ModuleTemplate = "crud" | "readonly" | "graphql" | "realtime";
export type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "silent";
export type NameKind =
  | "module"
  | "middleware"
  | "config"
  | "util"
  | "resource"
  | "validator"
  | "plugin";

/** One entry of a `--dry-run` plan. */
export interface PlanEntry {
  op: "create" | "overwrite" | "mkdir" | "install";
  path: string;
  backup?: string | null;
}

/** Verdict of `writeFileIfNotExistsSafe`. */
export interface WriteVerdict {
  written: boolean;
  skipped: "exists" | null;
}

/** Verdict of `overwriteWithBackup`. */
export interface OverwriteVerdict {
  written: boolean;
  backedUp: boolean;
  backupPath: string | null;
}

/** Verdict of `updateJsonFile`. */
export interface JsonUpdateVerdict extends OverwriteVerdict {
  skipped: "unchanged" | null;
  value: Record<string, unknown>;
}

/** Verdict of `mergeEnvExample`. */
export interface EnvMergeVerdict {
  written: boolean;
  skipped: "marker-exists" | null;
  path: string;
}

/** What every generator returns. */
export interface GenerateResult {
  created: string[];
  skipped: string[];
  data?: Record<string, unknown>;
  nextSteps?: string[];
}

/** The unified result envelope printed by every command. */
export interface ResultEnvelope {
  ok: boolean;
  created: string[];
  skipped: string[];
  plan?: PlanEntry[];
  nextSteps: string[];
  message?: string;
  data?: unknown;
  error?: string;
}

/** Verdict of the dependency installer. */
export interface InstallResult {
  success: boolean;
  installed: string[];
  skipped: string[];
  failed: string[];
}

/** A child process invocation spec - never a shell string. */
export interface CommandSpec {
  command: string;
  args: string[];
}

/** Normalized CLI context built from yargs argv. */
export interface RakitinContext {
  root: string;
  json: boolean;
  yes: boolean;
  overwrite: boolean;
  dryRun: boolean;
  install: boolean;
  pm: PackageManager | null;
  preset: Preset;
  arch: Architecture;
  orm: ORMName;
  ormExplicit: boolean;
  generateValidationLayer: boolean;
  generateTestFiles: boolean;
  express?: boolean;
  force: boolean;
  autoIntegrateRouter: boolean;
  name: string | null;
  module: string | null;
  kind: string | null;
  customName: string | null;
  resource: string | null;
  fields: string | null;
  fromModule: string | null;
  common: boolean;
  all: boolean;
  template: string;
  withTests: boolean;
  title: string | null;
  apiVersion: string | null;
  auth?: boolean;
  pagination: boolean;
  filtering: boolean;
  wsPath: string;
  middleware: string | string[] | null;
  spec: string | null;
  configValues: Record<string, unknown>;
}

/** Conventional project paths for a root. */
export interface ProjectPaths {
  root: string;
  basePath: string;
  modulesPath: string;
  sharedPath: string;
  appRoutesPath: string;
  docsPath: string;
  prismaPath: string;
}

// ============================================================================
// NAMING
// ============================================================================

export function toPascalCase(str: string): string;
export function toCamelCase(str: string): string;
export function toKebabCase(str: string): string;
export function toSnakeCase(str: string): string;
export function toTitleCase(str: string): string;
export function toConstantCase(str: string): string;
export function normalizeModuleName(moduleName: string): string;
export function toIdentifier(str: string, options?: { casing?: "camel" | "pascal" }): string;
export function toSafeFileName(str: string): string;
export function assertSafeName(kind: NameKind, raw: string): string;
export function sanitizeFieldName(raw: string): string;
export function toFieldIdentifier(raw: string): string;
export function clearNamingCaches(): void;
export const RESERVED_WORDS: Set<string>;
export interface ModuleVariants {
  raw: string;
  kebab: string;
  pascal: string;
  camel: string;
  snake: string;
  constant: string;
  identifier: string;
}
export function getModuleVariants(moduleName: string): ModuleVariants;

// ============================================================================
// SAFETY
// ============================================================================

export function setDryRun(enabled: boolean): void;
export function isDryRun(): boolean;
export function setOverwrite(enabled: boolean): void;
export function isOverwrite(): boolean;
export function beginPlan(): void;
export function resetPlan(): void;
export function getPlan(): PlanEntry[];
export function backupPathFor(filePath: string): string;
export function writeFileIfNotExistsSafe(
  filePath: string,
  content?: string,
  overrides?: { dryRun?: boolean }
): WriteVerdict;
export function overwriteWithBackup(
  filePath: string,
  content: string,
  overrides?: { dryRun?: boolean }
): OverwriteVerdict;
export function writeOutcome(result: WriteVerdict): "created" | "skipped";
export function updateJsonFile(
  filePath: string,
  mutator: (obj: Record<string, unknown>) => Record<string, unknown> | false,
  overrides?: { dryRun?: boolean }
): JsonUpdateVerdict;
export function mergeEnvExample(
  root: string,
  marker: string,
  content: string,
  overrides?: { dryRun?: boolean }
): EnvMergeVerdict;
export function buildMarkedBlock(options: {
  existing: string | null;
  startToken: string;
  endToken: string;
  inner?: string;
  header?: string;
  eofFallback?: string;
  commentPrefix?: string;
}): { content: string; action: "create" | "inject" | "append" };
export function buildRoutesContent(
  existing: string | null,
  routeLines: string
): { content: string; action: "create" | "inject" | "append" };
export const runtime: { dryRun: boolean; plan: PlanEntry[] };
export const ROUTES_BLOCK_START: string;
export const ROUTES_BLOCK_END: string;
export const RESOURCE_BLOCK_START: string;
export const RESOURCE_BLOCK_END: string;
export const GRAPHQL_BLOCK_START: string;
export const GRAPHQL_BLOCK_END: string;
export const WS_BLOCK_START: string;
export const WS_BLOCK_END: string;
export const MAIN_ROUTER_HEADER: string;

// ============================================================================
// UTILS
// ============================================================================

export function ensureDir(dir: string): void;
export function writeFileIfNotExists(filePath: string, content?: string): boolean;
export function relativePosix(root: string, target: string): string;

// ============================================================================
// LOGGER
// ============================================================================

export interface LoggerOptions {
  level?: LogLevel | number;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableFileLogging?: boolean;
  logFilePath?: string;
  prefix?: string;
}

export class Logger {
  constructor(config?: LoggerOptions);
  config: LoggerOptions;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  success(...args: unknown[]): void;
  child(prefix: string): Logger;
  setLevel(level: LogLevel | number): void;
  setColors(enabled: boolean): void;
  setTimestamp(enabled: boolean): void;
  enableFileLogging(filePath?: string): void;
  disableFileLogging(): void;
  static getInstance(name?: string, config?: LoggerOptions): Logger;
  static clearInstances(): void;
}
export const LOG_LEVELS: Record<string, number>;
export const SYMBOLS: Record<string, string>;
export const COLORS: Record<string, string>;
export function createLogger(config?: LoggerOptions): Logger;

// ============================================================================
// UI
// ============================================================================

export class Spinner {
  constructor(options?: { text?: string; frames?: string[]; interval?: number });
  start(text?: string): this;
  stop(): this;
  succeed(text?: string): this;
  fail(text?: string): this;
  update(text: string): this;
}
export class ProgressBar {
  constructor(options?: { total?: number; width?: number; text?: string });
  start(): this;
  update(value: number, text?: string): this;
  increment(step?: number, text?: string): this;
  finish(text?: string): this;
}
export class StepProgress {
  constructor(options?: { steps?: string[]; text?: string });
  start(): this;
  next(text?: string): this;
  finish(): this;
}
export function createSpinner(options?: { text?: string }): Spinner;
export function createProgressBar(options?: { total?: number }): ProgressBar;
export function createStepProgress(options?: { steps?: string[] }): StepProgress;
export const SPINNER_FRAMES: string[];
export const CHECKMARK: string;
export const CROSS: string;
export const ARROW: string;

// ============================================================================
// TEMPLATE ENGINE
// ============================================================================

export class TemplateEngine {
  constructor(options?: {
    enableCache?: boolean;
    locals?: Record<string, unknown>;
    ejsOptions?: Record<string, unknown>;
  });
  cacheSize: number;
  render(template: string, data?: Record<string, unknown>): string;
  renderFile(filePath: string, data?: Record<string, unknown>): string;
  clearCache(): void;
}
export function renderTemplate(template: string, data?: Record<string, unknown>): string;
export const defaultEngine: TemplateEngine;

// ============================================================================
// CONFIG
// ============================================================================

export interface RakitinConfig {
  version: number;
  preset: Preset | null;
  arch: Architecture | null;
  orm: ORMName | null;
  packageManager: PackageManager | null;
  autoIntegrateRouter: boolean;
  generateValidationLayer: boolean;
  generateTestFiles: boolean;
  plugins: string[];
}

export class Config {
  constructor(initialConfig?: Partial<RakitinConfig>);
  load(root?: string): this;
  reload(root?: string): this;
  reset(): this;
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): this;
  has(key: string): boolean;
  hasExplicit(key: string): boolean;
  explicitKeys(): string[];
  all(): RakitinConfig & Record<string, unknown>;
  toJSON(): RakitinConfig & Record<string, unknown>;
  getSources(): Array<{ source: string; timestamp: string }>;
  child(prefix: string): Config;
  validate(schema: Record<string, { required?: boolean; type?: string; enum?: unknown[] }>): {
    valid: boolean;
    errors: string[];
  };
}
export function createConfig(initialConfig?: Partial<RakitinConfig>): Config;
export const DEFAULT_CONFIG: RakitinConfig;
export const CONFIG_FILES: string[];
export const CONFIG_KEYS: string[];
export const PRESETS: Preset[];

// ============================================================================
// PROJECT DETECTION
// ============================================================================

export interface ModuleInfo {
  dirName: string;
  name: string;
  architecture: Architecture | null;
}
export interface DetectedProject {
  root: string;
  detectedAt: string;
  isNpmProject: boolean;
  packageName: string | null;
  nodeEngine: string | null;
  hasExpress: boolean;
  expressVersion: string | null;
  packageManager: PackageManager | null;
  dependencies: Record<string, string>;
  ormsInstalled: Record<string, boolean>;
  structure: {
    hasAppBase: boolean;
    modulesDirExists: boolean;
    modules: ModuleInfo[];
    modularCount: number;
    simpleCount: number;
    mixedArchitectures: boolean;
    hasMainRouter: boolean;
    routerPath: string;
    routerHasMarkers: boolean;
    availableMiddlewares: string[];
  };
  config: {
    file: string | null;
    preset: string | null;
    orm: string | null;
    defaultArchitecture: string | null;
  };
}
export function detectProject(root?: string): DetectedProject;
export function readPackageJson(root: string): Record<string, unknown> | null;

// ============================================================================
// DEPENDENCY MANIFEST
// ============================================================================

export const KIND_DEPENDENCIES: Record<string, string[]>;
export const DEV_KINDS: Set<string>;
export const ORM_KINDS: Record<string, string>;
export function resolvePackagesForKinds(
  kinds: string[],
  extraKinds?: Record<string, string[]>
): { packages: string[]; devPackages: string[]; unknownKinds: string[] };
export function ensureDependencies(
  kinds?: string[],
  options?: {
    pm?: PackageManager;
    install?: boolean;
    dev?: boolean;
    silent?: boolean;
    extraKinds?: Record<string, string[]>;
    root?: string;
  }
): Promise<InstallResult>;
export function ormToKind(orm: string): string;

// ============================================================================
// PLUGINS
// ============================================================================

export interface PluginManifest {
  apiVersion: number;
  name: string;
  version?: string;
  description?: string;
  generators?: Record<
    string,
    { describe?: string; generate: (ctx: unknown, args: unknown) => Promise<GenerateResult> }
  >;
  commands?: Array<{ name: string; describe?: string; handler: (argv: unknown, ctx: unknown) => Promise<unknown> }>;
  hooks?: Record<string, (...args: unknown[]) => unknown>;
  dependencies?: Record<string, string[]>;
}
export interface PluginLoadResult {
  plugins: Array<{ entry: string; manifest: PluginManifest }>;
  errors: Array<{ entry: string; message: string }>;
}
export function loadPlugins(options?: {
  root?: string;
  config?: unknown;
  logger?: unknown;
}): PluginLoadResult;
export function createRegistry(plugins?: unknown[]): {
  generators: Record<string, unknown>;
  commands: Record<string, unknown>;
  hooks: Record<string, unknown[]>;
  extraKinds: Record<string, string[]>;
};
export function getHooks(ctx: unknown): {
  preGenerate: Array<(ctx: unknown) => unknown>;
  postGenerate: Array<(ctx: unknown, result: unknown) => unknown>;
  preInstall: Array<(ctx: unknown) => unknown>;
  postInstall: Array<(ctx: unknown, result: unknown) => unknown>;
  onError: Array<(ctx: unknown, error: unknown) => unknown>;
};
export function buildPluginContext(context: unknown, pluginArgs?: unknown): unknown;
export function getGenerators(ctx: unknown): Record<string, { describe?: string; generate: unknown }>;
export function getExtraKinds(ctx?: unknown): Record<string, string[]>;
export function resetPlugins(): void;

// ============================================================================
// COMMANDS
// ============================================================================

export function buildContext(argv?: Record<string, unknown>): RakitinContext;
export function enterProjectRoot(context: RakitinContext): void;
export function printResult(result: Partial<ResultEnvelope>, context?: RakitinContext | null): void;
export function printFailure(error: unknown, json?: boolean): void;
export function isJsonMode(): boolean;
export function enableJsonMode(): void;
export function toProjectRelative(target: string, root: string): string;
export function runWithPlugins(
  context: RakitinContext,
  pluginArgs: Record<string, unknown>,
  fn: () => Promise<unknown>
): Promise<unknown>;
export function runWithPluginInstall(context: RakitinContext, fn: () => Promise<unknown>): Promise<unknown>;
export function withSpinner<T>(label: string, fn: () => Promise<T>): Promise<T>;

export function initCommand(context?: Partial<RakitinContext>): Promise<ResultEnvelope>;
export function addCommand(
  thing: string,
  name: string | undefined,
  context?: Partial<RakitinContext>
): Promise<ResultEnvelope>;
export function integrateCommand(options?: {
  middleware?: string | string[] | null;
  root?: string;
}): Promise<ResultEnvelope>;
export function recipeCommand(name: string, context?: Partial<RakitinContext>): Promise<ResultEnvelope>;
export function configCommand(
  argv: Record<string, unknown>,
  context?: Partial<RakitinContext>
): Promise<ResultEnvelope>;
export function infoCommand(context?: Partial<RakitinContext>): ResultEnvelope;
export function bareSummary(context?: Partial<RakitinContext>): ResultEnvelope;
export function doctorCommand(context?: Partial<RakitinContext>): Promise<ResultEnvelope>;
export function listCommand(context?: Partial<RakitinContext>): ResultEnvelope;
export function pluginCommand(
  action: string,
  spec: string | undefined,
  context?: Partial<RakitinContext>
): Promise<ResultEnvelope>;

// ============================================================================
// PACKAGE ROOT (lib/index.js)
// ============================================================================

export const version: string;
export const bareSummary: (context?: Partial<RakitinContext>) => ResultEnvelope;

/** Naming helpers namespace (`rakitin.naming`). */
export const naming: {
  toPascalCase: typeof toPascalCase;
  toCamelCase: typeof toCamelCase;
  toKebabCase: typeof toKebabCase;
  toSnakeCase: typeof toSnakeCase;
  toTitleCase: typeof toTitleCase;
  toConstantCase: typeof toConstantCase;
  normalizeModuleName: typeof normalizeModuleName;
  getModuleVariants: typeof getModuleVariants;
  toIdentifier: typeof toIdentifier;
  toSafeFileName: typeof toSafeFileName;
  assertSafeName: typeof assertSafeName;
  sanitizeFieldName: typeof sanitizeFieldName;
  toFieldIdentifier: typeof toFieldIdentifier;
  RESERVED_WORDS: typeof RESERVED_WORDS;
  clearNamingCaches: typeof clearNamingCaches;
};

/** Safety layer namespace (`rakitin.safety`). */
export const safety: {
  setDryRun: typeof setDryRun;
  isDryRun: typeof isDryRun;
  setOverwrite: typeof setOverwrite;
  isOverwrite: typeof isOverwrite;
  beginPlan: typeof beginPlan;
  resetPlan: typeof resetPlan;
  getPlan: typeof getPlan;
  backupPathFor: typeof backupPathFor;
  writeFileIfNotExistsSafe: typeof writeFileIfNotExistsSafe;
  overwriteWithBackup: typeof overwriteWithBackup;
  writeOutcome: typeof writeOutcome;
  updateJsonFile: typeof updateJsonFile;
  mergeEnvExample: typeof mergeEnvExample;
  buildMarkedBlock: typeof buildMarkedBlock;
  buildRoutesContent: typeof buildRoutesContent;
  runtime: typeof runtime;
};

/** Config namespace (`rakitin.config`). */
export const config: {
  Config: typeof Config;
  createConfig: typeof createConfig;
  DEFAULT_CONFIG: typeof DEFAULT_CONFIG;
  CONFIG_FILES: typeof CONFIG_FILES;
  CONFIG_KEYS: typeof CONFIG_KEYS;
  PRESETS: typeof PRESETS;
};

/** Project detection namespace (`rakitin.project`). */
export const project: {
  detectProject: typeof detectProject;
  readPackageJson: typeof readPackageJson;
};

/** Dependency manifest namespace (`rakitin.deps`). */
export const deps: {
  KIND_DEPENDENCIES: typeof KIND_DEPENDENCIES;
  DEV_KINDS: typeof DEV_KINDS;
  ORM_KINDS: typeof ORM_KINDS;
  resolvePackagesForKinds: typeof resolvePackagesForKinds;
  ensureDependencies: typeof ensureDependencies;
  ormToKind: typeof ormToKind;
};

/** Command layer namespace (`rakitin.commands`). */
export const commands: {
  initCommand: typeof initCommand;
  addCommand: typeof addCommand;
  integrateCommand: typeof integrateCommand;
  recipeCommand: typeof recipeCommand;
  configCommand: typeof configCommand;
  infoCommand: typeof infoCommand;
  bareSummary: typeof bareSummary;
  doctorCommand: typeof doctorCommand;
  listCommand: typeof listCommand;
  pluginCommand: typeof pluginCommand;
  buildContext: typeof buildContext;
  printResult: typeof printResult;
  printFailure: typeof printFailure;
  enableJsonMode: typeof enableJsonMode;
};

/** Plugin host namespace (`rakitin.plugins`). */
export const plugins: {
  loadPlugins: typeof loadPlugins;
  createRegistry: typeof createRegistry;
  getHooks: typeof getHooks;
  buildPluginContext: typeof buildPluginContext;
  getGenerators: typeof getGenerators;
  getExtraKinds: typeof getExtraKinds;
  resetPlugins: typeof resetPlugins;
};
