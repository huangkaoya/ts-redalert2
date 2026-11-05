export class TiberiumRules {
    public type: number;
    public value!: number;
    constructor(type: number) {
        this.type = type;
    }
    readIni(ini: any): this {
        this.value = ini.getNumber("Value");
        return this;
    }
}
