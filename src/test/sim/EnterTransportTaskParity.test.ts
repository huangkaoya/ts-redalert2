import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("EnterTransportTask", () => {
    test("MoveToTransport boards via isTileOccupiedBy only (no onBridge layer gate)", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/EnterTransportTask.ts"),
            "utf8",
        );
        const start = src.indexOf("if (this.state === EnterTransportState.MoveToTransport)");
        const end = src.indexOf("if (this.state === EnterTransportState.EnterTransport)", start);
        const body = src.slice(start, end);
        expect(body).toContain(
            "!this.game.map.tileOccupation.isTileOccupiedBy(unit.tile, this.target)",
        );
        expect(body).not.toContain("!!unit.onBridge === !!this.target.onBridge");
        expect(body).not.toContain("coLocated");
        expect(body).toContain("new MoveInsideTask(this.game, this.target)");
        expect(body).toContain("this.movePerformed = true");
    });

    test("EnterTransportOrder.isAllowed has no invented onBridge layer gate", () => {
        const src = readFileSync(
            join(ROOT, "src/game/order/EnterTransportOrder.ts"),
            "utf8",
        );
        const start = src.indexOf("isAllowed()");
        const end = src.indexOf("\n    process(", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).not.toContain("onBridge");
        expect(body).toContain("source.zone !== ZoneType.Air");
        expect(body).toContain("target.zone !== ZoneType.Air");
        expect(body).toContain("target.transportTrait.unitFitsInside(source)");
        expect(body).toContain("target.moveTrait.moveState === MoveState.Idle");
    });
});
