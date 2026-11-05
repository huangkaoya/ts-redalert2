import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ObjectRules constructor", () => {
    test("assigns generalRules directly without || {} fallback", () => {
        const src = readFileSync(join(ROOT, "src/game/rules/ObjectRules.ts"), "utf8");
        const start = src.indexOf("constructor(");
        const end = src.indexOf("\n    protected parse(", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("this.generalRules = generalRules;");
        expect(body).not.toContain("generalRules || {}");
    });
});
