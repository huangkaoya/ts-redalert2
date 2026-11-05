import { ObjectType } from "@/engine/type/ObjectType";
import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedAllUnitsNavalCondition extends TriggerCondition {
    private allDestroyed: boolean;
    private houseId: number;
    constructor(event: any, context: any) {
        super(event, context);
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
            if (!target.isVehicle() || target.owner.country?.id !== this.houseId) {
                return false;
            }
            const remainingNavalUnits = target.owner
                .getOwnedObjectsByType(ObjectType.Vehicle, true)
                .filter((unit) => unit.rules.naval).length;
            return remainingNavalUnits === 0;
        });
        if (hasDestroyedAll) {
            this.allDestroyed = true;
        }
        return hasDestroyedAll;
    }
}
