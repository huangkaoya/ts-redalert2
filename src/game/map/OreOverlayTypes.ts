import { TiberiumType } from '@/engine/type/TiberiumType';
export class OreOverlayTypes {
    static minIdRiparius = 102;
    static maxIdRiparius = 127;
    static minIdCruentus = 27;
    static maxIdCruentus = 38;
    static minIdVinifera = 127;
    static maxIdVinifera = 146;
    static minIdAboreus = 147;
    static maxIdAboreus = 166;
    static getOverlayTibType(id: number): TiberiumType | undefined {
        return this.isRiparius(id)
            ? TiberiumType.Riparius
            : this.isCruentus(id)
                ? TiberiumType.Cruentus
                : this.isVinifera(id)
                    ? TiberiumType.Vinifera
                    : this.isAboreus(id)
                        ? TiberiumType.Aboreus
                        : undefined;
    }
    static isRiparius(id: number): boolean {
        return id >= this.minIdRiparius && id <= this.maxIdRiparius;
    }
    static isCruentus(id: number): boolean {
        return id >= this.minIdCruentus && id <= this.maxIdCruentus;
    }
    static isVinifera(id: number): boolean {
        return id >= this.minIdVinifera && id <= this.maxIdVinifera;
    }
    static isAboreus(id: number): boolean {
        return id >= this.minIdAboreus && id <= this.maxIdAboreus;
    }
}
