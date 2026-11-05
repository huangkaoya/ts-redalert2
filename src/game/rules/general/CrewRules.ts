export class CrewRules {
    public alliedCrew: string = '';
    public alliedSurvivorDivisor: number = 0;
    private crewEscape: number = 0;
    public sovietCrew: string = '';
    public sovietSurvivorDivisor: number = 0;
    private survivorRate: number = 0;
    public thirdCrew: string = '';
    public thirdSurvivorDivisor: number = 0;

    readIni(ini: any): CrewRules {
        this.alliedCrew = ini.getString('AlliedCrew');
        this.alliedSurvivorDivisor = ini.getNumber('AlliedSurvivorDivisor');
        this.crewEscape = ini.getNumber('CrewEscape');
        this.sovietCrew = ini.getString('SovietCrew');
        this.sovietSurvivorDivisor = ini.getNumber('SovietSurvivorDivisor');
        this.survivorRate = ini.getNumber('SurvivorRate');
        this.thirdCrew = ini.getString('ThirdCrew');
        this.thirdSurvivorDivisor = ini.getNumber('ThirdSurvivorDivisor');
        return this;
    }
}
