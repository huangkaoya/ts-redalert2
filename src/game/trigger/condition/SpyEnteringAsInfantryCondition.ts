import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class SpyEnteringAsInfantryCondition extends TriggerCondition {
    private infantryIdx: number;
    constructor(event: any, targets: any[]) {
        super(event, targets);
        this.infantryIdx = Number(event.params[1]);
    }
    // 完善模拟层逻辑：check(context, events) — filter the events list (2nd arg).
    check(_context: any, events: any[]): any[] {
        return events
            .filter((event) => {
            if (event.type !== EventType.BuildingInfiltration)
                return false;
            const target = event.target;
            return (this.targets.includes(target) &&
                event.source.disguiseTrait?.getDisguise()?.rules.index === this.infantryIdx);
        })
            .map((event) => event.target);
    }
}
