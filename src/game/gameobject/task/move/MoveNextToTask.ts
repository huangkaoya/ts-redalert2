import { MoveTask } from '@/game/gameobject/task/move/MoveTask';
import { RangeHelper } from '@/game/gameobject/unit/RangeHelper';

export class MoveNextToTask extends MoveTask {
    target: any;
    rangeHelper: RangeHelper;

    static chooseTargetFoundationTile(target: any, game: any) {
        if (target.isBuilding()) {
            let tile = target.centerTile;
            if (!game.map.mapBounds.isWithinBounds(tile)) {
                tile =
                    game.map.tileOccupation
                        .calculateTilesForGameObject(target.tile, target)
                        .find((candidate: any) => game.map.mapBounds.isWithinBounds(candidate)) ??
                    target.tile;
            }
            return tile;
        }
        return target.tile;
    }

    constructor(game: any, target: any) {
        super(game, MoveNextToTask.chooseTargetFoundationTile(target, game), false, {
            ignoredBlockers: [target],
            closeEnoughTiles: Math.SQRT2,
            strictCloseEnough: true,
        });
        this.target = target;
        this.rangeHelper = new RangeHelper(game.map.tileOccupation);
    }

    hasReachedDestination(unit: any): boolean {
        return super.hasReachedDestination(unit) || this.canStopAtTile(unit, unit.tile, unit.onBridge);
    }

    canStopAtTile(unit: any, tile: any, onBridge: any): boolean {
        return (
            !this.game.map.tileOccupation.isTileOccupiedBy(tile, this.target) &&
            super.canStopAtTile(unit, tile, onBridge)
        );
    }

    isCloseEnoughToDest(unit: any, tile: any, closeEnoughTiles: any): boolean {
        return (
            closeEnoughTiles === undefined ||
            (this.rangeHelper.isInTileRange(tile, this.target, 0, closeEnoughTiles) &&
                !this.game.map.tileOccupation.isTileOccupiedBy(tile, this.target))
        );
    }
}
