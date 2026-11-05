import { OreOverlayTypes } from './OreOverlayTypes';
import { TiberiumType } from '@/engine/type/TiberiumType';
interface Tile {
    dx: number;
    dy: number;
}
export class OreSpread {
    static calculateOverlayId(type: TiberiumType, tile: Tile): number | undefined {
        let x = tile.dx;
        const y = tile.dy;
        x = Math.floor((((((y - 9) / 2) % 12) * (((y - 8) / 2) % 12)) % 12) -
            (((((x - 13) / 2) % 12) * (((x - 12) / 2) % 12)) % 12) +
            120000);
        x %= 12;
        return type === TiberiumType.Riparius
            ? OreOverlayTypes.minIdRiparius + x
            : type === TiberiumType.Cruentus
                ? OreOverlayTypes.minIdCruentus + x
                : type === TiberiumType.Vinifera
                    ? OreOverlayTypes.minIdVinifera + x
                    : type === TiberiumType.Aboreus
                        ? OreOverlayTypes.minIdAboreus + x
                        : undefined;
    }
}
