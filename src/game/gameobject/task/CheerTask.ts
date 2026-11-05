import { Task } from "./system/Task";
import { SequenceType } from "@/game/art/SequenceType";
import { StanceType } from "@/game/gameobject/infantry/StanceType";
import { WaitMinutesTask } from "./system/WaitMinutesTask";
export class CheerTask extends Task {
    private executed: boolean = false;
    constructor() {
        super();
        this.cancellable = false;
    }
    onTick(gameObject: any): boolean {
        if (this.executed) {
            gameObject.stance = StanceType.None;
            return true;
        }
        // 完善模拟层逻辑：if the unit cannot cheer, finish the task (return true)
        // so a non-cancellable CheerTask does not block the order queue forever.
        if (!gameObject.isInfantry() ||
            !gameObject.art.sequences.has(SequenceType.Cheer) ||
            (gameObject.stance !== StanceType.None &&
                gameObject.stance !== StanceType.Guard)) {
            return true;
        }
        gameObject.stance = StanceType.Cheer;
        this.children.push(new WaitMinutesTask(1 / 60).setCancellable(false));
        this.executed = true;
        return false;
    }
}
