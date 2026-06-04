import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { Severity } from "../reviewer/schema.js";

/**
 * Schema + loader for repository-level `.aireview.yml`.
 * Every field has a default so the bot works on repos with no config.
 */

export const CustomRule = z.object({
  name: z.string(),
  prompt: z
    .string()
    .describe("Natural-language description of what to look for"),
  severity: Severity.default("medium"),
});
export type CustomRule = z.infer<typeof CustomRule>;

export const ReviewConfig = z
  .object({
    model: z
      .string()
      .optional()
      .describe("Override the default model for this repo"),
    severityThreshold: Severity.default("low").describe(
      "Drop findings below this severity before posting",
    ),
    blockOn: Severity.default("critical").describe(
      "Set a failing commit status at or above this severity",
    ),
    ignorePaths: z
      .array(z.string())
      .default([
        "**/node_modules/**",
        "**/vendor/**",
        "**/*.lock",
        "**/dist/**",
      ]),
    rules: z.array(CustomRule).default([]),
    maxFilesPerReview: z.number().int().min(1).max(200).default(30),
  })
  .strict();
export type ReviewConfig = z.infer<typeof ReviewConfig>;

export const DEFAULT_CONFIG: ReviewConfig = ReviewConfig.parse({});

/** Parse YAML text into a validated ReviewConfig. Throws ZodError on bad input. */
export function parseConfig(raw: string): ReviewConfig {
  const data = parseYaml(raw) ?? {};
  return ReviewConfig.parse(data);
}

/**
 * Minimal glob matcher for ignore paths. Supports ** (any path segments),
 * * (any chars except /), and literal text. Good enough for path filtering;
 * we intentionally avoid pulling in a glob dependency for this.
 */
export function matchesGlob(path: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${regex}$`).test(path);
}

export function shouldReviewPath(path: string, config: ReviewConfig): boolean {
  return !config.ignorePaths.some((p) => matchesGlob(path, p));
}
