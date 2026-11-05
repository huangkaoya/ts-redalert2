import { Action } from './Action';
import { DataStream } from '@/data/DataStream';
import { Building, BuildStatus } from '../gameobject/Building';
import { ActionType } from './ActionType';
import { DockableTrait } from '../gameobject/trait/DockableTrait';
import { Game } from '../Game';
export class SellObjectAction extends Action {
    private game: Game;
    private objectId: number;
    constructor(game: Game) {
        super(ActionType.SellObject);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): { objectId: number } {
        return { objectId: new DataStream(data).readUint32() };
    }
    static encodePayload(payload: { objectId: number }): Uint8Array {
        const stream = new DataStream(4);
        stream.writeUint32(payload.objectId);
        return stream.toUint8Array();
    }
    unserialize(data: Uint8Array): void {
        this.objectId = SellObjectAction.decodePayload(data).objectId;
    }
    serialize(): Uint8Array {
        return SellObjectAction.encodePayload({ objectId: this.objectId });
    }
    print(): string {
        return `Sell object ${this.objectId}`;
    }
    process(): void {
        const player = this.player;
        if (this.game.getWorld().hasObjectId(this.objectId)) {
            const object = this.game.getObjectById(this.objectId);
            if (object.isTechno() &&
                player === object.owner &&
                object.isSpawned) {
                const canSell = object.isBuilding()
                    ? object.buildStatus === BuildStatus.Ready && !object.warpedOutTrait.isActive()
                    : object.traits.find(DockableTrait)?.dock?.rules.unitSell;
                if (canSell) {
                    this.game.sellTrait.sell(object);
                }
            }
        }
    }
}
