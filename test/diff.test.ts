import { describe, it, expect } from "vitest";
import { parsePrDiff, isReviewable } from "../src/reviewer/diff.js";

const SIMPLE_DIFF = `diff --git a/foo.ts b/foo.ts
index 1234567..abcdefg 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
 function hello() {
-  return "world";
+  return "claude";
+  // added comment
 }
`;

const NEW_FILE_DIFF = `diff --git a/new.ts b/new.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,2 @@
+export function f() {}
+
`;

const DELETED_FILE_DIFF = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index 1234567..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export function f() {}
-
`;

describe("parsePrDiff", () => {
  it("parses a simple modification", () => {
    const chunks = parsePrDiff(SIMPLE_DIFF);
    expect(chunks).toHaveLength(1);
    const chunk = chunks[0]!;
    expect(chunk.path).toBe("foo.ts");
    expect(chunk.status).toBe("modified");
    expect(isReviewable(chunk)).toBe(true);
    expect(chunk.addedLines.size).toBe(2);
    const added = [...chunk.addedLines.values()].join("\n");
    expect(added).toContain('"claude"');
    expect(added).toContain("added comment");
  });

  it("classifies a new file", () => {
    const chunks = parsePrDiff(NEW_FILE_DIFF);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.status).toBe("added");
    expect(isReviewable(chunks[0]!)).toBe(true);
  });

  it("treats a deleted file as not reviewable", () => {
    const chunks = parsePrDiff(DELETED_FILE_DIFF);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.status).toBe("removed");
    expect(isReviewable(chunks[0]!)).toBe(false);
  });
});
