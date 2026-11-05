import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("UnitRepairTrait", () => {
    test("UnitRepairStartEvent uses 模拟层 OR-chain polarity, not AND of both gates", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/UnitRepairTrait.ts"),
            "utf8",
        );
        const method =
            src.match(/\[NotifyTick\.onTick\][\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain(
            "this.status === RepairStatus.Idle ||",
        );
        expect(method).toContain("!this.lastRepairTickSuccessful");
        expect(method).not.toContain(
            "this.status === RepairStatus.Idle &&\n                        !this.lastRepairTickSuccessful",
        );
    });
});
