import { SideType } from "@/game/SideType";
const sideMap = new Map<string, SideType>()
    .set("GDI", SideType.GDI)
    .set("Nod", SideType.Nod)
    .set("Civilian", SideType.Civilian)
    .set("Mutant", SideType.Mutant)
    .set("ThirdSide", SideType.ThirdSide);
const tooltipMap = new Map<string, string>([
    ["Americans", "STT:PlayerSideAmerica"],
    ["Alliance", "STT:PlayerSideKorea"],
    ["French", "STT:PlayerSideFrance"],
    ["Germans", "STT:PlayerSideGermany"],
    ["British", "STT:PlayerSideBritain"],
    ["Africans", "STT:PlayerSideLibya"],
    ["Arabs", "STT:PlayerSideIraq"],
    ["Confederation", "STT:PlayerSideCuba"],
    ["Russians", "STT:PlayerSideRussia"],
    ["YuriCountry", "STT:PlayerSideYuriCountry"],
]);
export class CountryRules {
    private id: string;
    public name!: string;
    public uiName!: string;
    private uiTooltip: string;
    private side: SideType;
    public multiplay: boolean;
    private multiplayPassive: boolean;
    private veteranAircraft: string[];
    private veteranInfantry: string[];
    private veteranUnits: string[];
    constructor(id: string) {
        this.id = id;
    }
    readIni(ini: any): CountryRules {
        this.name = ini.name;
        this.uiName = ini.getString("UIName");
        this.uiTooltip = ini.getString("UITooltip") || tooltipMap.get(this.name);
        const sideStr = ini.getString("Side");
        if (!sideStr) {
            throw new Error(`Missing Side for country "${this.name}"`);
        }
        const side = sideMap.get(sideStr);
        if (side === undefined) {
            throw new Error(`Unknown side "${sideStr}" for country "${this.name}"`);
        }
        this.side = side;
        this.multiplay = ini.getBool("Multiplay");
        this.multiplayPassive = ini.getBool("MultiplayPassive");
        this.veteranAircraft = ini.getArray("VeteranAircraft");
        this.veteranInfantry = ini.getArray("VeteranInfantry");
        this.veteranUnits = ini.getArray("VeteranUnits");
        return this;
    }
}
