import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ChangeHouseExecutor", () => {
    test("defeated target redistributes via getAllies(target), not source", () => {
        const single = readFileSync(
            join(ROOT, "src/game/trigger/executor/ChangeHouseExecutor.ts"),
            "utf8",
        );
        const all = readFileSync(
            join(ROOT, "src/game/trigger/executor/ChangeHouseAllExecutor.ts"),
            "utf8",
        );
        expect(single).toContain("targetPlayer?.defeated");
        expect(single).toContain("isAssetRedistributionEnabled()");
        expect(single).toContain("getAllies(targetPlayer)");
        expect(single).not.toContain("getAllies(sourcePlayer)");
        // All-variant correctly uses source; keep that distinct.
        expect(all).toContain("getAllies(sourcePlayer)");
    });
});
