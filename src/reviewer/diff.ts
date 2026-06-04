import parseDiff from "parse-diff";

/**
 * Diff parsing and chunking.
 *
 * The LLM gets one chunk per file (not the whole PR at once). Per-file
 * chunking keeps each prompt small and precise, parallelizes cleanly, and
 * gives a clean retry boundary.
 */

export interface FileChunk {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  diffText: string;
  /** new-file line number -> content, for added lines only */
  addedLines: Map<number, string>;
}

export function isReviewable(chunk: FileChunk): boolean {
  return chunk.status !== "removed" && chunk.addedLines.size > 0;
}

export function parsePrDiff(diffText: string): FileChunk[] {
  const files = parseDiff(diffText);
  const chunks: FileChunk[] = [];

  for (const file of files) {
    const path =
      file.to && file.to !== "/dev/null" ? file.to : (file.from ?? "");
    const status = classifyStatus(file);

    const addedLines = new Map<number, string>();
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.type === "add" && "ln" in change) {
          addedLines.set(change.ln, change.content.replace(/^\+/, ""));
        }
      }
    }

    chunks.push({
      path,
      status,
      diffText: reconstructFileDiff(file),
      addedLines,
    });
  }

  return chunks;
}

function classifyStatus(file: parseDiff.File): FileChunk["status"] {
  if (file.new) return "added";
  if (file.deleted) return "removed";
  if (file.from && file.to && file.from !== file.to) return "renamed";
  return "modified";
}

/** Rebuild a unified-diff string for a single file to send to the model. */
function reconstructFileDiff(file: parseDiff.File): string {
  const header = `--- ${file.from ?? "/dev/null"}\n+++ ${file.to ?? "/dev/null"}`;
  const body = file.chunks
    .map((chunk) => {
      const changes = chunk.changes.map((c) => c.content).join("\n");
      return `${chunk.content}\n${changes}`;
    })
    .join("\n");
  return `${header}\n${body}`;
}
