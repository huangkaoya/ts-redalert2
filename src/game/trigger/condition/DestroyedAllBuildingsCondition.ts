import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedAllBuildingsCondition extends TriggerCondition {
    private allDestroyed: boolean = false;
    private houseId: number;
    constructor(event: any, trigger: any) {
        super(event, trigger);
        this.houseId = Number(event.params[1]);
    }
    check(event: any, events: any[]): boolean {
        if (this.allDestroyed) {
            return true;
        }
        const hasDestroyedAll = events.some((event) => {
            if (event.type !== EventType.ObjectDestroy) {
                return false;
            }
            const target = event.target;
            const isTargetBuilding = target.isBuilding();
            const isTargetOwner = target.owner.country?.id === this.houseId;
            const hasNoBuildings = !target.owner.buildings.size;
            return isTargetBuilding && isTargetOwner && hasNoBuildings;
        });
        if (hasDestroyedAll) {
            this.allDestroyed = true;
        }
        return hasDestroyedAll;
    }
}
