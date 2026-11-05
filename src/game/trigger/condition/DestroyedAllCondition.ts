import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedAllCondition extends TriggerCondition {
    private allDestroyed: boolean;
    private houseId: number;
    constructor(event: any, trigger: any) {
        super(event, trigger);
        this.allDestroyed = false;
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
            const isTargetTechno = target.isTechno();
            const isTargetOwner = target.owner.country?.id === this.houseId;
            const hasNoRemainingObjects = !target.owner.getOwnedObjects(true).length;
            return isTargetTechno && isTargetOwner && hasNoRemainingObjects;
        });
        if (hasDestroyedAll) {
            this.allDestroyed = true;
        }
        return hasDestroyedAll;
    }
}
