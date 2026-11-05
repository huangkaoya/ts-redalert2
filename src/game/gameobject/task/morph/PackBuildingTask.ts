import { Task } from "@/game/gameobject/task/system/Task";
import { Building, BuildStatus } from "@/game/gameobject/Building";
import { WaitMinutesTask } from "@/game/gameobject/task/system/WaitMinutesTask";
export class PackBuildingTask extends Task {
    private game: any;
    constructor(game: any) {
        super();
        this.game = game;
    }
    onTick(unit: any): boolean {
        // 完善模拟层逻辑：always set BuildDown when not already packing; only walls
        // skip the buildup wait (return true immediately after the status change).
        if (unit.buildStatus !== BuildStatus.BuildDown) {
            unit.setBuildStatus(BuildStatus.BuildDown, this.game);
            if (!unit.rules.wall) {
                this.children.push(new WaitMinutesTask(this.game.rules.general.buildupTime));
                return false;
            }
        }
        return true;
    }
}
