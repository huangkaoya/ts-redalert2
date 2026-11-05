import { TriggerCondition } from '../TriggerCondition';
export class CreditsBelowCondition extends TriggerCondition {
    private threshold: number;
    constructor(event: any, context: any) {
        super(event, context);
        this.threshold = Number(event.params[1]);
    }
    check(event: any, context: any): boolean {
        return !!this.player && this.player.credits < this.threshold;
    }
}
