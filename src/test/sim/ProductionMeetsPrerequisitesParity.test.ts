import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Production.meetsPrerequisites", () => {
    test("iterates prerequisiteOverride directly without ?? [] fallback", () => {
        const src = readFileSync(join(ROOT, "src/game/player/production/Production.ts"), "utf8");
        const start = src.indexOf("meetsPrerequisites(object: any)");
        const body = src.slice(start, start + 1200);
        expect(body).toContain("for (const override of object.prerequisiteOverride)");
        expect(body).not.toContain("prerequisiteOverride ?? []");
    });
});
