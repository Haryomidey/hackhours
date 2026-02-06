import { describe, expect, it } from "vitest";
import { detectLanguage } from "../src/utils/language.js";

describe("detectLanguage", () => {
  it("maps file extensions", () => {
    expect(detectLanguage("foo.ts")).toBe("TypeScript");
    expect(detectLanguage("bar.py")).toBe("Python");
    expect(detectLanguage("baz.unknown")).toBe("Other");
  });
});
