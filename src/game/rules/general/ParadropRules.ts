import { SideType } from '../../SideType';
interface ParadropSquad {
    inf: string;
    num: number;
}
export class ParadropRules {
    private allyParaDrop: ParadropSquad[] = [];
    private amerParaDrop: ParadropSquad[] = [];
    private sovParaDrop: ParadropSquad[] = [];
    private yuriParaDrop: ParadropSquad[] = [];
    private paradropPlane: string = '';
    private paradropRadius: number = 0;
    readIni(ini: any): ParadropRules {
        this.allyParaDrop = this.readParadropSquad(ini.getArray("AllyParaDropInf"), ini.getNumberArray("AllyParaDropNum"), "Ally");
        this.amerParaDrop = this.readParadropSquad(ini.getArray("AmerParaDropInf"), ini.getNumberArray("AmerParaDropNum"), "Amer");
        this.sovParaDrop = this.readParadropSquad(ini.getArray("SovParaDropInf"), ini.getNumberArray("SovParaDropNum"), "Sov");
        this.yuriParaDrop = this.readParadropSquad(ini.getArray("YuriParaDropInf"), ini.getNumberArray("YuriParaDropNum"), "Yuri");
        this.paradropPlane = ini.getString("ParadropPlane");
        if (!this.paradropPlane) {
            throw new Error("Missing rules [General]->ParadropPlane");
        }
        this.paradropRadius = ini.getNumber("ParadropRadius");
        return this;
    }
    private readParadropSquad(infArray: string[], numArray: number[], side: string): ParadropSquad[] {
        if (infArray.length !== numArray.length) {
            throw new RangeError(`${side}ParaDropInf/Num size mismatch (${infArray.length}, ${numArray.length})`);
        }
        const squads: ParadropSquad[] = [];
        for (let i = 0; i < infArray.length; ++i) {
            if (numArray[i] > 0) {
                squads.push({ inf: infArray[i], num: numArray[i] });
            }
        }
        return squads;
    }
    getParadropSquads(side: SideType): ParadropSquad[] {
        switch (side) {
            case SideType.GDI:
                return this.allyParaDrop;
            case SideType.Nod:
                return this.sovParaDrop;
            case SideType.ThirdSide:
                return this.yuriParaDrop;
            default:
                throw new Error(`Unhandled side type "${side}"`);
        }
    }
}
