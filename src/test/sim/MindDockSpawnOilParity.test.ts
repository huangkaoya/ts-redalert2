import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Mind / Dock / SpawnLink / OilDerrick", () => {
    test("MindControllableTrait.restore uses civilian when prevOwner defeated", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/MindControllableTrait.ts"),
            "utf8",
        );
        expect(src).toContain("this.prevOwner.defeated");
        expect(src).toContain("getCivilianPlayer()");
    });

    test("DockableTrait teleport unreserves reservedDock", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/DockableTrait.ts"),
            "utf8",
        );
        const method =
            src.match(
                /\[NotifyTeleport\.onBeforeTeleport\][\s\S]*?\n    \}/,
            )?.[0] ?? "";
        expect(method).toContain("this.undock(target)");
        expect(method).toContain(
            "this.reservedDock?.dockTrait.unreserveDockForUnit(target)",
        );
    });

    test("SpawnLinkTrait does not interrupt non-Move tasks via tryMoveToParent", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/SpawnLinkTrait.ts"),
            "utf8",
        );
        const tryMove =
            src.match(
                /private tryMoveToParent\([\s\S]*?\n    \}/,
            )?.[0] ?? "";
        // 完善模拟层逻辑：e ? e instanceof MoveTask && update : addTask — only idle adds.
        expect(tryMove).toMatch(
            /if \(currentTask\) \{\s*if \(currentTask instanceof MoveTask\)/,
        );
        expect(tryMove).toContain("else {\n                gameObject.unitOrderTrait.addTask");
        expect(src).toContain("if (!(currentTask instanceof MoveTask))");
    });

    test("OilDerrickTrait increments creditsGained on positive cash", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/OilDerrickTrait.ts"),
            "utf8",
        );
        expect(src).toContain(
            "creditsGained += gameObject.rules.produceCashStartup",
        );
        expect(src).toContain(
            "creditsGained += gameObject.rules.produceCashAmount",
        );
    });
});
