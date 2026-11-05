import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("GameApi.generateRandomInt", () => {
    test("non-game path uses floor(r*(max-min+1))+min inclusive formula", () => {
        const src = readFileSync(join(ROOT, "src/game/api/GameApi.ts"), "utf8");
        const start = src.indexOf("generateRandomInt(min: number, max: number)");
        const end = src.indexOf("\n    generateRandom(", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("Math.floor(random * (max - min + 1)) + min");
        expect(body).not.toContain("Math.round");
        expect(body).not.toContain("random * (max - min)) + min");
    });
});
