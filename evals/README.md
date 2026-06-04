# Eval Harness

Measures how well the reviewer performs across changes to prompts, models, and
rules. This is the differentiator from "I built an AI code reviewer" projects.

## Day 5 plan

Each fixture is a directory:

```
fixtures/
  001-off-by-one/
    diff.patch        # the diff under review
    expected.json     # expected findings (with tolerances)
    config.yml        # optional per-fixture .aireview.yml override
    notes.md          # what this fixture tests
```

`expected.json`:
```json
{
  "expectedFindings": [
    {
      "file": "src/foo.ts",
      "lineRange": [10, 12],
      "category": "bug",
      "minSeverity": "high",
      "mustMention": ["off-by-one", "index"]
    }
  ],
  "falsePositiveTraps": [
    { "file": "test/foo.test.ts", "line": 5, "reason": "eval in a test is fine" }
  ]
}
```

## Target fixtures (15)

Real bugs (5): off-by-one, unawaited promise, mutable default/shared state,
race condition, resource leak (unclosed handle/stream).

Security (3): SQL injection via template string, `child_process` with
unsanitized input, hardcoded secret.

Style/maintainability (3): leftover `console.log`, untracked TODO, deep nesting.

False-positive traps (4): `eval` in a test, dummy password in a fixture,
`console.log` in a CLI's main path, intentional `// eslint-disable` with reason.

## Metrics

Per run: precision (correct / total posted), recall (caught / total expected),
false-positive rate (traps wrongly flagged). Output as a markdown table,
re-runnable as `npm run eval`, checked into `evals/results/`.
