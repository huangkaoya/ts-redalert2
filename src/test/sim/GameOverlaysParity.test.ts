import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(join(ROOT, "src/game/Game.ts"), "utf8");

describe("Game.createInitialMapOverlays", () => {
    test("precomputes high bridge specs and corrects isXBridge overlay id", () => {
        expect(src).toContain("findMapHighBridgeHeadTiles()");
        expect(src).toContain("rectContainsPoint");
        expect(src).toContain("calculateHighBridgeOverlayId");
        expect(src).toContain("Expected high bridge but found low bridge overlay");
    });

    test("does not invent unsupported-tiberium filter absent from 模拟层", () => {
        expect(src).not.toContain("Found unsupported TS tiberium overlay");
        expect(src).not.toContain("OverlayTibType.Ore");
    });

    test("merges low-bridge specs with precomputed highBridgeSpecs", () => {
        expect(src).toContain("...highBridgeSpecs");
    });
});
