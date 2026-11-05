import { DataStream } from '@/data/DataStream';
import { Action } from '@/game/action/Action';
import { ActionType } from '@/game/action/ActionType';
import { Game } from '@/game/Game';
export enum DebugCommandType {
    SetGlobalDebugText = 0,
    SetUnitDebugText = 1
}
export class DebugCommand {
    constructor(public type: DebugCommandType, public params: {
        unitId?: number;
        label?: string;
        text?: string;
    }) { }
}
export class DebugAction extends Action {
    private game: Game;
    private command: DebugCommand;
    constructor(game: Game) {
        super(ActionType.DebugCommand);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): {
        commandType: DebugCommandType;
        params?: { unitId?: number; label?: string; text?: string };
    } {
        const stream = new DataStream(data);
        const commandType = stream.readUint8();
        if (commandType === DebugCommandType.SetUnitDebugText) {
            return {
                commandType,
                params: {
                    unitId: stream.readUint32(),
                    label: stream.readCString() || undefined,
                },
            };
        }
        if (commandType === DebugCommandType.SetGlobalDebugText) {
            return {
                commandType,
                params: {
                    text: stream.readCString(),
                },
            };
        }
        return {
            commandType,
            params: undefined,
        };
    }
    static encodePayload(payload: {
        commandType: DebugCommandType;
        params?: { unitId?: number; label?: string; text?: string };
    }): Uint8Array {
        const stream = new DataStream();
        stream.writeUint8(payload.commandType);
        if (payload.commandType === DebugCommandType.SetUnitDebugText) {
            const params = payload.params!;
            stream.writeUint32(params.unitId!);
            stream.writeCString(params.label || '');
        }
        else if (payload.commandType === DebugCommandType.SetGlobalDebugText) {
            stream.writeCString(payload.params!.text!);
        }
        else {
            throw new Error(`Debug command ${payload.commandType} not implemented`);
        }
        return stream.toUint8Array();
    }
    unserialize(data: Uint8Array): void {
        const payload = DebugAction.decodePayload(data);
        if (
            payload.commandType === DebugCommandType.SetUnitDebugText ||
            payload.commandType === DebugCommandType.SetGlobalDebugText
        ) {
            this.command = new DebugCommand(payload.commandType, payload.params);
        }
        else {
            console.warn(`Debug command ${payload.commandType} not implemented`);
        }
    }
    serialize(): Uint8Array {
        return DebugAction.encodePayload({
            commandType: this.command.type,
            params: this.command.params,
        });
    }
    process(): void {
        if (this.command.type === DebugCommandType.SetUnitDebugText) {
            const { unitId, label } = this.command.params;
            if (this.game.getWorld().hasObjectId(unitId)) {
                const object = this.game.getObjectById(unitId);
                if (object.isTechno()) {
                    object.debugLabel = label;
                }
            }
        }
        else if (this.command.type === DebugCommandType.SetGlobalDebugText) {
            const { text } = this.command.params;
            this.game.debugText.value = text;
        }
        else {
            console.warn(`Debug command ${this.command.type} not implemented`);
        }
    }
}
