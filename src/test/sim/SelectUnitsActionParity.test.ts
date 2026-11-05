import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("SelectUnitsAction", () => {
    test("process falls back to world techno when not owned", () => {
        const src = readFileSync(
            join(ROOT, "src/game/action/SelectUnitsAction.ts"),
            "utf8",
        );
        const start = src.indexOf("process()");
        const end = src.lastIndexOf("}");
        const body = src.slice(start, end);
        expect(body).toContain("player.getOwnedObjectById(id)");
        expect(body).toContain("this.game.getWorld().hasObjectId(id)");
        expect(body).toContain("this.game.getWorld().getObjectById(id)");
        expect(body).toContain("worldObj.isTechno()");
        expect(body).toContain("getOrCreateSelection(player).update(units)");
        expect(src).toContain("this.game = game;");
    });
});
