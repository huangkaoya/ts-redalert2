import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ActionsApi / Rules", () => {
    test("queueForProduction uses 模拟层 (name, type) order without swallow fallbacks", () => {
        const src = readFileSync(join(ROOT, "src/game/api/ActionsApi.ts"), "utf8");
        expect(src).not.toContain("normalizeObjectArgs");
        expect(src).toMatch(/queueForProduction\([^)]*name[^)]*type[^)]*quantity/);
        expect(src).toContain("this.game.rules.getObject(name, type)");
        expect(src).not.toMatch(/queueForProduction[\s\S]*?catch\s*\(/);
        expect(src).not.toMatch(/unqueueFromProduction[\s\S]*?catch\s*\(/);
    });

    test("Rules.getWarhead matches 模拟层 case-insensitive section lookup", () => {
        const src = readFileSync(join(ROOT, "src/game/rules/Rules.ts"), "utf8");
        expect(src).toContain("getOrderedSections()");
        expect(src).toContain('throw new Error("Unknown warhead " + name)');
        expect(src).not.toContain("[Diag] Unknown warhead");
    });
});
