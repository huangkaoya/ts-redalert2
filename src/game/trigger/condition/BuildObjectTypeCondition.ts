import { TriggerCondition } from "@/game/trigger/TriggerCondition";
import { EventType } from "@/game/event/EventType";
export class BuildObjectTypeCondition extends TriggerCondition {
    private objectType: any;
    private objectIndex: number;
    constructor(event: any, trigger: any, objectType: any) {
        super(event, trigger);
        this.objectType = objectType;
        this.objectIndex = Number(event.params[1]);
    }
    check(event: any, events: any[]): boolean {
        return events.some((event) => event.type === EventType.ObjectSpawn &&
            event.gameObject.type === this.objectType &&
            event.gameObject.rules.index === this.objectIndex);
    }
}
