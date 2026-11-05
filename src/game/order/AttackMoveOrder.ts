import { OrderType } from "@/game/order/OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { AttackMoveTask } from "@/game/gameobject/task/move/AttackMoveTask";
import { OrderFeedbackType } from "@/game/order/OrderFeedbackType";
import { MovementZone } from "@/game/type/MovementZone";
import { AttackOrder } from "@/game/order/AttackOrder";
import { PlantC4Task } from "@/game/gameobject/task/PlantC4Task";
import { AttackMoveTargetTask } from "@/game/gameobject/task/move/AttackMoveTargetTask";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { AttackTask } from "@/game/gameobject/task/AttackTask";
import { LocomotorType } from "@/game/type/LocomotorType";
export class AttackMoveOrder extends AttackOrder {
    private map: any;
    constructor(game: any, map: any) {
        super(game);
        this.map = map;
        this.orderType = OrderType.AttackMove;
        this.targetOptional = false;
        this.feedbackType = OrderFeedbackType.Move;
    }
    getPointerType(isMini: boolean, context: any): PointerType {
        if (this.isTargetted()) {
            let pointerType = super.getPointerType(isMini, context);
            if (pointerType === PointerType.AttackRange || pointerType === PointerType.AttackNoRange) {
                pointerType = PointerType.AttackMove;
            }
            return pointerType;
        }
        let isAllowed = this.isAllowed();
        if (isAllowed) {
            const hasBridge = !!this.target.getBridge();
            const speedType = this.sourceObject.rules.speedType;
            const isInfantry = this.sourceObject.isInfantry();
            const canFly = this.sourceObject.rules.movementZone === MovementZone.Fly;
            isAllowed = canFly ||
                this.map.terrain.getPassableSpeed(this.target.tile, speedType, isInfantry, hasBridge) > 0 ||
                !!this.game.mapShroudTrait
                    .getPlayerShroud(this.sourceObject.owner)
                    ?.isShrouded(this.target.tile, this.target.obj?.tileElevation);
        }
        if (isMini) {
            return isAllowed ? PointerType.AttackMini : PointerType.NoActionMini;
        }
        else {
            return isAllowed ? PointerType.AttackMove : PointerType.NoMove;
        }
    }
    isValid(): boolean {
        const isValid = this.sourceObject.isUnit() &&
            !!this.sourceObject.attackTrait &&
            !this.sourceObject.rules.preventAttackMove &&
            !(this.game.mapShroudTrait
                .getPlayerShroud(this.sourceObject.owner)
                ?.isShrouded(this.target.tile, this.target.obj?.tileElevation) &&
                !this.sourceObject.rules.moveToShroud) &&
            (!this.isTargetted() || super.isValid());
        this.feedbackType = OrderFeedbackType.Move;
        return isValid;
    }
    isAllowed(): boolean {
        return !(!this.isTargetted() &&
            this.sourceObject.moveTrait.isDisabled()) && super.isAllowed();
    }
    process(): any[] {
        if (this.isTargetted()) {
            if (this.isC4) {
                return [new PlantC4Task(this.game, this.target.obj)];
            }
            const weapon = this.sourceObject.attackTrait.selectWeaponVersus(this.sourceObject, this.target, this.game);
            return [new AttackMoveTargetTask(this.game, this.target, weapon)];
        }
        return [
            new AttackMoveTask(this.game, this.target.tile, !!this.target.getBridge(), { closeEnoughTiles: this.game.rules.general.closeEnough })
        ];
    }
    isTargetted(): boolean {
        return this.target.obj?.isTechno();
    }
    onAdd(taskList: any[], isQueued: boolean): boolean {
        const unit = this.sourceObject;
        if (!isQueued && unit.isUnit() && this.isValid() && this.isAllowed()) {
            if (unit.rules.movementZone === MovementZone.Fly) {
                const existingTask = taskList.find(task => [MoveTask, AttackTask, AttackMoveTask, AttackMoveTargetTask]
                    .includes(task.constructor) && !task.isCancelling());
                if (existingTask) {
                    if (this.isTargetted()) {
                        if ((unit.moveTrait.currentWaypoint?.tile === this.target.tile ||
                            unit.isAircraft() ||
                            existingTask.constructor !== MoveTask) &&
                            existingTask.forceCancel(unit)) {
                            // 完善模拟层逻辑：splice(index) drops cancelled task and everything after it.
                            taskList.splice(taskList.indexOf(existingTask));
                        }
                    }
                    else {
                        if (existingTask.constructor === AttackMoveTask) {
                            existingTask.updateTarget(this.target.tile, !!this.target.getBridge());
                            taskList.splice(taskList.indexOf(existingTask) + 1);
                            unit.unitOrderTrait.clearOrders();
                            return false;
                        }
                        if (existingTask.forceCancel(unit)) {
                            // 完善模拟层逻辑：splice(index) drops cancelled task and everything after it.
                            taskList.splice(taskList.indexOf(existingTask));
                        }
                    }
                }
            }
            else if (this.isTargetted() &&
                taskList.length &&
                unit.isUnit() &&
                (unit.rules.locomotor === LocomotorType.Vehicle ||
                    unit.rules.locomotor === LocomotorType.Ship)) {
                unit.moveTrait.speedPenalty = 0.5;
            }
        }
        return true;
    }
}
