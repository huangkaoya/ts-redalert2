import { Order } from "./Order";
import { OrderType } from "./OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { OrderFeedbackType } from "./OrderFeedbackType";
import { EnterTransportTask } from "@/game/gameobject/task/EnterTransportTask";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { MoveState } from "@/game/gameobject/trait/MoveTrait";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
export class EnterTransportOrder extends Order {
    private game: any;
    constructor(game: any) {
        super(OrderType.EnterTransport);
        this.game = game;
        this.targetOptional = false;
        this.terminal = true;
        this.feedbackType = OrderFeedbackType.Enter;
    }
    getPointerType(isMini: boolean): PointerType {
        if (isMini) {
            return this.isAllowed() ? PointerType.OccupyMini : PointerType.NoActionMini;
        }
        return this.isAllowed() ? PointerType.Occupy : PointerType.NoOccupy;
    }
    isValid(): boolean {
        return !(!this.target.obj?.isVehicle() ||
            !this.target.obj.transportTrait ||
            this.target.obj.isDestroyed ||
            this.target.obj === this.sourceObject ||
            !this.game.areFriendly(this.target.obj, this.sourceObject) ||
            (!this.sourceObject.isVehicle() && !this.sourceObject.isInfantry()));
    }
    isAllowed(): boolean {
        const target = this.target.obj;
        const source = this.sourceObject;
        return (source.zone !== ZoneType.Air &&
            target.zone !== ZoneType.Air &&
            target.transportTrait.unitFitsInside(source) &&
            target.moveTrait.moveState === MoveState.Idle &&
            !target.warpedOutTrait.isActive() &&
            !source.mindControllableTrait?.isActive() &&
            !source.mindControllerTrait?.isActive());
    }
    process(): (EnterTransportTask | CallbackTask)[] {
        const source = this.sourceObject;
        const target = this.target.obj;
        if (this.game.map.terrain.getPassableSpeed(target.tile, source.rules.speedType, source.isInfantry(), source.onBridge)) {
            return [new EnterTransportTask(this.game, target)];
        }
        return [
            new CallbackTask(() => {
                target.unitOrderTrait.addTask(new MoveTask(this.game, source.tile, source.onBridge));
                target.unitOrderTrait.addTask(new CallbackTask(() => {
                    if (this.game.map.terrain.getPassableSpeed(target.tile, source.rules.speedType, source.isInfantry(), source.onBridge)) {
                        source.unitOrderTrait.addTask(new EnterTransportTask(this.game, target));
                    }
                }));
            })
        ];
    }
    onAdd(tasks: any[], isQueued: boolean): boolean {
        if (!isQueued) {
            const existingEnterTask = tasks.find((task) => task instanceof EnterTransportTask);
            if (this.isValid() &&
                this.isAllowed() &&
                existingEnterTask &&
                !existingEnterTask.isCancelling() &&
                existingEnterTask.target === this.target.obj) {
                if (new RangeHelper(this.game.map.tileOccupation).isInTileRange(this.sourceObject, this.target.obj, 0, Math.SQRT2)) {
                    return false;
                }
            }
        }
        return true;
    }
}
