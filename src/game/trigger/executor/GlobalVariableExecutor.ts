import { TriggerExecutor } from '@/game/trigger/TriggerExecutor';
export class GlobalVariableExecutor extends TriggerExecutor {
    private value: any;
    private variableIdx: number;
    constructor(action: any, context: any, value: any) {
        super(action, context);
        this.value = value;
        this.variableIdx = Number(action.params[1]);
    }
    execute(context: any): void {
        context.triggers.toggleGlobalVariable(this.variableIdx, this.value);
    }
}
