import { EventType } from "@/game/event/EventType";
import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class HealthBelowCombatCondition extends TriggerCondition {
    private threshold: number;
    constructor(id: string, targets: any[], threshold: number) {
        super(id, targets);
        this.threshold = threshold;
    }
    // 完善模拟层逻辑：check(context, events) — filter the events list (2nd arg).
    check(_context: any, events: any[]): any[] {
        return events
            .filter((event) => {
            if (event.type !== EventType.InflictDamage)
                return false;
            const target = event.target;
            return (!(!target.isTechno() || !this.targets.includes(target)) &&
                event.currentHealth < this.threshold &&
                event.prevHealth > this.threshold);
        })
            .map((event) => event.target);
    }
}
