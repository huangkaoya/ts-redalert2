import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("FootLocomotor", () => {
    test("tick pause uses post-decrement form matching 模拟层 endPauseFrames--", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/locomotor/FootLocomotor.ts"),
            "utf8",
        );
        const start = src.indexOf("tick(");
        const body = src.slice(start);
        expect(body).toContain("!distance && 0 < this.endPauseFrames--");
        expect(body).not.toContain("if (isPaused) {\n            this.endPauseFrames--");
    });
});
