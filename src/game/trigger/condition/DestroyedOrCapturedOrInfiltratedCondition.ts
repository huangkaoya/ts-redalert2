import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedOrCapturedOrInfiltratedCondition extends TriggerCondition {
    private eventsFilter: EventType[];
    constructor(event?: any, trigger?: any) {
        // 完善模拟层逻辑：pass through without nullish coercion.
        super(event, trigger);
        this.eventsFilter = [
            EventType.ObjectDestroy,
            EventType.ObjectOwnerChange,
            EventType.BuildingInfiltration
        ];
    }
    check(event: any, events: any[]): any[] {
        return events
            .filter(event => {
            if (!this.eventsFilter.includes(event.type)) {
                return false;
            }
            const target = event.target;
            return !(!target.isTechno() || !this.targets.includes(target));
        })
            .map(event => event.target);
    }
}
