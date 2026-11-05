import { Action } from './Action';
import { DataStream } from '@/data/DataStream';
import { QueueType, QueueStatus } from '../player/production/ProductionQueue';
import { ObjectType } from '@/engine/type/ObjectType';
import { ActionType } from './ActionType';
import { Game } from '../Game';
export enum UpdateType {
    Add = 0,
    Cancel = 1,
    Pause = 2,
    Resume = 3,
    AddNext = 4
}
export class UpdateQueueAction extends Action {
    private game: Game;
    private queueType: number;
    private updateType: UpdateType;
    private item?: any;
    private quantity?: number;
    constructor(game: Game) {
        super(ActionType.UpdateQueue);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): {
        queueType: number;
        updateType: UpdateType;
        item?: { id: number; type: number; quantity: number };
    } {
        const stream = new DataStream(data);
        const payload: {
            queueType: number;
            updateType: UpdateType;
            item?: { id: number; type: number; quantity: number };
        } = {
            queueType: stream.readUint8(),
            updateType: stream.readUint8(),
        };
        if (
            payload.updateType === UpdateType.Add ||
            payload.updateType === UpdateType.Cancel ||
            payload.updateType === UpdateType.AddNext
        ) {
            payload.item = {
                id: stream.readUint32(),
                type: stream.readUint8(),
                quantity: stream.readUint16(),
            };
        }
        return payload;
    }
    static encodePayload(payload: {
        queueType: number;
        updateType: UpdateType;
        item?: { id: number; type: number; quantity: number };
    }): Uint8Array {
        const stream = new DataStream(9);
        stream.dynamicSize = false;
        stream.writeUint8(payload.queueType);
        stream.writeUint8(payload.updateType);
        if (
            payload.updateType === UpdateType.Add ||
            payload.updateType === UpdateType.Cancel ||
            payload.updateType === UpdateType.AddNext
        ) {
            if (!payload.item) {
                throw new Error("Missing quantity");
            }
            if (payload.item.quantity > 65535) {
                throw new Error("Maximum quantity exceeded");
            }
            stream.writeUint32(payload.item.id);
            stream.writeUint8(payload.item.type);
            stream.writeUint16(payload.item.quantity);
        }
        return new Uint8Array(stream.buffer, stream.byteOffset, stream.position);
    }
    unserialize(data: Uint8Array): void {
        const payload = UpdateQueueAction.decodePayload(data);
        this.queueType = payload.queueType;
        this.updateType = payload.updateType;
        if (payload.item) {
            this.item = this.game.rules.getTechnoByInternalId(payload.item.id, payload.item.type);
            this.quantity = payload.item.quantity;
        }
    }
    serialize(): Uint8Array {
        return UpdateQueueAction.encodePayload({
            queueType: this.queueType,
            updateType: this.updateType,
            item:
                this.item && this.quantity !== undefined
                    ? {
                        id: this.item.index,
                        type: this.item.type,
                        quantity: this.quantity,
                    }
                    : undefined,
        });
    }
    print(): string {
        switch (this.updateType) {
            case UpdateType.Resume:
                return `Resume queue ${QueueType[this.queueType]}`;
            case UpdateType.Add:
                return `Add to queue ${this.item.name} x ${this.quantity}`;
            case UpdateType.AddNext:
                return `Add next in queue ${this.item.name} x ${this.quantity}`;
            case UpdateType.Pause:
                return `Put queue ${QueueType[this.queueType]} on hold.`;
            case UpdateType.Cancel:
                return `Cancel ${this.item.name} x ${this.quantity}`;
            default:
                return `Unhandled queue update type ${this.updateType}`;
        }
    }
    process(): void {
        const player = this.player;
        const item = this.item;
        const queue = player.production.getQueue(this.queueType);
        if (this.updateType === UpdateType.Resume) {
            if (queue.status === QueueStatus.OnHold) {
                queue.status = QueueStatus.Active;
            }
        }
        else if (this.updateType === UpdateType.Add || this.updateType === UpdateType.AddNext) {
            const existingItems = queue.find(item);
            if (queue.status === QueueStatus.Active ||
                queue.status === QueueStatus.Idle ||
                (queue.status === QueueStatus.OnHold && existingItems[0] !== queue.getFirst()) ||
                (queue.status === QueueStatus.Ready && item.type !== ObjectType.Building)) {
                let buildLimit: number;
                const queuedQuantity = existingItems.reduce((sum, item) => sum + item.quantity, 0);
                if (Number.isFinite(item.buildLimit)) {
                    const builtCount = item.buildLimit >= 0
                        ? player.getOwnedObjectsByType(item.type, true)
                            .filter(obj => obj.name === item.name).length
                        : player.getLimitedUnitsBuilt(item.name);
                    buildLimit = Math.max(0, Math.abs(item.buildLimit) - (builtCount + queuedQuantity));
                }
                else {
                    buildLimit = Number.POSITIVE_INFINITY;
                }
                if (buildLimit && player.production.isAvailableForProduction(item)) {
                    const maxQuantity = Math.min(queue.maxSize - queue.currentSize, queue.maxItemQuantity - queuedQuantity, buildLimit);
                    const quantity = Math.min(this.quantity!, maxQuantity);
                    if (quantity > 0) {
                        if (this.updateType === UpdateType.AddNext) {
                            queue.insertAfterFirst(item, quantity, item.cost);
                        }
                        else {
                            queue.push(item, quantity, item.cost);
                        }
                    }
                }
            }
        }
        else if (this.updateType === UpdateType.Cancel) {
            if ([QueueStatus.Ready, QueueStatus.OnHold, QueueStatus.Active].includes(queue.status)) {
                const existingItems = queue.find(item);
                if (existingItems.length) {
                    const totalQuantity = existingItems.reduce((sum, item) => sum + item.quantity, 0);
                    const cancelQuantity = Math.min(totalQuantity, this.quantity!);
                    if (cancelQuantity > 0) {
                        queue.pop(item, cancelQuantity);
                        if (cancelQuantity === totalQuantity) {
                            player.credits += existingItems[0].creditsSpent;
                        }
                    }
                }
            }
        }
        else if (this.updateType === UpdateType.Pause) {
            if (queue.status === QueueStatus.Active) {
                queue.status = QueueStatus.OnHold;
            }
        }
    }
}
