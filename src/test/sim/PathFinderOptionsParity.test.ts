import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("PathFinder options", () => {
    test("bestEffort has no ?? false default; maxExpandedNodes uses ||", () => {
        const src = readFileSync(
            join(ROOT, "src/game/map/pathFinder/PathFinder.ts"),
            "utf8",
        );
        const start = src.indexOf("constructor(graph:");
        const body = src.slice(start, src.indexOf("private reconstructPath"));
        expect(body).toContain("this.bestEffort = options.bestEffort;");
        expect(body).toContain(
            "this.maxExpandedNodes = options.maxExpandedNodes || Number.POSITIVE_INFINITY;",
        );
        expect(body).not.toContain("bestEffort ?? false");
        expect(body).not.toContain("maxExpandedNodes ??");
    });
});
