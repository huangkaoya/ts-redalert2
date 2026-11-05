import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Warhead trigger executors detonate arity", () => {
    test("ApplyDamageExecutor omits SpecialWarheadType (uses detonate default)", () => {
        const src = readFileSync(
            join(ROOT, "src/game/trigger/executor/ApplyDamageExecutor.ts"),
            "utf8",
        );
        expect(src).toContain("warhead.detonate(");
        expect(src).not.toContain("SpecialWarheadType");
        expect(src).toMatch(
            /detonate\([\s\S]*createTarget\(bridge, tile\),\s*undefined\);/,
        );
    });

    test("DetonateWarheadExecutor omits SpecialWarheadType (uses detonate default)", () => {
        const src = readFileSync(
            join(ROOT, "src/game/trigger/executor/DetonateWarheadExecutor.ts"),
            "utf8",
        );
        expect(src).toContain("warhead.detonate(");
        expect(src).not.toContain("SpecialWarheadType");
        expect(src).toMatch(
            /detonate\([\s\S]*createTarget\(bridge, tile\),\s*undefined\);/,
        );
    });
});
