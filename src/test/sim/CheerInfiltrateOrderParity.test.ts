import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Cheer / Infiltrate / order-queue splice", () => {
    test("CheerTask finishes when unit cannot cheer", () => {
        const local = readFileSync(join(ROOT, "src/game/gameobject/task/CheerTask.ts"), "utf8");
        const method = local.match(/onTick\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("return true");
        // The early cannot-cheer branch must not return false (would block forever).
        expect(method).toMatch(
            /sequences\.has\(SequenceType\.Cheer\)[\s\S]*?return true;/,
        );
        expect(method).not.toMatch(
            /sequences\.has\(SequenceType\.Cheer\)[\s\S]*?return false;[\s\S]*?stance = StanceType\.Cheer/,
        );
    });

    test("InfiltrateBuildingTask has no BuildDown gate", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/task/InfiltrateBuildingTask.ts"),
            "utf8",
        );
        expect(local).toContain("this.target.rules.spyable");
        expect(local).not.toContain("BuildStatus.BuildDown");
        expect(local).not.toContain("buildStatus");
    });

    test("PackBuildingTask sets BuildDown for walls then finishes without wait", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/task/morph/PackBuildingTask.ts"),
            "utf8",
        );
        const method = local.match(/onTick\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("unit.setBuildStatus(BuildStatus.BuildDown, this.game)");
        expect(method).toContain("if (!unit.rules.wall)");
        // Must not gate setBuildStatus behind !wall.
        expect(method).not.toMatch(
            /buildStatus !== BuildStatus\.BuildDown && !unit\.rules\.wall/,
        );
    });

    test("FactoryTrait barracks internal rally uses 模拟层 !(small)||gdi polarity", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/trait/FactoryTrait.ts"),
            "utf8",
        );
        expect(local).toContain(
            "!(foundation.width <= 2 || foundation.height <= 2) || building.rules.gdiBarracks",
        );
        expect(local).not.toMatch(
            /if \(foundation\.width <= 2 \|\| foundation\.height <= 2 \|\| building\.rules\.gdiBarracks\)/,
        );
    });

    test("VeteranTrait grants XP for temporal/parasite kills", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/trait/VeteranTrait.ts"),
            "utf8",
        );
        const method =
            local.match(
                /\[NotifyTargetDestroy\.onDestroy\]\([\s\S]*?\n    \}/,
            )?.[0] ?? "";
        expect(method).toContain(
            "isTemporalOrParasiteKill || !gameManager.areFriendly(source, target)",
        );
        expect(method).not.toContain(
            "!isTemporalOrParasiteKill && !gameManager.areFriendly",
        );
    });

    test("TeleportMoveToRefineryTask finishes after move even if teleport retry fails", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/task/harvester/TeleportMoveToRefineryTask.ts"),
            "utf8",
        );
        const method = local.match(/onTick\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("super.onTick(unit) === true");
        expect(method).toContain("void (this.isCancelling()");
        expect(method).toContain("return true;");
        // Must not gate task completion on the retry teleport succeeding.
        expect(method).not.toMatch(
            /super\.onTick\(unit\) === true && \(this\.isCancelling\(\)/,
        );
    });

    test("MoveOrder.getPointerType recomputes passability only when allowed", () => {
        const local = readFileSync(join(ROOT, "src/game/order/MoveOrder.ts"), "utf8");
        const method = local.match(/getPointerType\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("canMove &&");
        expect(method).toContain("!this.forceMove");
        expect(method).toContain("!this.sourceObject.isBuilding()");
        expect(method).toContain("!isShrouded");
        expect(method).not.toMatch(
            /if\s*\(\s*!canMove\s*\|\|\s*this\.forceMove/,
        );
    });

    test("fly cancel paths use splice(index) without deleteCount 1", () => {
        const move = readFileSync(join(ROOT, "src/game/order/MoveOrder.ts"), "utf8");
        const attack = readFileSync(join(ROOT, "src/game/order/AttackOrder.ts"), "utf8");
        const attackMove = readFileSync(join(ROOT, "src/game/order/AttackMoveOrder.ts"), "utf8");

        expect(move).toContain("tasks.splice(tasks.indexOf(attackTask));");
        expect(move).not.toContain("tasks.splice(tasks.indexOf(attackTask), 1)");

        expect(attack).toContain("tasks.splice(tasks.indexOf(taskToCancel));");
        expect(attack).not.toContain("tasks.splice(tasks.indexOf(taskToCancel), 1)");

        expect(attackMove).toContain("taskList.splice(taskList.indexOf(existingTask));");
        expect(attackMove).not.toMatch(
            /forceCancel\(unit\)\) \{\s*taskList\.splice\(taskList\.indexOf\(existingTask\), 1\)/,
        );
    });
});
