import type { TileSet } from "./TileSet";
import type { TileSetAnim } from "./TileSetAnim";
import type { TmpFile } from "../../data/TmpFile";
import { Coords } from "@/game/Coords";
export class TileSetEntry {
    public owner: TileSet;
    public index: number;
    public files: TmpFile[] = [];
    public animation?: TileSetAnim;
    constructor(owner: TileSet, indexInSet: number) {
        this.owner = owner;
        this.index = indexInSet;
    }
    addFile(file: TmpFile): void {
        this.files.push(file);
    }
    setAnimation(animation: TileSetAnim): void {
        this.animation = animation;
    }
    getAnimation(): TileSetAnim | undefined {
        return this.animation;
    }
    getTmpFile(subTileIndex: number, randomIndexSelector: (min: number, max: number) => number, preferNonDamaged: boolean = false): TmpFile | undefined {
        if (this.files.length) {
            const selected = this.files[randomIndexSelector(0, this.files.length - 1)];
            const image = selected.images[Math.min(subTileIndex, selected.images.length - 1)];
            return (image as any).hasDamagedData
                ? this.files[Math.min(preferNonDamaged ? 1 : 0, this.files.length - 1)]
                : selected;
        }
        return undefined;
    }

    getRelativeTilePositions(): {
        subTile: number;
        rx: number;
        ry: number;
        z: number;
    }[] {
        return this.files[0].images.map(({ x, y, height }, subTile) => ({
            subTile,
            rx: (x + 2 * y) / 2 / Coords.ISO_TILE_SIZE,
            ry: (2 * y - x) / 2 / Coords.ISO_TILE_SIZE,
            z: height,
        }));
    }
}
