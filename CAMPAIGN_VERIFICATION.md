# Campaign Stability Verification

- Result: **failure**
- Verified commit: `de7db9698c99df945b3768fbbebdc0d81339aac1`
- Checks: syntax, 8-zone/80-floor final boss simulation, exact mid-floor save/load, offline single settlement, required-boss retry safety.

## Test output

```text
node:assert:150
  throw new AssertionError(obj);
  ^

AssertionError [ERR_ASSERTION]: campaign simulation timed out at floor 6, zone 0
+ actual - expected

+ true
- undefined

    at campaignCompletesAllEightZones (/home/runner/work/idle_game_changye/idle_game_changye/tests/campaign-e2e.test.js:145:10)
    at Object.<anonymous> (/home/runner/work/idle_game_changye/idle_game_changye/tests/campaign-e2e.test.js:152:3)
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
    at Module.load (node:internal/modules/cjs/loader:1505:32)
    at Function._load (node:internal/modules/cjs/loader:1309:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:254:19)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:171:5)
    at node:internal/main/run_main_module:36:49 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: true,
  expected: undefined,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.23.2

```
