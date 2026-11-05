import { ObjectType } from "@/engine/type/ObjectType";
export class ObjectRules {
    static readonly IMAGE_NONE = "none";
    public type: ObjectType;
    protected ini: any;
    public index: number;
    protected generalRules: any;
    private alphaImage?: string;
    private alternateArcticArt: boolean = false;
    private crushable: boolean = false;
    private crushSound?: string;
    private dontScore: boolean = false;
    private insignificant: boolean = false;
    private legalTarget: boolean = true;
    private noShadow: boolean = false;
    private uiName: string = "";
    static iniSpeedToLeptonsPerTick(speed: number, frameRate: number): number {
        return Math.min(256, (256 * speed) / frameRate);
    }
    static iniRotToDegsPerTick(rotation: number): number {
        return (rotation / 256) * 360;
    }
    constructor(type: ObjectType, ini: any, index: number = -1, generalRules?: any) {
        this.type = type;
        this.ini = ini;
        this.index = index;
        this.generalRules = generalRules;
        this.parse();
    }
    protected parse(): void {
        this.alphaImage = this.ini.getString("AlphaImage") || undefined;
        this.alternateArcticArt = this.ini.getBool("AlternateArcticArt");
        this.crushable = this.ini.getBool("Crushable", this.type === ObjectType.Infantry);
        this.crushSound = this.ini.getString("CrushSound") || undefined;
        this.dontScore = this.ini.getBool("DontScore");
        this.insignificant = this.ini.getBool("Insignificant");
        this.legalTarget = this.ini.getBool("LegalTarget", true);
        this.noShadow = this.ini.getBool("NoShadow");
        this.uiName = this.ini.getString("UIName");
    }
    get name(): string {
        return this.ini.name;
    }
    get imageName(): string {
        let image = this.ini.getString("Image");
        return (image && image !== "null") ? image : this.name;
    }
}
