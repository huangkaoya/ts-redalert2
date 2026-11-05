import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class DestroyedOrCapturedCondition extends TriggerCondition {
    // 完善模拟层逻辑：check(context, events) — filter the events list (2nd arg).
    check(_context: any, events: any[]) {
        return events
            .filter((event) => {
            if (event.type !== EventType.ObjectDestroy &&
                event.type !== EventType.ObjectOwnerChange) {
                return false;
            }
            const target = event.target;
            return !(!target.isTechno() || !this.targets.includes(target));
        })
            .map((event) => event.target);
    }
}
