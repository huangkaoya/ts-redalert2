import type { IniSection } from '../../data/IniSection';
export class MpDialogSettings {
    public minMoney!: number;
    public money!: number;
    public maxMoney!: number;
    public moneyIncrement!: number;
    public minUnitCount!: number;
    public unitCount!: number;
    public maxUnitCount!: number;
    public crates!: boolean;
    public gameSpeed!: number;
    public mcvRedeploys!: boolean;
    public shortGame!: boolean;
    public superWeapons!: boolean;
    public techLevel!: number;
    public alliesAllowed!: boolean;
    public allyChangeAllowed!: boolean;
    public mustAlly!: boolean;
    public bridgeDestruction!: boolean;
    public multiEngineer!: boolean;
    readIni(section: IniSection): this {
        this.minMoney = section.getNumber("MinMoney");
        this.money = section.getNumber("Money");
        this.maxMoney = section.getNumber("MaxMoney");
        this.moneyIncrement = section.getNumber("MoneyIncrement");
        this.minUnitCount = section.getNumber("MinUnitCount");
        this.unitCount = section.getNumber("UnitCount");
        this.maxUnitCount = section.getNumber("MaxUnitCount");
        this.crates = section.getBool("Crates");
        this.gameSpeed = section.getNumber("GameSpeed");
        this.mcvRedeploys = section.getBool("MCVRedeploys");
        this.shortGame = section.getBool("ShortGame");
        this.superWeapons = section.getBool("SuperWeapons");
        this.techLevel = section.getNumber("TechLevel");
        this.alliesAllowed = section.getBool("AlliesAllowed", true);
        this.allyChangeAllowed = section.getBool("AllyChangeAllowed", true);
        this.mustAlly = section.getBool("MustAlly");
        this.bridgeDestruction = section.getBool("BridgeDestruction", true);
        this.multiEngineer = section.getBool("MultiEngineer");
        return this;
    }
}
