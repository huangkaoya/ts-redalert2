import { DataStream } from '@/data/DataStream';
import { Action } from '@/game/action/Action';
import { ActionType } from '@/game/action/ActionType';
import { SuperWeaponType } from '@/game/type/SuperWeaponType';
import { SuperWeaponsTrait } from '@/game/trait/SuperWeaponsTrait';
import { Game } from '@/game/Game';
export class ActivateSuperWeaponAction extends Action {
    private game: Game;
    private superWeaponType: number;
    private tile: {
        x: number;
        y: number;
    };
    private tile2?: {
        x: number;
        y: number;
    };
    constructor(game: Game) {
        super(ActionType.ActivateSuperWeapon);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): {
        superWeaponType: number;
        tile: { rx: number; ry: number };
        tile2?: { rx: number; ry: number };
    } {
        const stream = new DataStream(data);
        const superWeaponType = stream.readUint8();
        const tileCount = stream.readUint8();
        const payload: {
            superWeaponType: number;
            tile: { rx: number; ry: number };
            tile2?: { rx: number; ry: number };
        } = {
            superWeaponType,
            tile: {
                rx: stream.readUint16(),
                ry: stream.readUint16(),
            },
        };
        if (tileCount > 2) {
            payload.tile2 = {
                rx: stream.readUint16(),
                ry: stream.readUint16(),
            };
        }
        return payload;
    }
    static encodePayload(payload: {
        superWeaponType: number;
        tile: { rx: number; ry: number };
        tile2?: { rx: number; ry: number };
    }): Uint8Array {
        const stream = new DataStream(6 + (payload.tile2 ? 4 : 0));
        stream.dynamicSize = false;
        stream.writeUint8(payload.superWeaponType);
        stream.writeUint8(payload.tile2 ? 4 : 2);
        stream.writeUint16(payload.tile.rx);
        stream.writeUint16(payload.tile.ry);
        if (payload.tile2) {
            stream.writeUint16(payload.tile2.rx);
            stream.writeUint16(payload.tile2.ry);
        }
        return stream.toUint8Array();
    }
    unserialize(data: Uint8Array): void {
        const payload = ActivateSuperWeaponAction.decodePayload(data);
        this.superWeaponType = payload.superWeaponType;
        this.tile = {
            x: payload.tile.rx,
            y: payload.tile.ry,
        };
        if (payload.tile2) {
            this.tile2 = {
                x: payload.tile2.rx,
                y: payload.tile2.ry,
            };
        }
    }
    serialize(): Uint8Array {
        return ActivateSuperWeaponAction.encodePayload({
            superWeaponType: this.superWeaponType,
            tile: {
                rx: this.tile.x,
                ry: this.tile.y,
            },
            tile2: this.tile2
                ? {
                    rx: this.tile2.x,
                    ry: this.tile2.y,
                }
                : undefined,
        });
    }
    print(): string {
        return `Activate SuperW ${SuperWeaponType[this.superWeaponType]} at tile (${this.tile.x}, ${this.tile.y})` +
            (this.tile2 ? `, (${this.tile2.x}, ${this.tile2.y})` : '');
    }
    process(): void {
        const player = this.player;
        const tile = this.game.map.tiles.getByMapCoords(this.tile.x, this.tile.y);
        if (!tile) {
            console.warn(`Tile ${this.tile.x},${this.tile.y} doesn't exist`);
            return;
        }
        const tile2 = this.tile2
            ? this.game.map.tiles.getByMapCoords(this.tile2.x, this.tile2.y)
            : undefined;
        this.game.traits
            .get(SuperWeaponsTrait)
            .activateSuperWeapon(this.superWeaponType, player, this.game, tile, tile2);
    }
}
