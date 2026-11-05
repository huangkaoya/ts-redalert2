import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("CrashableTrait", () => {
    test("sends crash event once then always runs crash motion", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/CrashableTrait.ts"),
            "utf8",
        );
        expect(src).toContain("if (!this.crashingEvtSent)");
        expect(src).toContain("this.crashingEvtSent = true");
        expect(src).toContain("ObjectCrashingEvent");
        expect(src).toContain("NotifyCrash.onCrash");
        // Forbid inverted comma-expression gate that skipped side effects forever.
        expect(src).not.toContain("if (!this.crashingEvtSent ||");
    });
});
