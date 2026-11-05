import { Order } from "./Order";
import { OrderType } from "./OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { OrderFeedbackType } from "./OrderFeedbackType";
import { MoveTrait, MoveResult } from "@/game/gameobject/trait/MoveTrait";
import { GatherOreTask } from "@/game/gameobject/task/harvester/GatherOreTask";
import { ReturnOreTask } from "@/game/gameobject/task/harvester/ReturnOreTask";
export class GuardAreaOrder extends Order {
    private game: any;
    private targeted: boolean;
    constructor(game: any, targeted: boolean) {
        super(targeted ? OrderType.GuardArea : OrderType.Guard);
        this.game = game;
        this.targeted = targeted;
        this.terminal = true;
        this.targetOptional = !targeted;
        this.minimapAllowed = targeted;
        this.feedbackType = targeted ? OrderFeedbackType.Move : OrderFeedbackType.None;
    }
    getPointerType(isMini: boolean): PointerType {
        if (isMini) {
            return this.isAllowed() ? PointerType.GuardMini : PointerType.NoActionMini;
        }
        return this.isAllowed() ? PointerType.Guard : PointerType.NoMove;
    }
    isValid(): boolean {
        return (this.sourceObject.isUnit() &&
            (!!this.targetOptional || !this.sourceObject.moveTrait.isDisabled()) &&
            !(this.target &&
                this.game.mapShroudTrait
                    .getPlayerShroud(this.sourceObject.owner)
                    ?.isShrouded(this.target.tile, this.target.obj?.tileElevation) &&
                !this.sourceObject.rules.moveToShroud));
    }
    isAllowed(): boolean {
        return true;
    }
    process(): (MoveTask | CallbackTask | GatherOreTask | ReturnOreTask)[] {
        const targetTile = this.targeted ? this.target.tile : undefined;
        const sourceObject = this.sourceObject;
        const tasks: (MoveTask | CallbackTask | GatherOreTask | ReturnOreTask)[] = [];
        if (targetTile) {
            tasks.push(new MoveTask(this.game, targetTile, !!this.target.getBridge(), {
                closeEnoughTiles: this.game.rules.general.closeEnough,
            }));
        }
        if (sourceObject.isVehicle() && sourceObject.harvesterTrait) {
            // 完善模拟层逻辑：full harvester returns ore; otherwise gather (explicit guard order).
            tasks.push(new CallbackTask(() => {
                sourceObject.harvesterTrait.lastOreSite = undefined;
            }), sourceObject.harvesterTrait.isFull()
                ? new ReturnOreTask(this.game, undefined, false, true)
                : new GatherOreTask(this.game, undefined, true));
        }
        else {
            tasks.push(new CallbackTask(() => {
                if (!targetTile ||
                    [
                        MoveResult.Success,
                        MoveResult.CloseEnough,
                    ].includes(this.sourceObject.moveTrait?.lastMoveResult)) {
                    this.sourceObject.guardMode = true;
                }
            }));
        }
        return tasks;
    }
}
