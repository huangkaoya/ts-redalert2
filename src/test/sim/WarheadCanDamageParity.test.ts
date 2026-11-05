import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Warhead.canDamage", () => {
    test("psychicDamage gates on isUnit + immuneToPsionics, not infantry-only", () => {
        const src = readFileSync(join(ROOT, "src/game/Warhead.ts"), "utf8");
        expect(src).toContain("psychicDamage && (!obj.isUnit() || obj.rules.immuneToPsionics)");
        expect(src).not.toContain("psychicDamage && !obj.isInfantry()");
    });
});
