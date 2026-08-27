/**
 * Unit tests for Progress UI (Spinner, ProgressBar, StepProgress)
 */

const {
  Spinner,
  ProgressBar,
  StepProgress,
  createSpinner,
  createProgressBar,
  createStepProgress,
} = require("../../lib/ui/progress");
const { withSpinner } = require("../../lib/commands/shared");

describe("Progress UI", () => {
  let stdoutWriteSpy;

  beforeEach(() => {
    stdoutWriteSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  describe("Spinner", () => {
    let spinner;

    afterEach(() => {
      if (spinner && spinner.isSpinning()) {
        spinner.stop();
      }
    });

    it("should construct with string message", () => {
      spinner = new Spinner("Test loading");
      expect(spinner.message).toBe("Test loading");
      expect(spinner.text).toBe("Test loading");
    });

    it("should construct with text option", () => {
      spinner = new Spinner({ text: "Custom text" });
      expect(spinner.message).toBe("Custom text");
      expect(spinner.text).toBe("Custom text");
    });

    it("should support text getter and setter", () => {
      spinner = new Spinner();
      spinner.text = "Updated text";
      expect(spinner.message).toBe("Updated text");
      expect(spinner.text).toBe("Updated text");
    });

    it("should start and stop", () => {
      spinner = createSpinner({ message: "Spinning..." });
      expect(spinner.isSpinning()).toBe(false);
      spinner.start();
      expect(spinner.isSpinning()).toBe(true);
      spinner.stop("All done", true);
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should support succeed() method", () => {
      spinner = new Spinner({ text: "Processing" });
      spinner.start();
      expect(spinner.isSpinning()).toBe(true);
      spinner.succeed();
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should support succeed() with custom message", () => {
      spinner = new Spinner({ text: "Processing" });
      spinner.start();
      spinner.succeed("Completed successfully!");
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should support fail() method", () => {
      spinner = new Spinner({ text: "Failing task" });
      spinner.start();
      expect(spinner.isSpinning()).toBe(true);
      spinner.fail();
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should support fail() with custom message", () => {
      spinner = new Spinner({ text: "Failing task" });
      spinner.start();
      spinner.fail("Failed miserably!");
      expect(spinner.isSpinning()).toBe(false);
    });

    it("should support warn() and info() methods", () => {
      spinner = new Spinner({ text: "Warning task" });
      spinner.start();
      spinner.warn("Caution!");
      expect(spinner.isSpinning()).toBe(false);

      spinner = new Spinner({ text: "Info task" });
      spinner.start();
      spinner.info("Here is info");
      expect(spinner.isSpinning()).toBe(false);
    });
  });

  describe("ProgressBar", () => {
    it("should create and render progress bar", () => {
      const bar = createProgressBar({ total: 100, width: 20 });
      expect(bar.total).toBe(100);
      bar.update(50, "Halfway");
      expect(bar.current).toBe(50);
      bar.increment(25);
      expect(bar.current).toBe(75);
      bar.complete("Done");
      expect(bar.current).toBe(100);
    });
  });

  describe("StepProgress", () => {
    it("should track multi-step progress", () => {
      const stepProgress = createStepProgress(["Step 1", "Step 2", "Step 3"]);
      expect(stepProgress.getSteps()).toHaveLength(3);
      stepProgress.start(0, "Starting 1");
      expect(stepProgress.getCurrentStep().name).toBe("Step 1");
      stepProgress.complete("Done 1");
      stepProgress.start("Step 2");
      expect(stepProgress.getCurrentStep().name).toBe("Step 2");
      stepProgress.error("Failed 2");
      expect(stepProgress.getCurrentStep().status).toBe("error");
    });
  });

  describe("withSpinner in shared.js", () => {
    it("should execute task and succeed without error in TTY mode", async () => {
      const originalIsTTY = process.stdout.isTTY;
      const originalWorkerId = process.env.JEST_WORKER_ID;
      try {
        process.stdout.isTTY = true;
        delete process.env.JEST_WORKER_ID;

        const result = await withSpinner("Testing spinner", async () => {
          return "ok";
        });
        expect(result).toBe("ok");
      } finally {
        process.stdout.isTTY = originalIsTTY;
        process.env.JEST_WORKER_ID = originalWorkerId;
      }
    });

    it("should call fail and rethrow if task fails in TTY mode", async () => {
      const originalIsTTY = process.stdout.isTTY;
      const originalWorkerId = process.env.JEST_WORKER_ID;
      try {
        process.stdout.isTTY = true;
        delete process.env.JEST_WORKER_ID;

        await expect(
          withSpinner("Testing error", async () => {
            throw new Error("Task failed");
          })
        ).rejects.toThrow("Task failed");
      } finally {
        process.stdout.isTTY = originalIsTTY;
        process.env.JEST_WORKER_ID = originalWorkerId;
      }
    });
  });
});
