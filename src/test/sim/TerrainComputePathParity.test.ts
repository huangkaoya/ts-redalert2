import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Terrain.computePath", () => {
    test("missing start node uses forceLandSpeed updatePassability without pre-addNode", () => {
        const src = readFileSync(join(ROOT, "src/game/map/Terrain.ts"), "utf8");
        const method = src.match(/computePath\([\s\S]*?\n    computeAllPassabilityGraphs/)?.[0] ?? "";
        expect(method).toContain("updatePassability([startTile], speedType, isInfantry, graph, ignoredBlockers, 1)");
        expect(method).not.toMatch(/if \(!hasStartNode\) \{[\s\S]*?graph\.addNode\(startNodeId/);
    });

    test("unreachable non-island end clamps maxExpandedNodes to 500", () => {
        const src = readFileSync(join(ROOT, "src/game/map/Terrain.ts"), "utf8");
        expect(src).toContain("maxExpandedNodes = Math.min(maxExpandedNodes, 500)");
    });
});
