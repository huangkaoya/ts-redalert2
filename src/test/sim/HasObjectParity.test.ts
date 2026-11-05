import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Art/Rules.hasObject", () => {
    test("hasObject returns Map?.has without ?? false", () => {
        const art = readFileSync(join(ROOT, "src/game/art/Art.ts"), "utf8");
        const rules = readFileSync(join(ROOT, "src/game/rules/Rules.ts"), "utf8");
        expect(art).toContain("return this.objectArt.get(type)?.has(name);");
        expect(rules).toContain("return this.allObjectRules.get(type)?.has(name);");
        expect(art).not.toContain("?.has(name) ?? false");
        expect(rules).not.toContain("?.has(name) ?? false");
    });
});
