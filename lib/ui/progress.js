/**
 * Progress UI - Terminal progress indicators
 * Includes: Spinner, Progress Bar, Step Indicators
 */

const logger = require("../utils/logger");

/**
 * ANSI color codes
 */
const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  dim: "\x1b[2m",
};

/**
 * Spinner frames for animation
 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Success checkmark symbol
 */
const CHECKMARK = "✓";

/**
 * Cross mark symbol
 */
const CROSS = "✗";

/**
 * Arrow symbol
 */
const ARROW = "→";

/**
 * Spinner class for animated loading indicator
 */
class Spinner {
  /**
   * Create a new Spinner
   * @param {Object|string} options - Spinner options or message string
   */
  constructor(options = {}) {
    if (typeof options === "string") {
      this.message = options;
    } else {
      this.message = options.message || options.text || "Loading";
    }
    this.color = options.color || "cyan";
    this.frames = options.frames || SPINNER_FRAMES;
    this.interval = options.interval || 80;
    this._frameIndex = 0;
    this._intervalId = null;
    this._isSpinning = false;
  }

  get text() {
    return this.message;
  }

  set text(value) {
    this.message = value;
  }

  /**
   * Start the spinner animation
   * @param {string} [message] - Optional message to set before starting
   * @returns {Spinner}
   */
  start(message) {
    if (message !== undefined) {
      this.message = message;
    }
    if (this._isSpinning) return this;

    this._isSpinning = true;
    this._frameIndex = 0;

    const colorCode = COLORS[this.color] || COLORS.cyan;

    this._intervalId = setInterval(() => {
      const frame = this.frames[this._frameIndex];
      const output = `\r${colorCode}${frame}${COLORS.reset} ${this.message}`;
      process.stdout.write(output);

      this._frameIndex = (this._frameIndex + 1) % this.frames.length;
    }, this.interval);

    return this;
  }

  /**
   * Stop the spinner
   * @param {string} finalMessage - Final message to display
   * @param {boolean} success - Whether to show success indicator
   * @returns {Spinner}
   */
  stop(finalMessage = "", success = true) {
    if (!this._isSpinning) return this;

    clearInterval(this._intervalId);
    this._isSpinning = false;
    this._intervalId = null;

    // Clear the current line
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      process.stdout.write("\r" + " ".repeat(80) + "\r");
    }

    if (finalMessage) {
      const color = success ? "green" : "red";
      const symbol = success ? CHECKMARK : CROSS;
      const colorCode = COLORS[color];

      process.stdout.write(`${colorCode}${symbol}${COLORS.reset} ${finalMessage}\n`);
    }

    return this;
  }

  /**
   * Stop spinner with success indicator
   * @param {string} [message] - Optional completion message (defaults to this.message)
   * @returns {Spinner}
   */
  succeed(message) {
    return this.stop(message !== undefined ? message : this.message, true);
  }

  /**
   * Stop spinner with failure indicator
   * @param {string} [message] - Optional failure message (defaults to this.message)
   * @returns {Spinner}
   */
  fail(message) {
    return this.stop(message !== undefined ? message : this.message, false);
  }

  /**
   * Stop spinner with warning indicator
   * @param {string} [message] - Optional warning message (defaults to this.message)
   * @returns {Spinner}
   */
  warn(message) {
    if (!this._isSpinning) return this;
    clearInterval(this._intervalId);
    this._isSpinning = false;
    this._intervalId = null;

    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      process.stdout.write("\r" + " ".repeat(80) + "\r");
    }

    const msg = message !== undefined ? message : this.message;
    if (msg) {
      process.stdout.write(`${COLORS.yellow}⚠${COLORS.reset} ${msg}\n`);
    }
    return this;
  }

  /**
   * Stop spinner with info indicator
   * @param {string} [message] - Optional info message (defaults to this.message)
   * @returns {Spinner}
   */
  info(message) {
    if (!this._isSpinning) return this;
    clearInterval(this._intervalId);
    this._isSpinning = false;
    this._intervalId = null;

    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      process.stdout.write("\r" + " ".repeat(80) + "\r");
    }

    const msg = message !== undefined ? message : this.message;
    if (msg) {
      process.stdout.write(`${COLORS.blue}${ARROW}${COLORS.reset} ${msg}\n`);
    }
    return this;
  }

  /**
   * Update the spinner message
   * @param {string} message - New message
   * @returns {Spinner}
   */
  setMessage(message) {
    this.message = message;
    return this;
  }

  /**
   * Update spinner color
   * @param {string} color - New color
   * @returns {Spinner}
   */
  setColor(color) {
    this.color = color;
    return this;
  }

  /**
   * Check if spinner is currently spinning
   * @returns {boolean}
   */
  isSpinning() {
    return this._isSpinning;
  }
}

/**
 * Progress Bar class
 */
class ProgressBar {
  /**
   * Create a new ProgressBar
   * @param {Object} options - Progress bar options
   */
  constructor(options = {}) {
    this.total = options.total || 100;
    this.current = options.current || 0;
    this.width = options.width || 40;
    this.showPercentage = options.showPercentage !== false;
    this.showLabel = options.showLabel !== false;
    this.label = options.label || "";
    this.prefix = options.prefix || "";
    this.suffix = options.suffix || "";
    this.color = options.color || "cyan";
    this.completeColor = options.completeColor || "green";
  }

  /**
   * Get the progress bar string
   * @returns {string}
   */
  toString() {
    const percentage = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    const filledWidth = Math.round((this.current / this.total) * this.width);
    const emptyWidth = this.width - filledWidth;

    const bar = "█".repeat(filledWidth) + "░".repeat(emptyWidth);

    const colorCode =
      percentage === 100
        ? COLORS[this.completeColor] || COLORS.green
        : COLORS[this.color] || COLORS.cyan;

    let output = `${colorCode}[${bar}]${COLORS.reset}`;

    if (this.showPercentage) {
      output += ` ${percentage}%`;
    }

    if (this.label) {
      output += ` ${this.label}`;
    }

    if (this.prefix) {
      output = `${this.prefix} ${output}`;
    }

    if (this.suffix) {
      output += ` ${this.suffix}`;
    }

    return output;
  }

  /**
   * Render the progress bar
   */
  render() {
    process.stdout.write(`\r${this.toString()}`);
  }

  /**
   * Update progress
   * @param {number} current - Current progress value
   * @param {string} label - Optional label
   */
  update(current, label = null) {
    this.current = Math.min(Math.max(current, 0), this.total);
    if (label !== null) {
      this.label = label;
    }
    this.render();
  }

  /**
   * Increment progress
   * @param {number} amount - Amount to increment
   * @param {string} label - Optional label
   */
  increment(amount = 1, label = null) {
    this.update(this.current + amount, label);
  }

  /**
   * Complete the progress bar
   * @param {string} message - Final message
   */
  complete(message = "Done") {
    this.current = this.total;
    this.render();
    process.stdout.write("\n");

    if (message) {
      const colorCode = COLORS[this.completeColor] || COLORS.green;
      process.stdout.write(`${colorCode}${CHECKMARK}${COLORS.reset} ${message}\n`);
    }
  }

  /**
   * Reset the progress bar
   */
  reset() {
    this.current = 0;
    this.label = "";
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
}

/**
 * Multi-step progress tracker
 */
class StepProgress {
  /**
   * Create a new StepProgress
   * @param {Array<string>} steps - List of step names
   * @param {Object} options - Options
   */
  constructor(steps = [], options = {}) {
    this.steps = steps.map((name, index) => ({
      id: index,
      name,
      status: "pending", // pending, active, complete, error
      message: "",
    }));
    this.currentStepIndex = -1;
    this.showNumbers = options.showNumbers !== false;
    this.showIcons = options.showIcons !== false;
    this.indentation = options.indentation || 2;
  }

  /**
   * Get the indentation string
   * @returns {string}
   */
  _getIndent() {
    return " ".repeat(this.indentation);
  }

  /**
   * Get status icon
   * @param {string} status - Step status
   * @returns {string}
   */
  _getIcon(status) {
    if (!this.showIcons) return "";

    switch (status) {
      case "complete":
        return `${COLORS.green}${CHECKMARK}${COLORS.reset} `;
      case "error":
        return `${COLORS.red}${CROSS}${COLORS.reset} `;
      case "active":
        return `${COLORS.cyan}●${COLORS.reset} `;
      default:
        return `${COLORS.dim}○${COLORS.reset} `;
    }
  }

  /**
   * Start a step
   * @param {number|string} stepId - Step index or name
   * @param {string} message - Optional message
   */
  start(stepId, message = "") {
    let step;

    if (typeof stepId === "number") {
      step = this.steps[stepId];
    } else {
      step = this.steps.find((s) => s.name === stepId);
    }

    if (!step) {
      logger.warn(`Step "${stepId}" not found`);
      return this;
    }

    // Mark previous step as complete if exists
    if (this.currentStepIndex >= 0) {
      this.steps[this.currentStepIndex].status = "complete";
    }

    this.currentStepIndex = step.id;
    step.status = "active";
    step.message = message;

    this._render();
    return this;
  }

  /**
   * Complete the current step
   * @param {string} message - Completion message
   */
  complete(message = "") {
    if (this.currentStepIndex >= 0) {
      const step = this.steps[this.currentStepIndex];
      step.status = "complete";
      if (message) step.message = message;
    }
    this._render();
    return this;
  }

  /**
   * Mark current step as error
   * @param {string} message - Error message
   */
  error(message = "") {
    if (this.currentStepIndex >= 0) {
      const step = this.steps[this.currentStepIndex];
      step.status = "error";
      if (message) step.message = message;
    }
    this._render();
    return this;
  }

  /**
   * Render all steps
   */
  _render() {
    const lines = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const icon = this._getIcon(step.status);

      let line = this._getIndent();

      if (this.showNumbers) {
        const number = i + 1;
        const total = this.steps.length;
        line += `${COLORS.dim}[${number}/${total}]${COLORS.reset} `;
      }

      line += `${icon}${step.name}`;

      if (step.message) {
        line += `${COLORS.dim} - ${step.message}${COLORS.reset}`;
      }

      lines.push(line);
    }

    // Clear previous output
    process.stdout.write("\r" + "\x1b[K");

    // Print all lines
    const output = "\n" + lines.join("\n") + "\n";

    // Move cursor back to current step
    const cursorUp = `\x1b[${this.steps.length}A`;
    process.stdout.write(cursorUp + output);
  }

  /**
   * Reset all steps
   */
  reset() {
    this.steps.forEach((step) => {
      step.status = "pending";
      step.message = "";
    });
    this.currentStepIndex = -1;
  }

  /**
   * Get current step
   * @returns {Object|null}
   */
  getCurrentStep() {
    return this.currentStepIndex >= 0 ? this.steps[this.currentStepIndex] : null;
  }

  /**
   * Get all steps
   * @returns {Array}
   */
  getSteps() {
    return [...this.steps];
  }

  /**
   * Check if all steps are complete
   * @returns {boolean}
   */
  isComplete() {
    return this.steps.every((step) => step.status === "complete");
  }
}

// Factory functions
function createSpinner(options = {}) {
  return new Spinner(options);
}

function createProgressBar(options = {}) {
  return new ProgressBar(options);
}

function createStepProgress(steps = [], options = {}) {
  return new StepProgress(steps, options);
}

module.exports = {
  Spinner,
  ProgressBar,
  StepProgress,
  createSpinner,
  createProgressBar,
  createStepProgress,
  SPINNER_FRAMES,
  CHECKMARK,
  CROSS,
  ARROW,
  COLORS,
};
