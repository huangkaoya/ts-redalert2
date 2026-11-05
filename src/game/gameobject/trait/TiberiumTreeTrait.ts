import { NotifyTick } from './interface/NotifyTick';
import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { LandType } from '@/game/type/LandType';
import { ObjectType } from '@/engine/type/ObjectType';
import { OreSpread } from '@/game/map/OreSpread';
import { TiberiumType } from '@/engine/type/TiberiumType';
import { TiberiumTrait } from './TiberiumTrait';
export enum SpawnStatus {
    Idle = 0,
    Spawning = 1
}
export class TiberiumTreeTrait {
    private rules: any;
    private ticksSinceLastSpawn: number = 0;
    private cooldownTicks: number;
    private status: SpawnStatus = SpawnStatus.Idle;
    constructor(rules: any) {
        this.rules = rules;
        this.cooldownTicks = Math.floor(1 / rules.animationProbability);
    }
    [NotifyTick.onTick](gameObject: any, world: any): void {
        this.status = SpawnStatus.Idle;
        if (this.ticksSinceLastSpawn++ > this.cooldownTicks) {
            this.ticksSinceLastSpawn = 0;
            this.status = SpawnStatus.Spawning;
            this.spawnTiberium(gameObject.tile, world);
        }
    }
    private spawnTiberium(tile: any, world: any): void {
        for (let radius = 1; radius <= 2; radius++) {
            let finder = new RadialTileFinder(world.map.tiles, world.map.mapBounds, tile, { width: 1, height: 1 }, radius, radius, (tile) => TiberiumTrait.canBePlacedOn(tile, world.map));
            let targetTile = finder.getNextTile();
            if (targetTile) {
                const overlayId = OreSpread.calculateOverlayId(TiberiumType.Ore, targetTile);
                if (overlayId === undefined) {
                    throw new Error('Expected an overlayId');
                }
                const overlay = world.createObject(ObjectType.Overlay, world.rules.getOverlayName(overlayId));
                overlay.overlayId = overlayId;
                overlay.value = 3;
                world.spawnObject(overlay, targetTile);
                return;
            }
            finder = new RadialTileFinder(world.map.tiles, world.map.mapBounds, tile, { width: 1, height: 1 }, radius, radius, (tile) => tile.landType === LandType.Tiberium);
            let existingTiberium;
            while (!existingTiberium) {
                const nextTile = finder.getNextTile();
                if (!nextTile)
                    break;
                existingTiberium = world.map
                    .getObjectsOnTile(nextTile)
                    .find((obj) => obj.isOverlay() &&
                    obj.isTiberium() &&
                    obj.traits.get(TiberiumTrait).getBailCount() + 1 <= TiberiumTrait.maxBails);
            }
            if (existingTiberium) {
                existingTiberium.traits.get(TiberiumTrait).spawnBails(1);
                return;
            }
        }
    }
}
