const {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
  getModuleVariants,
  toIdentifier,
  toSafeFileName,
  assertSafeName,
  sanitizeFieldName,
  toFieldIdentifier,
  RESERVED_WORDS,
} = require("../../lib/naming");

describe("naming", () => {
  describe("case converters", () => {
    test("toPascalCase", () => {
      expect(toPascalCase("hello world")).toBe("HelloWorld");
      expect(toPascalCase("user-profile")).toBe("UserProfile");
      expect(toPascalCase("user_profile")).toBe("UserProfile");
      expect(toPascalCase("")).toBe("");
      expect(toPascalCase(null)).toBe("");
      expect(toPascalCase(123)).toBe("");
    });

    test("toCamelCase", () => {
      expect(toCamelCase("hello world")).toBe("helloWorld");
      expect(toCamelCase("hello-world")).toBe("helloWorld");
      expect(toCamelCase("hello_world")).toBe("helloWorld");
      expect(toCamelCase("")).toBe("");
      expect(toCamelCase(undefined)).toBe("");
    });

    test("toKebabCase", () => {
      expect(toKebabCase("HelloWorld")).toBe("hello-world");
      expect(toKebabCase("hello world")).toBe("hello-world");
      expect(toKebabCase("")).toBe("");
      expect(toKebabCase(null)).toBe("");
    });

    test("toSnakeCase", () => {
      expect(toSnakeCase("HelloWorld")).toBe("hello_world");
      expect(toSnakeCase("hello-world")).toBe("hello_world");
      expect(toSnakeCase("")).toBe("");
    });

    test("toTitleCase", () => {
      expect(toTitleCase("hello world")).toBe("Hello World");
      expect(toTitleCase("user-profile")).toBe("User Profile");
    });

    test("toConstantCase", () => {
      expect(toConstantCase("hello world")).toBe("HELLO_WORLD");
      expect(toConstantCase("HelloWorld")).toBe("HELLO_WORLD");
    });
  });

  describe("normalizeModuleName", () => {
    test("normalizes casing variants to kebab-case", () => {
      expect(normalizeModuleName("UserProfile")).toBe("user-profile");
      expect(normalizeModuleName("user profile")).toBe("user-profile");
      expect(normalizeModuleName("user_profile")).toBe("user-profile");
      expect(normalizeModuleName("  user  ")).toBe("user");
    });

    test("throws on empty or non-string input", () => {
      expect(() => normalizeModuleName("")).toThrow();
      expect(() => normalizeModuleName("   ")).toThrow();
      expect(() => normalizeModuleName(null)).toThrow();
      expect(() => normalizeModuleName(undefined)).toThrow();
      expect(() => normalizeModuleName(42)).toThrow();
    });
  });

  describe("toIdentifier (safety-critical)", () => {
    test("converts hyphenated names to valid identifiers", () => {
      // B2 regression guard: raw "user-profile" produced invalid JS
      expect(toIdentifier("user-profile")).toBe("userProfile");
      expect(toIdentifier("user-profile", { casing: "pascal" })).toBe("UserProfile");
    });

    test("handles leading digits", () => {
      expect(toIdentifier("2fa-module")).toMatch(/^_/);
      expect(toIdentifier("2fa-module")).toBe("_2faModule");
    });

    test("avoids reserved words", () => {
      expect(toIdentifier("class")).toBe("class_");
      expect(toIdentifier("delete")).toBe("delete_");
    });

    test("strips illegal characters", () => {
      expect(toIdentifier("my var!@#")).toBe("myVar");
      expect(toIdentifier("***")).toBe("_");
      expect(toIdentifier("")).toBe("_");
    });
  });

  describe("getModuleVariants", () => {
    test("returns all naming variants consistently", () => {
      const v = getModuleVariants("user profile");
      expect(v).toEqual({
        raw: "user profile",
        kebab: "user-profile",
        pascal: "UserProfile",
        camel: "userProfile",
        snake: "user_profile",
        constant: "USER_PROFILE",
        identifier: "userProfile",
      });
    });

    test("identifier stays valid for digit-leading and reserved names", () => {
      expect(getModuleVariants("123abc").identifier).toBe("_123abc");
      expect(getModuleVariants("class").identifier).toBe("class_");
      expect(getModuleVariants("class").kebab).toBe("class");
      expect(getModuleVariants("order_item").kebab).toBe("order-item");
    });
  });

  describe("toSafeFileName", () => {
    test("produces safe file names", () => {
      expect(toSafeFileName("User Profile!")).toBe("user-profile");
      expect(toSafeFileName("../etc/passwd")).toBe("etc-passwd");
      expect(toSafeFileName("--weird--name--")).toBe("weird-name");
    });
  });

  describe("assertSafeName", () => {
    test.each([
      ["user-profile", "user-profile"],
      ["blog", "blog"],
      ["order_item", "order-item"],
      ["123abc", "123abc"],
      ["class", "class"],
      ["  blog  ", "blog"],
    ])("accepts %p and returns the kebab-case name", (raw, expected) => {
      expect(assertSafeName("module", raw)).toBe(expected);
    });

    test.each(["../evil", "..", ".hidden", "a/b", "a\\b", "a:b", "my name!", "üser"])(
      "rejects path-traversal / illegal name %p with the exact message",
      (raw) => {
        expect(() => assertSafeName("module", raw)).toThrow(
          `Nama module tidak valid: "${raw}". Gunakan huruf, angka, "-" atau "_" tanpa pemisah path.`
        );
      }
    );

    test.each(["", "   ", null, undefined, 42, {}])(
      "rejects empty/non-string input %p as an empty name",
      (raw) => {
        expect(() => assertSafeName("module", raw)).toThrow("Nama module tidak boleh kosong");
      }
    );

    test("uses the kind label in the message", () => {
      expect(() => assertSafeName("middleware", "")).toThrow("Nama middleware tidak boleh kosong");
      expect(() => assertSafeName("plugin", "a/b")).toThrow(
        'Nama plugin tidak valid: "a/b". Gunakan huruf, angka, "-" atau "_" tanpa pemisah path.'
      );
    });
  });

  describe("sanitizeFieldName", () => {
    test("produces a JS-safe camelCase identifier", () => {
      expect(sanitizeFieldName("user-name")).toBe("userName");
      expect(sanitizeFieldName(" first name ")).toBe("firstName");
    });

    test("handles digit-leading and reserved field names", () => {
      expect(sanitizeFieldName("2fa")).toBe("_2fa");
      expect(sanitizeFieldName("class")).toBe("class_");
    });

    test("throws for an empty/non-string field name", () => {
      expect(() => sanitizeFieldName("")).toThrow('Nama field tidak valid: ""');
      expect(() => sanitizeFieldName("   ")).toThrow(/Nama field tidak valid/);
      expect(() => sanitizeFieldName(null)).toThrow(/Nama field tidak valid/);
    });
  });

  describe("toFieldIdentifier", () => {
    test("strips every character outside [A-Za-z0-9_$]", () => {
      expect(toFieldIdentifier("user-name")).toBe("username");
      expect(toFieldIdentifier("a.b c")).toBe("abc");
      expect(toFieldIdentifier("$price")).toBe("$price");
    });

    test("throws when nothing survives", () => {
      expect(() => toFieldIdentifier("")).toThrow('Nama field tidak valid: ""');
      expect(() => toFieldIdentifier("---")).toThrow('Nama field tidak valid: "---"');
      expect(() => toFieldIdentifier(undefined)).toThrow('Nama field tidak valid: "undefined"');
    });
  });

  describe("RESERVED_WORDS", () => {
    test("covers the JS keywords that break generated identifiers", () => {
      for (const word of ["class", "delete", "await", "let", "static", "typeof"]) {
        expect(RESERVED_WORDS.has(word)).toBe(true);
      }
      expect(RESERVED_WORDS.has("user")).toBe(false);
    });
  });
});
