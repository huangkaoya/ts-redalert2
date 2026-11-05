import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(
    join(ROOT, "src/game/gameobject/trait/PsychicDetectorTrait.ts"),
    "utf8",
);

describe("PsychicDetectorTrait.scan", () => {
    test("range-checks attack/command/path targets, not the unit itself", () => {
        const start = src.indexOf("private scan(");
        const body = src.slice(start);
        expect(body).toContain("isInRange(target.obj ?? target.tile)");
        expect(body).toContain("isInRange(config.target)");
        expect(body).toContain("isInRange(node.tile)");
        // Forbid the mistranslation that skipped units outside the detector radius.
        expect(body).not.toMatch(/if\s*\(\s*!isInRange\(obj\)\s*\)\s*\{\s*continue;/);
        expect(body).not.toContain("distance2(unit, gameObject)");
    });
});
