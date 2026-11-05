import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class SpyEnteringAsHouseCondition extends TriggerCondition {
    private houseId: number;
    constructor(event: any, targets: any[]) {
        super(event, targets);
        this.houseId = Number(event.params[1]);
    }
    // 完善模拟层逻辑：check(context, events) — filter the events list (2nd arg).
    check(_context: any, events: any[]): any[] {
        return events
            .filter((event) => {
            if (event.type !== EventType.BuildingInfiltration)
                return false;
            const target = event.target;
            return (this.targets.includes(target) &&
                (this.houseId === -1 ||
                    event.source.disguiseTrait?.getDisguise()?.owner?.country?.id === this.houseId));
        })
            .map((event) => event.target);
    }
}
