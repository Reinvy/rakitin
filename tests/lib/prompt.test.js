const inquirer = require("inquirer");
const { mainPrompt } = require("../../lib/prompt");

jest.mock("inquirer", () => {
  class Separator {
    constructor() {
      this.type = "separator";
    }
  }
  const create = () => ({ prompt: jest.fn(), Separator });
  return { __esModule: true, ...create(), default: create() };
});

const EXPECTED_FEATURES = [
  "Module",
  "Middleware",
  "Util",
  "Config",
  "Router Integration",
  "API Endpoint",
  "API Documentation",
  "API Validation",
  "exit",
];

describe("Prompt", () => {
  beforeEach(() => {
    inquirer.default.prompt.mockReset();
  });

  test("passes a list question containing all feature choices + separators", async () => {
    inquirer.default.prompt.mockResolvedValue({ feature: "Module" });

    await mainPrompt();

    expect(inquirer.default.prompt).toHaveBeenCalledTimes(1);
    const [questions] = inquirer.default.prompt.mock.calls[0];
    expect(questions).toHaveLength(1);

    const q = questions[0];
    expect(q.type).toBe("list");
    expect(q.name).toBe("feature");

    const values = q.choices
      .filter((c) => typeof c === "object" && c.value !== undefined)
      .map((c) => c.value);
    expect(values).toEqual(EXPECTED_FEATURES);

    // Separator instances are interleaved after the CLI groups and before Exit
    const separators = q.choices.filter(
      (c) => typeof c === "object" && c.type === "separator"
    );
    expect(separators).toHaveLength(2);
  });

  test.each(EXPECTED_FEATURES.filter((f) => f !== "exit"))(
    "returns the selected %s feature",
    async (feature) => {
      inquirer.default.prompt.mockResolvedValue({ feature });
      const result = await mainPrompt();
      expect(result).toEqual({ feature });
    }
  );

  test("propagates prompt errors (handled by caller)", async () => {
    inquirer.default.prompt.mockRejectedValue(new Error("User cancelled"));
    await expect(mainPrompt()).rejects.toThrow("User cancelled");
  });
});
