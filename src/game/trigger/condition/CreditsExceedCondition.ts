import { TriggerCondition } from "@/game/trigger/TriggerCondition";
export class CreditsExceedCondition extends TriggerCondition {
    private threshold: number;
    constructor(event: any, context: any) {
        super(event, context);
        this.threshold = Number(event.params[1]);
    }
    check(params: any, context: any): boolean {
        return !!this.player && this.player.credits > this.threshold;
    }
}
