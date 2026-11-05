import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("MoveTask / Target", () => {
    test("MoveTask no longer forces naval units onto ground layer under bridges", () => {
        const moveTask = readFileSync(join(ROOT, "src/game/gameobject/task/move/MoveTask.ts"), "utf8");
        expect(moveTask).not.toContain("usesGroundLayerUnderBridge");
        expect(moveTask).not.toContain("ensureGroundLayerUnderBridge");
        expect(moveTask).toContain("onlyIfPathExists");
        expect(moveTask).toMatch(/computePath\([^)]*onlyIfPathExists/);
        expect(moveTask).toMatch(/updateTarget\([^)]*onlyIfPathExists/);
    });

    test("MoveTrait handleTileChange matches 模拟层 (no naval ground-layer override)", () => {
        const moveTrait = readFileSync(join(ROOT, "src/game/gameobject/trait/MoveTrait.ts"), "utf8");
        expect(moveTrait).not.toContain("usesGroundLayerUnderBridge");
    });

    test("orders use getBridge, not per-unit getBridgeFor overrides", () => {
        for (const rel of [
            "src/game/order/MoveOrder.ts",
            "src/game/order/AttackMoveOrder.ts",
            "src/game/order/GuardAreaOrder.ts",
            "src/game/order/ScatterOrder.ts",
        ]) {
            const src = readFileSync(join(ROOT, rel), "utf8");
            expect(src).not.toContain("getBridgeFor");
            expect(src).toContain("getBridge()");
        }
    });

    test("OrderUnitsAction creates targets with bridge overlay", () => {
        const src = readFileSync(join(ROOT, "src/game/action/OrderUnitsAction.ts"), "utf8");
        expect(src).toContain("this.target.getBridge()");
        expect(src).toContain("createTarget(bridgeOnTile, position)");
        expect(src).toContain("createTarget(position.onBridge, position.tile)");
        expect(src).not.toContain("TargetBridgeMode");
        expect(src).not.toContain("getBridgeFor");
    });

    test("Target matches 模拟层 constructor (no TargetBridgeMode / no tile bridge inference)", () => {
        const target = readFileSync(join(ROOT, "src/game/Target.ts"), "utf8");
        expect(target).not.toContain("TargetBridgeMode");
        expect(target).not.toContain("onBridgeLandType");
        expect(target).not.toContain("getBridgeFor");
        // Terrain-only targets never auto-attach a bridge in the constructor (模拟层).
        expect(target).toMatch(
            /else \{\s*if \(tile\.landType === LandType\.Tiberium\) \{\s*this\.isOre = true;\s*\}\s*this\.tile = tile;\s*\}/,
        );
        expect(target).toContain("getBridge()");
        const game = readFileSync(join(ROOT, "src/game/Game.ts"), "utf8");
        expect(game).toMatch(/createTarget\(obj:\s*any,\s*tile:\s*any\)\s*\{/);
        expect(game).not.toContain("TargetBridgeMode");
    });
});
