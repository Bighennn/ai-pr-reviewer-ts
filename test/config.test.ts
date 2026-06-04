import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  parseConfig,
  shouldReviewPath,
  matchesGlob,
} from "../src/config/config.js";

describe("parseConfig", () => {
  it("uses defaults for empty config", () => {
    const cfg = parseConfig("");
    expect(cfg.severityThreshold).toBe(DEFAULT_CONFIG.severityThreshold);
    expect(cfg.blockOn).toBe("critical");
    expect(cfg.rules).toEqual([]);
  });

  it("parses custom rules", () => {
    const cfg = parseConfig(`
rules:
  - name: no-console
    prompt: Flag console.log in production code.
    severity: medium
`);
    expect(cfg.rules).toHaveLength(1);
    expect(cfg.rules[0]!.name).toBe("no-console");
    expect(cfg.rules[0]!.severity).toBe("medium");
  });

  it("rejects invalid severity", () => {
    expect(() => parseConfig("severityThreshold: not-a-severity")).toThrow();
  });

  it("rejects unknown fields (typo protection)", () => {
    expect(() => parseConfig("severityTreshold: high")).toThrow();
  });
});

describe("glob matching", () => {
  it("matches ** across path segments", () => {
    expect(matchesGlob("src/node_modules/x/y.js", "**/node_modules/**")).toBe(
      true,
    );
  });

  it("respects ignore paths", () => {
    const cfg = parseConfig(`
ignorePaths:
  - "**/*.test.ts"
  - "docs/**"
`);
    expect(shouldReviewPath("src/main.ts", cfg)).toBe(true);
    expect(shouldReviewPath("src/main.test.ts", cfg)).toBe(false);
    expect(shouldReviewPath("docs/intro.md", cfg)).toBe(false);
  });
});
