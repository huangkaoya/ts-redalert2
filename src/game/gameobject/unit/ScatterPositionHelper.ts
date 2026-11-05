import { MovePositionHelper } from '@/game/gameobject/unit/MovePositionHelper';
import { RandomTileFinder } from '@/game/map/tileFinder/RandomTileFinder';
interface Game {
    map: {
        tiles: any;
        mapBounds: any;
        tileOccupation: {
            getBridgeOnTile(tile: any): any;
        };
        terrain: {
            findObstacles(params: {
                tile: any;
                onBridge: any;
            }, unit: any): any[];
        };
    };
}
interface Unit {
    tile: any;
    onBridge?: boolean;
}
interface MovePosition {
    tile: any;
    onBridge?: any;
}
interface FindFreeMovePositionOptions {
    ignoredBlockers?: any[];
    excludedTiles?: any[];
    noSlopes?: boolean;
}
export class ScatterPositionHelper {
    private game: Game;
    private movePositionHelper: MovePositionHelper;
    constructor(game: Game) {
        this.game = game;
        this.movePositionHelper = new MovePositionHelper(game.map as any);
    }
    findPositions(units: Unit[], options: FindFreeMovePositionOptions = {}): Map<Unit, MovePosition> {
        const occupiedTiles = new Set();
        const positions = new Map();
        for (const unit of units) {
            const position = this.findFreeMovePosition(unit, occupiedTiles, options);
            if (position) {
                positions.set(unit, position);
                occupiedTiles.add(position.tile);
            }
        }
        return positions;
    }
    findFreeMovePosition(unit: Unit, occupiedTiles: Set<any>, { ignoredBlockers, excludedTiles, noSlopes }: FindFreeMovePositionOptions = {}): MovePosition | undefined {
        const map = this.game.map;
        const unitBridge = unit.onBridge ? map.tileOccupation.getBridgeOnTile(unit.tile) : undefined;
        const tileFinder = new RandomTileFinder(map.tiles, map.mapBounds, unit.tile, 1, this.game as any, (tile) => {
            if (excludedTiles?.includes(tile))
                return false;
            const bridge = map.tileOccupation.getBridgeOnTile(tile);
            return (((bridge &&
                this.movePositionHelper.isEligibleTile(tile as any, bridge, unitBridge, unit.tile)) ||
                this.movePositionHelper.isEligibleTile(tile as any, undefined, unitBridge, unit.tile)) &&
                (!noSlopes || tile.rampType === 0));
        });
        let foundTile;
        let foundBridge;
        while (true) {
            const tile = tileFinder.getNextTile();
            if (!tile)
                break;
            foundTile = tile;
            foundBridge = map.tileOccupation.getBridgeOnTile(tile);
            if (foundBridge &&
                !this.movePositionHelper.isEligibleTile(tile as any, foundBridge, unitBridge, unit.tile)) {
                foundBridge = undefined;
            }
            if (!occupiedTiles.has(tile)) {
                let obstacles = map.terrain.findObstacles({ tile, onBridge: foundBridge }, unit);
                if (ignoredBlockers && ignoredBlockers.length) {
                    obstacles = obstacles.filter(obs => !ignoredBlockers.includes(obs.obj));
                }
                if (!obstacles.length)
                    break;
            }
        }
        if (foundTile) {
            return { tile: foundTile, onBridge: foundBridge };
        }
    }
}
