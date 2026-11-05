import { BuildingInfiltrationEvent } from "@/game/event/BuildingInfiltrationEvent";
import { EnterBuildingTask } from "@/game/gameobject/task/EnterBuildingTask";
export class InfiltrateBuildingTask extends EnterBuildingTask {
    isAllowed(e: any): boolean {
        // 完善模拟层逻辑：no BuildDown gate (unlike CaptureBuildingTask).
        return (e.rules.infiltrate &&
            this.target.rules.spyable &&
            !this.target.isDestroyed &&
            !this.game.areFriendly(e, this.target));
    }
    onEnter(e: any): void {
        this.game.unspawnObject(e);
        e.agentTrait?.infiltrate(e, this.target, this.game);
        this.game.events.dispatch(new BuildingInfiltrationEvent(this.target, e));
    }
}
