import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Game.createPlayerInitialUnits", () => {
    test("throws on invalid starting map coordinates", () => {
        const src = readFileSync(join(ROOT, "src/game/Game.ts"), "utf8");
        expect(src).toContain("Invalid player starting position (${startLoc.x},${startLoc.y})");
        expect(src).toContain("Should not reach this line");
    });
});
