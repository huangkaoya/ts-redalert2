import { Action } from './Action';
import { DataStream } from '@/data/DataStream';
import { ActionType } from './ActionType';
import { PingLocationEvent } from '../event/PingLocationEvent';
import { RadarEvent } from '../event/RadarEvent';
import { RadarEventType } from '../rules/general/RadarRules';
import { Game } from '../Game';
export class PingLocationAction extends Action {
    private game: Game;
    private tile: {
        x: number;
        y: number;
    };
    constructor(game: Game) {
        super(ActionType.PingLocation);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): { tile: { rx: number; ry: number } } {
        const stream = new DataStream(data);
        return {
            tile: {
                rx: stream.readUint16(),
                ry: stream.readUint16(),
            },
        };
    }
    static encodePayload(payload: { tile: { rx: number; ry: number } }): Uint8Array {
        const stream = new DataStream(4);
        stream.writeUint16(payload.tile.rx);
        stream.writeUint16(payload.tile.ry);
        return stream.toUint8Array();
    }
    unserialize(data: Uint8Array): void {
        const payload = PingLocationAction.decodePayload(data);
        this.tile = {
            x: payload.tile.rx,
            y: payload.tile.ry,
        };
    }
    serialize(): Uint8Array {
        return PingLocationAction.encodePayload({
            tile: {
                rx: this.tile.x,
                ry: this.tile.y,
            },
        });
    }
    print(): string {
        return `Ping location at tile (${this.tile.x}, ${this.tile.y})`;
    }
    process(): void {
        const player = this.player;
        const tile = this.game.map.tiles.getByMapCoords(this.tile.x, this.tile.y);
        if (tile) {
            this.game.events.dispatch(new PingLocationEvent(tile, player));
            const allies = [player, ...this.game.alliances.getAllies(player)];
            for (const ally of allies) {
                this.game.events.dispatch(new RadarEvent(ally, RadarEventType.GenericNonCombat, tile));
            }
        }
        else {
            console.warn(`Tile ${this.tile.x},${this.tile.y} doesn't exist`);
        }
    }
}
