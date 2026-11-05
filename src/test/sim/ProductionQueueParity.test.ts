import { describe, expect, test } from "bun:test";
import { ProductionQueue, QueueStatus, QueueType } from "@/game/player/production/ProductionQueue";

describe("ProductionQueue.push", () => {
    test("zero quantity after clamps does not create empty queue items", () => {
        const queue = new ProductionQueue(QueueType.Vehicles, 1, 1);
        const rules = { name: "MTNK" };
        queue.push(rules, 1, 100);
        expect(queue.currentSize).toBe(1);
        expect(queue.getAll()).toHaveLength(1);

        queue.push(rules, 5, 100);
        expect(queue.currentSize).toBe(1);
        expect(queue.getAll()).toHaveLength(1);
        expect(queue.getAll()[0].quantity).toBe(1);
        expect(queue.status).toBe(QueueStatus.Active);
    });
});
