import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedBuildingsCondition extends TriggerCondition {
    private count: number;
    private threshold: number;
    private houseId: number;
    constructor(event: any, trigger: any) {
        super(event, trigger);
        this.count = 0;
        this.threshold = Number(event.params[1]);
    }
    check(context: any, events: any[]): boolean {
        if (!this.player) {
            return false;
        }
        if (this.count >= this.threshold) {
            return true;
        }
        for (const event of events) {
            if (event.type === EventType.ObjectDestroy) {
                const target = event.target;
                if (target.isBuilding() && target.owner.country?.id === this.houseId) {
                    this.count++;
                }
            }
        }
        return this.count >= this.threshold;
    }
}
