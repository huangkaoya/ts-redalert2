import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("EvacuateTransportTask", () => {
    test("180-degree offset uses baseDirection + angleOffset", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/task/EvacuateTransportTask.ts"), "utf8");
        expect(src).toContain("[baseDirection + angleOffset]");
        expect(src).not.toMatch(/angleOffset < 180\s*\?\s*\[[^\]]+\]\s*:\s*\[baseDirection\]/);
    });

    test("evacuateUnit queues WaitTicksTask after move/scatter", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/task/EvacuateTransportTask.ts"), "utf8");
        expect(src).toContain("WaitTicksTask(2 * GameSpeed.BASE_TICKS_PER_SECOND)");
        expect(src).toContain("new ScatterTask(this.game as any)");
    });
});
