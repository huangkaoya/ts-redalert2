import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("GatherOreTask", () => {
    test("near-scan ore sort uses tibTrait.rules.value then ore.value then matrix", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/harvester/GatherOreTask.ts"),
            "utf8",
        );
        const start = src.indexOf("private findClosestReachableOreSite");
        const end = src.indexOf("\n    private getRefineryOnTile", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("const tibTrait = ore.traits.get(TiberiumTrait)");
        expect(body).toContain("return { tile, ore, tibTrait }");
        expect(body).toContain("1e5 * (b.tibTrait.rules.value - a.tibTrait.rules.value)");
        expect(body).toContain("1e3 * (b.ore.value - a.ore.value)");
        expect(body).not.toMatch(/return 1000 \* valueDiff \+ \(priorityB - priorityA\)/);
    });

    test("empty-tile near scan centers on unit.tile (not lastOreSite fallback)", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/harvester/GatherOreTask.ts"),
            "utf8",
        );
        const start = src.indexOf("if (!tiberiumOverlay)");
        const end = src.indexOf("const tiberiumTrait = tiberiumOverlay.traits.get", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain(
            "this.findClosestReachableOreSite(unit, unit.tile, false)",
        );
        expect(body).not.toContain("lastOreSite ??");
    });

    test("MovingToOreSite rescans from lastOreSite/unit.tile per 模拟层 ||/?: precedence", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/harvester/GatherOreTask.ts"),
            "utf8",
        );
        const start = src.indexOf("if (harvester.status === HarvesterStatus.MovingToOreSite)");
        const end = src.indexOf("if (!this.target)", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain(
            "(this.target || this.initialTarget?.landType !== LandType.Tiberium)",
        );
        expect(body).toContain("harvester.lastOreSite ?? unit.tile");
        // Forbid the mistranslation that preferred this.target as scan center.
        expect(body).not.toMatch(
            /findClosestReachableOreSite\(\s*unit,\s*this\.target\s*\|\|/,
        );
    });
});
