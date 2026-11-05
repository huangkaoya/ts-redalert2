import { Action } from './Action';
import { ActionType } from './ActionType';
import { DataStream } from '@/data/DataStream';
import { OrderUnitsAction, ORDER_UNIT_LIMIT } from './OrderUnitsAction';
import { OrderActionContext } from './OrderActionContext';
import { GameObject } from '../gameobject/GameObject';
export class SelectUnitsAction extends Action {
    private _unitIds: number[] = [];
    private game: any;
    private orderActionContext: OrderActionContext;
    constructor(game: any, orderActionContext: OrderActionContext) {
        super(ActionType.SelectUnits);
        this.game = game;
        this.orderActionContext = orderActionContext;
    }
    get unitIds(): number[] {
        return this._unitIds;
    }
    set unitIds(value: number[]) {
        this._unitIds = value.slice(0, ORDER_UNIT_LIMIT);
    }
    static decodePayload(data: Uint8Array): { unitIds: number[] } {
        const stream = new DataStream(data);
        const unitIds = new Array(data.byteLength / 4);
        for (let i = 0; i < data.byteLength / 4; i++) {
            unitIds[i] = stream.readUint32();
        }
        return { unitIds };
    }
    static encodePayload(payload: { unitIds: number[] }): Uint8Array {
        const stream = new DataStream(4 * payload.unitIds.length);
        stream.dynamicSize = false;
        for (const id of payload.unitIds) {
            stream.writeUint32(id);
        }
        return stream.toUint8Array();
    }
    unserialize(data: Uint8Array): void {
        this.unitIds = SelectUnitsAction.decodePayload(data).unitIds;
    }
    serialize(): Uint8Array {
        return SelectUnitsAction.encodePayload({ unitIds: this.unitIds });
    }
    print(): string {
        return `Select unit(s) [${this.unitIds.join(',')}]`;
    }
    process(): void {
        const player = this.player;
        const units: GameObject[] = [];
        for (const id of this.unitIds) {
            let unit = player.getOwnedObjectById(id);
            if (!unit && this.game.getWorld().hasObjectId(id)) {
                const worldObj = this.game.getWorld().getObjectById(id);
                if (worldObj.isTechno()) {
                    unit = worldObj;
                }
            }
            if (unit) {
                units.push(unit);
            }
        }
        this.orderActionContext.getOrCreateSelection(player).update(units);
    }
}
