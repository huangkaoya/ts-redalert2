import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { MovementZone } from '@/game/type/MovementZone';
import { SpeedType } from '@/game/type/SpeedType';
import { LocomotorType } from '@/game/type/LocomotorType';

interface GameObject {
    tile: Tile;
    rules: {
        movementZone: MovementZone;
        airportBound?: boolean;
        balloonHover?: boolean;
        hoverAttack?: boolean;
        locomotor?: LocomotorType;
        undeploysInto?: unknown;
    };
    isInfantry(): boolean;
    isBuilding(): boolean;
    isUnit(): boolean;
    moveTrait?: { isMoving(): boolean };
}

interface Tile {
    rx: number;
    ry: number;
    z: number;
    onBridgeLandType?: boolean;
}

interface Bridge {
    isHighBridge(): boolean;
    tileElevation?: number;
}

interface GameMap {
    tiles: {
        getByMapCoords(rx: number, ry: number): Tile | undefined;
    };
    mapBounds: {
        isWithinBounds(tile: Tile): boolean;
    };
    tileOccupation: {
        getBridgeOnTile(tile: Tile): Bridge | undefined;
        getGroundObjectsOnTile(tile: Tile): any[];
    };
    terrain: {
        getPassableSpeed(tile: Tile, speedType: SpeedType, param3: boolean, param4: boolean): boolean;
    };
}

interface Cluster {
    objects: Set<GameObject>;
}

export class MovePositionHelper {
    private map: GameMap;

    constructor(map: GameMap) {
        this.map = map;
    }

    findPositions(
        objects: GameObject[],
        targetTile: Tile,
        sourceBridge: Bridge | undefined,
        isSpecialCondition: boolean,
    ): Map<GameObject, Tile> {
        const tileAssignments = new Map<Tile, GameObject[]>();
        const clusters = this.clusterObjects(objects);
        if (!clusters.length) {
            throw new Error('We should have found at least one cluster');
        }
        const largestCluster = clusters.reduce(
            (largest, current) => (current.objects.size > largest.objects.size ? current : largest),
            clusters[0],
        );
        clusters.splice(clusters.indexOf(largestCluster), 1);
        const unplacedObjects: GameObject[] = [];
        const centerTile = this.findCenterTile([...largestCluster.objects]);
        largestCluster.objects.forEach((obj) => {
            const candidateTile = this.map.tiles.getByMapCoords(
                targetTile.rx + obj.tile.rx - centerTile.rx,
                targetTile.ry + obj.tile.ry - centerTile.ry,
            );
            const bridge = candidateTile?.onBridgeLandType
                ? this.map.tileOccupation.getBridgeOnTile(candidateTile)
                : undefined;
            if (
                !this.shouldStackObject(obj) &&
                candidateTile &&
                this.map.mapBounds.isWithinBounds(candidateTile) &&
                this.tileHasRoom(candidateTile, obj, tileAssignments.get(candidateTile)) &&
                (obj.rules.movementZone === MovementZone.Fly
                    ? obj.rules.airportBound ||
                      (isSpecialCondition && obj.rules.balloonHover && !obj.rules.hoverAttack) ||
                      this.map.terrain.getPassableSpeed(candidateTile, SpeedType.Amphibious, false, !!bridge)
                    : this.isEligibleTile(candidateTile, bridge, sourceBridge, targetTile))
            ) {
                let assignedObjects = tileAssignments.get(candidateTile);
                if (assignedObjects === undefined) {
                    assignedObjects = [];
                    tileAssignments.set(candidateTile, assignedObjects);
                }
                assignedObjects.push(obj);
            } else {
                unplacedObjects.push(obj);
            }
        });
        clusters.forEach((cluster) => {
            unplacedObjects.push(...cluster.objects);
        });
        const tileFinder = new RadialTileFinder(
            this.map.tiles as any,
            this.map.mapBounds as any,
            targetTile as any,
            { width: 1, height: 1 },
            0,
            5,
            () => true,
        );
        let nextTile: Tile | undefined = tileFinder.getNextTile() as any;
        while (unplacedObjects.length && nextTile) {
            const obj = unplacedObjects[0];
            const bridge = this.map.tileOccupation.getBridgeOnTile(nextTile);
            if (
                this.tileHasRoom(nextTile, obj, tileAssignments.get(nextTile)) &&
                (obj.rules.movementZone === MovementZone.Fly
                    ? obj.rules.airportBound ||
                      this.map.terrain.getPassableSpeed(nextTile, SpeedType.Amphibious, false, !!bridge)
                    : this.isEligibleTile(nextTile, bridge, sourceBridge, targetTile))
            ) {
                let assignedObjects = tileAssignments.get(nextTile);
                if (assignedObjects === undefined) {
                    assignedObjects = [];
                    tileAssignments.set(nextTile, assignedObjects);
                }
                assignedObjects.push(unplacedObjects.shift()!);
            } else {
                nextTile = tileFinder.getNextTile() as any;
            }
        }
        const result = new Map<GameObject, Tile>();
        tileAssignments.forEach((assigned, tile) => {
            assigned.forEach((obj) => result.set(obj, tile));
        });
        unplacedObjects.forEach((obj) => result.set(obj, targetTile));
        if (result.size !== objects.length) {
            throw new Error('We should have computed a number of positions equal to the number of input objects');
        }
        return result;
    }

    shouldStackObject(obj: GameObject): boolean {
        return (
            obj.isBuilding() ||
            (obj.isUnit() &&
                !!obj.moveTrait.isMoving() &&
                obj.rules.movementZone === MovementZone.Fly &&
                obj.rules.locomotor === LocomotorType.Jumpjet)
        );
    }

    private tileHasRoom(
        tile: Tile,
        obj: GameObject,
        existingObjects: GameObject[] | undefined,
    ): boolean {
        if (obj.isBuilding()) {
            return (
                !!obj.rules.undeploysInto ||
                !this.map.tileOccupation
                    .getGroundObjectsOnTile(tile)
                    .some(
                        (e: any) =>
                            e.isTerrain() || e.isTechno() || (e.isOverlay() && e.wallTrait),
                    )
            );
        }
        if (!existingObjects) {
            return true;
        }
        if (this.shouldStackObject(obj)) {
            return existingObjects.length < 3;
        }
        if (obj.isInfantry()) {
            if (existingObjects.find((existing) => !existing.isInfantry())) {
                return false;
            }
            const maxInfantry = obj.rules.movementZone === MovementZone.Fly ? 1 : 3;
            return existingObjects.filter((existing) => existing.isInfantry()).length < maxInfantry;
        }
        return !existingObjects.length;
    }

    public isEligibleTile(
        tile: Tile,
        tileBridge: Bridge | undefined,
        sourceBridge: Bridge | undefined,
        targetTile: Tile,
    ): boolean {
        if (sourceBridge?.isHighBridge() || tileBridge?.isHighBridge()) {
            return (
                tile.z + (tileBridge?.tileElevation ?? 0) ===
                targetTile.z + (sourceBridge?.tileElevation ?? 0)
            );
        }
        return !(!sourceBridge && !tileBridge) || Math.abs(tile.z - targetTile.z) < 2;
    }

    private clusterObjects(objects: GameObject[]): Cluster[] {
        const tileGroups = new Map<string, GameObject[]>();
        objects.forEach((obj) => {
            const key = `${obj.tile.rx}_${obj.tile.ry}`;
            tileGroups.set(key, [...(tileGroups.get(key) || []), obj]);
        });
        const clusters: Cluster[] = [];
        const remaining = new Set(objects);
        while (remaining.size) {
            const cluster = new Set<GameObject>();
            const queue: GameObject[] = [];
            const startTile = [...remaining][0].tile;
            tileGroups.get(`${startTile.rx}_${startTile.ry}`)!.forEach((obj) => {
                queue.push(obj);
            });
            while (queue.length) {
                const obj = queue.shift()!;
                cluster.add(obj);
                remaining.delete(obj);
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx || dy) {
                            const adjacentObjects = tileGroups.get(
                                `${obj.tile.rx + dx}_${obj.tile.ry + dy}`,
                            );
                            if (adjacentObjects && adjacentObjects.length) {
                                adjacentObjects.forEach((adjacent) => {
                                    if (remaining.has(adjacent)) {
                                        remaining.delete(adjacent);
                                        queue.push(adjacent);
                                    }
                                });
                            }
                        }
                    }
                }
            }
            clusters.push({ objects: cluster });
        }
        return clusters;
    }

    private findCenterTile(objects: GameObject[]): Tile {
        let totalRx = 0;
        let totalRy = 0;
        objects.forEach((obj) => {
            totalRx += obj.tile.rx;
            totalRy += obj.tile.ry;
        });
        const centerRx = Math.round(totalRx / objects.length);
        const centerRy = Math.round(totalRy / objects.length);
        let centerTile = this.map.tiles.getByMapCoords(centerRx, centerRy);
        if (!centerTile) {
            centerTile = objects.find(
                (obj) =>
                    Math.abs(obj.tile.rx - centerRx) <= 1 && Math.abs(obj.tile.ry - centerRy) <= 1,
            )?.tile;
            if (!centerTile) {
                throw new Error('At least one adjacent object should have been found');
            }
        }
        return centerTile;
    }
}
