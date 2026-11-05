import { Coords } from './Coords';
import { LandType } from './type/LandType';

export class Target {
    private tileOccupation: any;
    private isOre: boolean;
    private bridge?: any;
    public tile: any;
    public obj?: any;
    constructor(obj: any, tile: any, tileOccupation: any) {
        this.tileOccupation = tileOccupation;
        this.isOre = false;
        if (obj) {
            if (obj.isOverlay() && obj.isBridge()) {
                this.bridge = obj;
                this.tile = tile;
            }
            else if (obj.isOverlay() && obj.isTiberium()) {
                this.isOre = true;
                this.tile = obj.tile;
            }
            else {
                this.obj = obj;
                this.tile = obj.isBuilding() ? obj.centerTile : obj.tile;
            }
        }
        else {
            if (tile.landType === LandType.Tiberium) {
                this.isOre = true;
            }
            this.tile = tile;
        }
    }
    equals(other: Target): boolean {
        return (this.obj === other.obj &&
            this.tile === other.tile &&
            this.bridge === other.bridge &&
            this.isOre === other.isOre);
    }
    getWorldCoords() {
        return this.obj
            ? this.obj.position.worldPosition
            : Coords.tile3dToWorld(this.tile.rx + 0.5, this.tile.ry + 0.5, this.tile.z + (this.bridge?.tileElevation ?? 0));
    }
    isBridge(): boolean {
        return !this.obj && !!this.bridge;
    }
    getBridge() {
        return (this.bridge ||
            (this.obj?.isUnit() && this.obj.onBridge
                ? this.tileOccupation.getBridgeOnTile(this.obj.tile)
                : undefined));
    }
}
