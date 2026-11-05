import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("GuardAreaOrder harvester", () => {
    test("full harvester gets ReturnOreTask; otherwise GatherOreTask", () => {
        const src = readFileSync(
            join(ROOT, "src/game/order/GuardAreaOrder.ts"),
            "utf8",
        );
        expect(src).toContain("import { ReturnOreTask }");
        expect(src).toContain("harvesterTrait.isFull()");
        expect(src).toContain("new ReturnOreTask(this.game, undefined, false, true)");
        expect(src).toContain("new GatherOreTask(this.game, undefined, true)");
    });
});
