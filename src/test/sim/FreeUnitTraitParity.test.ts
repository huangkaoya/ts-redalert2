import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("FreeUnitTrait", () => {
    test("refund uses soylent || purchaseValue and does not invent spawn diagnostics", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/trait/FreeUnitTrait.ts"), "utf8");
        expect(src).toContain("unit.rules.soylent || unit.purchaseValue");
        expect(src).not.toContain("[FreeUnitTrait]");
    });
});
