import { Order } from "./Order";
import { OrderType } from "./OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { ScatterTask } from "../gameobject/task/ScatterTask";
import { MovementZone } from "../type/MovementZone";
export class ScatterOrder extends Order {
    private game: any;
    constructor(game: any) {
        super(OrderType.Scatter);
        this.game = game;
    }
    getPointerType(): PointerType {
        return PointerType.NoAction;
    }
    isValid(): boolean {
        return ((this.sourceObject.isInfantry() || this.sourceObject.isVehicle()) &&
            this.sourceObject.rules.movementZone !== MovementZone.Fly &&
            !this.sourceObject.moveTrait.isDisabled());
    }
    isAllowed(): boolean {
        return true;
    }
    process() {
        if (!this.target) {
            throw new Error("Target should be set for executing a scatter order. See OrderUnitsAction.");
        }
        return [
            new ScatterTask(this.game, {
                tile: this.target.tile,
                toBridge: !!this.target.getBridge(),
            }, undefined),
        ];
    }
}
