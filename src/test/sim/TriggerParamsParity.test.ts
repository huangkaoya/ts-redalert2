import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const COND_DIR = join(ROOT, "src/game/trigger/condition");
const EXEC_DIR = join(ROOT, "src/game/trigger/executor");

describe("Trigger event/action.params", () => {
    test("condition constructors that take the trigger event read event.params, not event[n]", () => {
        const offenders: string[] = [];
        for (const file of readdirSync(COND_DIR).filter((f) => f.endsWith(".ts"))) {
            const src = readFileSync(join(COND_DIR, file), "utf8");
            const ctor =
                src.match(/constructor\([^)]*\)\s*\{[\s\S]*?\n    \}/)?.[0] ?? "";
            if (!ctor) continue;
            // First arg is the map trigger-event object (has .params), matching 模拟层 e.params[N].
            if (/Number\(\s*params\s*\[/.test(ctor)) {
                offenders.push(`${file}: Number(params[)`);
            }
            if (/\bparams\s*\[\s*\d+\s*\]/.test(ctor) && !/\bparams\.params\b/.test(ctor)) {
                // named first arg params but indexing as array
                const first = ctor.match(/constructor\(\s*(\w+)/)?.[1];
                if (first === "params" && /Number\(\s*params\s*\[/.test(ctor)) {
                    offenders.push(`${file}: first-arg array index`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    test("DestroyedAll* and similar conditions use event.params[1]", () => {
        const files = [
            "DestroyedAllCondition.ts",
            "DestroyedAllBuildingsCondition.ts",
            "DestroyedAllUnitsCondition.ts",
            "DestroyedAllUnitsLandCondition.ts",
            "DestroyedAllUnitsNavalCondition.ts",
            "CreditsExceedCondition.ts",
            "CreditsBelowCondition.ts",
            "BuildObjectTypeCondition.ts",
            "DestroyedBuildingsCondition.ts",
            "DestroyedUnitsCondition.ts",
            "SpyEnteringAsHouseCondition.ts",
            "SpyEnteringAsInfantryCondition.ts",
        ];
        for (const file of files) {
            const src = readFileSync(join(COND_DIR, file), "utf8");
            expect(src).toContain("Number(event.params[1])");
            expect(src).not.toMatch(/Number\(\s*params\s*\[/);
        }
    });

    test("FireSale/ChangeHouse/GlobalVariable executors use action.params[1]", () => {
        for (const file of [
            "FireSaleExecutor.ts",
            "ChangeHouseExecutor.ts",
            "GlobalVariableExecutor.ts",
        ]) {
            const src = readFileSync(join(EXEC_DIR, file), "utf8");
            expect(src).toContain("Number(action.params[1])");
            expect(src).not.toMatch(/Number\(\s*params\s*\[/);
        }
    });

    test("event-filter conditions check(context, events) and filter/some the 2nd arg", () => {
        // TriggerManager calls condition.check(context, events).
        for (const file of [
            "HealthBelowAnyCondition.ts",
            "SpyEnteringAsHouseCondition.ts",
            "SpyEnteringAsInfantryCondition.ts",
            "DestroyedAllUnitsCondition.ts",
            "HealthBelowCombatCondition.ts",
            "DestroyedOrCapturedCondition.ts",
        ]) {
            const src = readFileSync(join(COND_DIR, file), "utf8");
            const method =
                src.match(/check\([\s\S]*?\n    \}/)?.[0] ?? "";
            // Must operate on the second parameter (events), not the first (context).
            expect(method).toMatch(
                /check\(\s*\w+\s*:\s*any(?:\[\])?\s*,\s*(\w+)/,
            );
            const second =
                method.match(
                    /check\(\s*\w+\s*:\s*any(?:\[\])?\s*,\s*(\w+)/,
                )?.[1] ?? "";
            expect(second.length).toBeGreaterThan(0);
            // Allow `events\n  .filter` formatting.
            expect(method).toMatch(
                new RegExp(`\\b${second}\\s*\\.(filter|some)\\b`),
            );
        }
    });
});
