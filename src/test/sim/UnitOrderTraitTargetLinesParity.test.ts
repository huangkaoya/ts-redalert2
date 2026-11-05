import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("UnitOrderTrait target lines", () => {
    test("getTargetLinesConfig uses object soft only (no invented method ?. )", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/UnitOrderTrait.ts"),
            "utf8",
        );
        expect(src).toContain(
            "this.targetLinesConfig = targetTask?.getTargetLinesConfig(this.gameObject);",
        );
        expect(src).not.toContain("getTargetLinesConfig?.(");
    });

    test("cleanupWaypointPath splices indexOf result with no -1 guard", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/UnitOrderTrait.ts"),
            "utf8",
        );
        const method =
            src.match(
                /cleanupWaypointPath\(\): void \{[\s\S]*?\n    \}/,
            )?.[0] ?? "";
        expect(method).toContain(
            "this.waypointPath.units.indexOf(this.gameObject)",
        );
        expect(method).toContain("this.waypointPath.units.splice(");
        expect(method).not.toContain("unitIndex !== -1");
        expect(method).not.toMatch(/if\s*\(\s*unitIndex/);
    });
});
