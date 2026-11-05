import { ObjectType } from "@/engine/type/ObjectType";
import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedAllUnitsCondition extends TriggerCondition {
    private allDestroyed: boolean;
    private houseId: number;
    constructor(event: any, trigger: any) {
        super(event, trigger);
        this.allDestroyed = false;
        this.houseId = Number(event.params[1]);
    }
    // 完善模拟层逻辑：check(context, events) — scan the events list (2nd arg).
    check(_context: any, events: any[]): boolean {
        return (
            !!this.allDestroyed ||
            (!!events.some((event) => {
                if (event.type !== EventType.ObjectDestroy) {
                    return false;
                }
                const target = event.target;
                return (
                    !(!target.isUnit() || target.owner.country?.id !== this.houseId) &&
                    !this.hasUnitsLeft(target.owner)
                );
            }) &&
                (this.allDestroyed = true))
        );
    }
    private hasUnitsLeft(owner: any): boolean {
        const unitTypes = [
            ObjectType.Aircraft,
            ObjectType.Vehicle,
            ObjectType.Infantry,
        ];
        for (const type of unitTypes) {
            if (owner.getOwnedObjectsByType(type, true).length) {
                return true;
            }
        }
        return false;
    }
}
