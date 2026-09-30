/**
 * TypeScript Definitions for rakitin library
 * Strict mode enabled for maximum type safety
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Supported ORM types
 */
export type ORMType = 'Prisma' | 'Sequelize' | 'Mongoose' | 'TypeORM' | 'None';

/**
 * Supported architectures
 */
export type ArchitectureType = 'Simple' | 'Modular';

/**
 * Supported package managers
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/**
 * Supported log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  installed: string[];
  failed: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  message: string;
  errors?: string[];
}

// ============================================================================
// LOGGER TYPES
// ============================================================================

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: LogLevel;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  enableFileLogging?: boolean;
  logFilePath?: string;
  prefix?: string;
}

/**
 * Log levels enum
 */
export enum LogLevels {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  success(...args: unknown[]): void;
  setLevel(level: LogLevel | number): void;
  child(prefix: string): ILogger;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

/**
 * Default configuration structure
 */
export interface RakitinConfig {
  // Project structure
  basePath: string;
  modulesPath: string;
  sharedPath: string;
  routesPath: string;

  // Architecture defaults
  defaultArchitecture: ArchitectureType;
  defaultORM: ORMType;
  orm?: string;

  // Router settings
  autoIntegrateRouter: boolean;
  defaultRouterArchitecture: 'modular' | 'simple';

  // ORM packages
  ormPackages: Record<string, string[]>;

  // Logging
  logLevel: LogLevel;
  enableFileLogging: boolean;
  logFilePath: string;

  // UI settings
  enableColors: boolean;
  enableEmoji: boolean;
  verbose: boolean;

  // Package manager
  packageManager: PackageManager;

  // Generation options
  generateServiceLayer: boolean;
  generateValidationLayer: boolean;
  generateTestFiles: boolean;

  // Template settings
  templateEngine: 'ejs' | 'custom';
  includeComments: boolean;
  includeJSDoc: boolean;
}

/**
 * Config validation schema
 */
export interface ConfigSchema {
  [key: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    enum?: unknown[];
    min?: number;
    max?: number;
  };
}

// ============================================================================
// PROGRESS UI TYPES
// ============================================================================

/**
 * Spinner options
 */
export interface SpinnerOptions {
  message?: string;
  text?: string;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'white' | 'dim';
  frames?: string[];
  interval?: number;
}

export declare class Spinner {
  constructor(options?: string | SpinnerOptions);
  message: string;
  text: string;
  color: string;
  frames: string[];
  interval: number;
  start(message?: string): this;
  stop(finalMessage?: string, success?: boolean): this;
  succeed(message?: string): this;
  fail(message?: string): this;
  warn(message?: string): this;
  info(message?: string): this;
  setMessage(message: string): this;
  setColor(color: string): this;
  isSpinning(): boolean;
}

/**
 * Progress bar options
 */
export interface ProgressBarOptions {
  total?: number;
  current?: number;
  width?: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  prefix?: string;
  suffix?: string;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'white';
  completeColor?: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'white';
}

export declare class ProgressBar {
  constructor(options?: ProgressBarOptions);
  total: number;
  current: number;
  width: number;
  showPercentage: boolean;
  showLabel: boolean;
  label: string;
  prefix: string;
  suffix: string;
  color: string;
  completeColor: string;
  toString(): string;
  render(): void;
  update(current: number, label?: string | null): void;
  increment(amount?: number, label?: string | null): void;
  complete(message?: string): void;
  reset(): void;
}

/**
 * Step progress options
 */
export interface StepProgressOptions {
  showNumbers?: boolean;
  showIcons?: boolean;
  indentation?: number;
}

/**
 * Step status
 */
export type StepStatus = 'pending' | 'active' | 'complete' | 'error';

/**
 * Step definition
 */
export interface Step {
  id: number;
  name: string;
  status: StepStatus;
  message: string;
}

export declare class StepProgress {
  constructor(steps?: string[], options?: StepProgressOptions);
  steps: Step[];
  currentStepIndex: number;
  showNumbers: boolean;
  showIcons: boolean;
  indentation: number;
  start(stepId: number | string, message?: string): this;
  complete(message?: string): this;
  error(message?: string): this;
  reset(): void;
  getCurrentStep(): Step | null;
  getSteps(): Step[];
  isComplete(): boolean;
}

// ============================================================================
// TEMPLATE ENGINE TYPES
// ============================================================================

/**
 * Template delimiters
 */
export interface TemplateDelimiters {
  interpolate: string;
  evaluate: string;
  escape: string;
}

/**
 * Template engine options
 */
export interface TemplateEngineOptions {
  delimiters?: Partial<TemplateDelimiters>;
  helpers?: Record<string, (...args: unknown[]) => unknown>;
  enableCache?: boolean;
}

/**
 * Template helper function type
 */
export type TemplateHelper = (...args: unknown[]) => unknown;

// ============================================================================
// PATH RESOLVER TYPES
// ============================================================================

/**
 * Path resolver interface
 */
export interface IPathResolver {
  getModularRouterPath(moduleName: string, basePath: string): string;
  getSimpleRouterPath(moduleName: string, basePath: string): string;
  getSimpleControllerPath(moduleName: string, basePath: string): string;
  getModularControllerPath(moduleName: string, basePath: string): string;
  getModularRouterImportPath(moduleName: string): string;
  getSimpleControllerImportPath(moduleName: string): string;
  normalizeModuleName(moduleName: string): string;
  ensureDirectoryExists(filePath: string): void;
  getModulePath(moduleName: string, basePath: string): string;
  isValidPath(filePath: string): boolean;
}

// ============================================================================
// FILE VALIDATOR TYPES
// ============================================================================

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  path: string | null;
  error?: string;
}

/**
 * Router integration validation result
 */
export interface RouterIntegrationValidation {
  isValid: boolean;
  errors: string[];
}

// ============================================================================
// ERROR HANDLER TYPES
// ============================================================================

/**
 * Error types
 */
export enum ErrorTypes {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_PATH = 'INVALID_PATH',
  MODULE_VALIDATION = 'MODULE_VALIDATION',
  ROUTER_INTEGRATION = 'ROUTER_INTEGRATION',
  FILE_CREATION = 'FILE_CREATION',
  DIRECTORY_CREATION = 'DIRECTORY_CREATION',
  IMPORT_ERROR = 'IMPORT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error info structure
 */
export interface ErrorInfo {
  type: ErrorTypes;
  message: string;
  context: string;
  stack?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Path cache interface
 */
export interface IPathCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  has(key: string): boolean;
  clear(): void;
  size: number;
}

/**
 * Installation options
 */
export interface InstallOptions {
  isDev?: boolean;
  silent?: boolean;
  packageManager?: PackageManager;
  retry?: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

// ============================================================================
// MODULE GENERATION TYPES
// ============================================================================

/**
 * Module generation options
 */
export interface ModuleGenerationOptions {
  moduleName: string;
  architecture: ArchitectureType;
  useORM: boolean;
  orm?: ORMType;
  autoIntegrateRouter?: boolean;
  routerArchitecture?: 'modular' | 'simple';
}

/**
 * Module structure
 */
export interface ModuleStructure {
  name: string;
  path: string;
  files: string[];
  architecture: ArchitectureType;
  orm?: ORMType;
}

// ============================================================================
// CLI TYPES
// ============================================================================

/**
 * CLI command definition
 */
export interface CLICommand {
  name: string;
  description: string;
  handler: () => Promise<void>;
  options?: Record<string, unknown>;
}

/**
 * CLI options
 */
export interface CLIOptions {
  verbose?: boolean;
  silent?: boolean;
  config?: string;
}

// ============================================================================
// MAIN EXPORTS
// ============================================================================

// Logger exports
export { Logger, LOG_LEVELS, SYMBOLS, COLORS };
export default createLogger;

// Config exports
export { Config, createConfig, defaultConfig, DEFAULT_CONFIG, CONFIG_FILES };

// Progress UI exports
export { Spinner, ProgressBar, StepProgress };
export { createSpinner, createProgressBar, createStepProgress };

// Template engine exports
export { TemplateEngine, createEngine, engine, HELPERS, DEFAULT_DELIMITERS };

// Utility exports
export {
  ensureDir,
  writeFileIfNotExists,
  ensureBaseStructure,
  toPascalCase,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
  getCachedModulePath,
  clearPathCache,
  getPathCacheSize,
  PathCache,
};

// Installer exports
export {
  installIfNeeded,
  installIfNeededSync,
  installOrmPackages,
  isPackageInstalled,
  getPackageManager,
  PACKAGE_MANAGERS,
  DEFAULT_RETRY_CONFIG,
};

// Path resolver and file validator exports
export { PathResolver, FileValidator };

// Error handler exports
export { ErrorHandler };

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

// Logger factory
declare function createLogger(config?: LoggerConfig): ILogger;

// Config factory
declare function createConfig(initialConfig?: Partial<RakitinConfig>): Config;

// Template engine factory
declare function createEngine(options?: TemplateEngineOptions): TemplateEngine;

// Spinner factory
declare function createSpinner(options?: SpinnerOptions): Spinner;

// Progress bar factory
declare function createProgressBar(options?: ProgressBarOptions): ProgressBar;

// Step progress factory
declare function createStepProgress(steps?: string[], options?: StepProgressOptions): StepProgress;