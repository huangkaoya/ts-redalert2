import { PaletteType } from "@/engine/type/PaletteType";
import { ObjectType } from "@/engine/type/ObjectType";
import { Coords } from "@/game/Coords";
import { SequenceReader } from "@/game/art/SequenceReader";
import { LightingType } from "@/engine/type/LightingType";
import { LandType } from "@/game/type/LandType";
import { OverlayRules } from "@/game/rules/OverlayRules";
import { TechnoRules } from "@/game/rules/TechnoRules";
import { TerrainRules } from "@/game/rules/TerrainRules";
import { ProjectileRules } from "@/game/rules/ProjectileRules";
import { FlhCoords } from "@/game/art/FlhCoords";
import { Vector2 } from "@/game/math/Vector2";
import { Vector3 } from "@/game/math/Vector3";
import { SequenceType } from "@/game/art/SequenceType";
interface ArtSection {
    getString(key: string, defaultValue?: string): string | undefined;
    getBool(key: string, defaultValue?: boolean): boolean;
    getNumber(key: string, defaultValue?: number): number;
    getNumberArray(key: string, separator?: RegExp, defaultValue?: number[]): number[];
    getArray(key: string): string[];
    has(key: string): boolean;
}
interface RulesBase {
    imageName: string;
    alternateArcticArt?: boolean;
    noShadow?: boolean;
}
interface BuildingRules extends RulesBase {
    numberOfDocks: number;
}
interface IniSection {
}
interface Rotor {
    name: string;
    axis: Vector3;
    speed?: number;
    idleSpeed?: number;
}
interface MuzzleFlash {
    x: number;
    y: number;
}
interface Foundation {
    width: number;
    height: number;
}
export class ObjectArt {
    public static readonly DEFAULT_LINE_TRAIL_DEC = 16;
    private static readonly MISSING_CAMEO = "xxicon";
    public sequences: Map<SequenceType, any> = new Map();
    public dockingOffsets: Vector3[] = [];
    public type: ObjectType;
    public rules: RulesBase;
    public art: ArtSection;
    public image: string = "";
    public report?: string;
    public rotors?: Rotor[];
    public noHva: boolean = false;
    public startSound?: string;
    public muzzleFlash?: MuzzleFlash[];
    public paletteType: PaletteType = PaletteType.Default;
    public lightingType: LightingType = LightingType.Default;
    public customPaletteName?: string;
    public remapable: boolean = false;
    public flat: boolean = false;
    public queueingCell?: Vector2;
    public demandLoad: boolean = false;
    public useLineTrail: boolean = false;
    public lineTrailColor: number[] = [];
    public lineTrailColorDecrement: number = ObjectArt.DEFAULT_LINE_TRAIL_DEC;
    public crater: boolean = false;
    public forceBigCraters: boolean = false;
    public scorch: boolean = false;
    public height: number = 0;
    public isVoxel: boolean = false;
    public occupyHeight: number = 0;
    public canHideThings: boolean = false;
    public canBeHidden: boolean = true;
    public addOccupy: Vector2[] = [];
    public removeOccupy: Vector2[] = [];
    public rotates: boolean = false;
    public toOverlay?: string;
    static getDefaultPalette(objectType: ObjectType): PaletteType {
        switch (objectType) {
            case ObjectType.Building:
            case ObjectType.Aircraft:
            case ObjectType.Infantry:
            case ObjectType.Vehicle:
            case ObjectType.Projectile:
            case ObjectType.VoxelAnim:
                return PaletteType.Unit;
            case ObjectType.Overlay:
                return PaletteType.Overlay;
            case ObjectType.Smudge:
            case ObjectType.Terrain:
                return PaletteType.Iso;
            default:
                ObjectType.Animation;
                return PaletteType.Anim;
        }
    }
    static getDefaultLighting(objectType: ObjectType): LightingType {
        switch (objectType) {
            case ObjectType.Animation:
                return LightingType.None;
            case ObjectType.Aircraft:
            case ObjectType.Building:
            case ObjectType.Infantry:
            case ObjectType.Vehicle:
                return LightingType.Ambient;
            case ObjectType.Projectile:
            case ObjectType.VoxelAnim:
                return LightingType.Global;
            case ObjectType.Overlay:
            case ObjectType.Smudge:
            case ObjectType.Terrain:
            default:
                return LightingType.Full;
        }
    }
    static getDefaultRemapability(objectType: ObjectType): boolean {
        switch (objectType) {
            case ObjectType.Aircraft:
            case ObjectType.Building:
            case ObjectType.Infantry:
            case ObjectType.Vehicle:
                return true;
            case ObjectType.Overlay:
            case ObjectType.Smudge:
            case ObjectType.Terrain:
            case ObjectType.Animation:
            case ObjectType.Projectile:
            case ObjectType.VoxelAnim:
                return false;
            default:
                throw new Error("Unknown object type " + objectType);
        }
    }
    static getDefaultDrawOffset(objectType: ObjectType): Vector2 {
        switch (objectType) {
            case ObjectType.Animation:
            case ObjectType.Building:
            case ObjectType.Vehicle:
            case ObjectType.Infantry:
            case ObjectType.Overlay:
            case ObjectType.Smudge:
            case ObjectType.Projectile:
            case ObjectType.VoxelAnim:
                return new Vector2(0, 0);
            case ObjectType.Terrain:
            case ObjectType.Aircraft:
                return new Vector2(0, (Coords.ISO_TILE_SIZE + 1) / 2);
            default:
                throw new Error("Unknown object type " + objectType);
        }
    }
    static getDefaultShadow(objectType: ObjectType): boolean {
        switch (objectType) {
            case ObjectType.Overlay:
            case ObjectType.Building:
            case ObjectType.Infantry:
            case ObjectType.Terrain:
            case ObjectType.Vehicle:
            case ObjectType.Aircraft:
                return true;
            default:
            case ObjectType.Smudge:
            case ObjectType.Animation:
            case ObjectType.Projectile:
            case ObjectType.VoxelAnim:
                return false;
        }
    }
    static getDefaultHeight(objectType: ObjectType): number {
        switch (objectType) {
            case ObjectType.Building:
                return 2;
            case ObjectType.Infantry:
            case ObjectType.Vehicle:
            case ObjectType.Aircraft:
                return 1;
            default:
                return 0;
        }
    }
    static factory(objectType: ObjectType, rules: RulesBase, iniData: any, art: ArtSection): ObjectArt {
        const result = new this(objectType, rules, art);
        if (objectType === ObjectType.Infantry) {
            const sequenceName = art.getString("Sequence");
            if (sequenceName) {
                const sequenceSection = iniData.getSection(sequenceName);
                if (sequenceSection) {
                    result.sequences = new SequenceReader().readIni(sequenceSection);
                }
            }
        }
        return result;
    }
    constructor(objectType: ObjectType, rules: RulesBase, art: ArtSection) {
        this.type = objectType;
        this.rules = rules;
        this.art = art;
        this.init();
    }
    private init(): void {
        this.image = [ObjectType.Infantry, ObjectType.Vehicle, ObjectType.Aircraft].includes(this.type)
            ? ""
            : this.art.getString("Image");
        this.report = this.art.getString("Report") || undefined;
        this.readRotors();
        this.noHva = this.art.getBool("NoHVA", false);
        this.startSound = this.art.getString("StartSound") || undefined;
        this.readMuzzleFlash();
        this.readPaletteAndLightingTypes();
        this.readRemapability();
        this.readFlatness();
        this.readDockingOffsets();
        const queueingCellArray = this.art.getNumberArray("QueueingCell");
        this.queueingCell = queueingCellArray.length
            ? new Vector2(queueingCellArray[0], queueingCellArray[1])
            : undefined;
        this.demandLoad = this.art.getBool("DemandLoad", false);
        const useLineTrail = this.art.getBool("UseLineTrail", false);
        const lineTrailColorArray = this.art.getNumberArray("LineTrailColor");
        const lineTrailColorDecrement = this.art.getNumber("LineTrailColorDecrement", ObjectArt.DEFAULT_LINE_TRAIL_DEC);
        if (useLineTrail && lineTrailColorArray.length) {
            this.useLineTrail = true;
            this.lineTrailColor = lineTrailColorArray;
            this.lineTrailColorDecrement = lineTrailColorDecrement;
        }
        else {
            this.useLineTrail = false;
        }
        this.crater = this.art.getBool("Crater", false);
        this.forceBigCraters = this.art.getBool("ForceBigCraters", false);
        this.scorch = this.art.getBool("Scorch", false);
        this.height = this.art.getNumber("Height", ObjectArt.getDefaultHeight(this.type));
        this.isVoxel = this.art.getBool("Voxel", false);
        this.occupyHeight = this.art.getNumber("OccupyHeight", this.height);
        if (this.type === ObjectType.Building) {
            this.canHideThings = this.art.getBool("CanHideThings", true);
        }
        else {
            this.canHideThings = false;
        }
        this.canBeHidden = this.art.getBool("CanBeHidden", true);
        this.addOccupy = this.readAddRemoveOccupy("AddOccupy");
        this.removeOccupy = this.readAddRemoveOccupy("RemoveOccupy");
        this.rotates = this.art.getBool("Rotates", false);
        this.toOverlay = this.art.getString("ToOverlay") || undefined;
    }
    get imageName(): string {
        return (this.image || this.rules.imageName) + (this.rules.alternateArcticArt ? "A" : "");
    }
    get cameo(): string {
        const cameo = this.art.getString("Cameo") || ObjectArt.MISSING_CAMEO;
        return cameo.toLowerCase();
    }
    get altCameo(): string {
        const altCameo = this.art.getString("AltCameo") || this.cameo;
        return altCameo.toLowerCase();
    }
    get useTheaterExtension(): boolean {
        return this.art.getBool("Theater", false);
    }
    private readPaletteAndLightingTypes(): void {
        this.paletteType = PaletteType.Default;
        this.lightingType = LightingType.Default;
        if (this.rules instanceof OverlayRules && (this.rules as any).noUseTileLandType) {
            this.paletteType = PaletteType.Iso;
            this.lightingType = LightingType.Full;
        }
        if (this.art.getBool("TerrainPalette", false) || this.art.getBool("ShouldUseCellDrawer", false)) {
            this.paletteType = PaletteType.Iso;
        }
        else if (this.art.getBool("AnimPalette", false)) {
            this.paletteType = PaletteType.Anim;
            this.lightingType = LightingType.None;
        }
        else if (this.art.getString("Palette")) {
            this.paletteType = PaletteType.Custom;
            this.customPaletteName = this.art.getString("Palette");
        }
        if (this.art.getBool("AltPalette", false)) {
            this.paletteType = PaletteType.Unit;
        }
        if ((this.rules instanceof OverlayRules || this.rules instanceof TechnoRules) && (this.rules as any).wall) {
            this.paletteType = PaletteType.Unit;
            this.lightingType = LightingType.Ambient;
        }
        if ((this.rules instanceof TerrainRules || this.rules instanceof TechnoRules) && (this.rules as any).gate) {
            this.paletteType = PaletteType.Unit;
        }
        if (this.rules instanceof TerrainRules && (this.rules as any).spawnsTiberium) {
            this.paletteType = PaletteType.Unit;
            this.lightingType = LightingType.None;
        }
        if (this.rules instanceof OverlayRules) {
            const overlayRules = this.rules as any;
            if (overlayRules.isVeins) {
                this.paletteType = PaletteType.Unit;
                this.lightingType = LightingType.None;
            }
            if (overlayRules.isVeinholeMonster) {
                this.paletteType = PaletteType.Unit;
                this.lightingType = LightingType.None;
            }
            if (overlayRules.tiberium) {
                this.lightingType = LightingType.None;
            }
            if (overlayRules.land === LandType.Railroad) {
                this.paletteType = PaletteType.Iso;
                this.lightingType = LightingType.Full;
            }
            if (overlayRules.crate) {
                this.paletteType = PaletteType.Iso;
                this.lightingType = LightingType.Full;
            }
        }
        if (this.paletteType === PaletteType.Default) {
            this.paletteType = ObjectArt.getDefaultPalette(this.type);
        }
        if (this.lightingType === LightingType.Default) {
            this.lightingType = ObjectArt.getDefaultLighting(this.type);
        }
    }
    private readRemapability(): void {
        this.remapable = ObjectArt.getDefaultRemapability(this.type);
        if (this.art.getBool("TerrainPalette", false) || this.art.getBool("AnimPalette", false)) {
            this.remapable = false;
        }
        else if (this.rules instanceof ProjectileRules && (this.rules as any).firersPalette) {
            this.remapable = true;
        }
    }
    private readFlatness(): void {
        let flat = false;
        if (this.type === ObjectType.Building || this.type === ObjectType.Animation) {
            flat = this.art.getBool("Flat");
        }
        else if (this.type === ObjectType.Smudge) {
            flat = true;
        }
        // 完善模拟层逻辑：OverlayRules sets flat=true unless wall/crate/isARock
        // (wall || crate || isARock || (flat = true)).
        if (this.rules instanceof OverlayRules) {
            const overlayRules = this.rules as any;
            if (!(overlayRules.wall || overlayRules.crate || overlayRules.isARock)) {
                flat = true;
            }
        }
        this.flat = flat;
    }
    private readRotors(): void {
        const rotorNames = this.art.getArray("Rotors");
        if (rotorNames.length) {
            const rotors: Rotor[] = [];
            for (let i = 0; i < rotorNames.length; ++i) {
                const axisArray = this.art.getNumberArray(`Rotor${i + 1}Axis`, undefined, [0, 1, 0]);
                const axis = new Vector3(-axisArray[2], -axisArray[0], axisArray[1]).normalize();
                rotors.push({
                    name: rotorNames[i],
                    axis: axis,
                    speed: this.art.getNumber(`Rotor${i + 1}Rate`),
                    idleSpeed: this.art.getNumber(`Rotor${i + 1}IdleRate`)
                });
            }
            if (rotors.length) {
                this.rotors = rotors;
            }
        }
    }
    private readMuzzleFlash(): void {
        let index = 0;
        let key = "MuzzleFlash" + index;
        const muzzleFlashes: MuzzleFlash[] = [];
        while (this.art.has(key)) {
            const [x, y] = this.art.getNumberArray(key);
            muzzleFlashes.push({ x, y });
            index++;
            key = "MuzzleFlash" + index;
        }
        this.muzzleFlash = muzzleFlashes.length ? muzzleFlashes : undefined;
    }
    private readDockingOffsets(): void {
        if (this.type === ObjectType.Building) {
            const numberOfDocks = (this.rules as BuildingRules).numberOfDocks;
            for (let i = 0; i < numberOfDocks; i++) {
                const [x, y, z] = this.art.getNumberArray("DockingOffset" + i, /,\s*/, [0, 0, 0]);
                this.dockingOffsets.push(new Vector3(x, z, y));
            }
        }
    }
    private readAddRemoveOccupy(prefix: string): Vector2[] {
        let index = 0;
        const result: Vector2[] = [];
        while (true) {
            const coords = this.art.getNumberArray(prefix + (++index));
            if (!coords.length)
                break;
            result.push(new Vector2(coords[0], coords[1]));
        }
        return result;
    }
    get bibShape(): string | undefined {
        return this.art.getString("BibShape");
    }
    get foundation(): Foundation {
        const foundationStr = this.art.getString("Foundation", "1x1")!;
        const [widthStr, heightStr] = foundationStr.split("x");
        return {
            width: parseInt(widthStr, 10),
            height: parseInt(heightStr, 10)
        };
    }
    get foundationCenter(): Vector2 {
        return new Vector2(Math.floor(this.foundation.width / 2 - 0.5), Math.floor(this.foundation.height / 2 - 0.5));
    }
    getDrawOffset(): Vector2 {
        if (this.rules instanceof TerrainRules && (this.rules as any).spawnsTiberium) {
            return new Vector2(0, 0);
        }
        const defaultOffset = ObjectArt.getDefaultDrawOffset(this.type);
        if (this.rules instanceof OverlayRules && (this.rules as any).isARock) {
            defaultOffset.y += (Coords.ISO_TILE_SIZE + 1) / 2;
        }
        return defaultOffset;
    }
    get hasShadow(): boolean {
        return this.art.getBool("Shadow", ObjectArt.getDefaultShadow(this.type)) && !this.rules.noShadow;
    }
    get turretOffset(): number {
        return this.art.getNumber("TurretOffset", 0);
    }
    get facings(): number {
        return this.art.getNumber("Facings", 8);
    }
    get walkFrames(): number {
        return this.art.getNumber("WalkFrames", 0);
    }
    get firingFrames(): number {
        return this.art.getNumber("FiringFrames", 0);
    }
    get standingFrames(): number {
        return this.art.getNumber("StandingFrames", 1);
    }
    get startWalkFrame(): number {
        return this.art.getNumber("StartWalkFrame", 0);
    }
    get startStandFrame(): number {
        return this.art.getNumber("StartStandFrame", this.walkFrames * this.facings);
    }
    get startFiringFrame(): number {
        return this.art.getNumber("StartFiringFrame", (this.walkFrames + this.standingFrames) * this.facings);
    }
    get isFlamingGuy(): boolean {
        return this.art.getBool("IsFlamingGuy", false);
    }
    get runningFrames(): number {
        return this.art.getNumber("RunningFrames", 0);
    }
    get crawls(): boolean {
        return this.art.getBool("Crawls", true);
    }
    get primaryFireFlh(): FlhCoords {
        return new FlhCoords(this.art.getNumberArray("PrimaryFireFLH"));
    }
    get elitePrimaryFireFlh(): FlhCoords {
        const eliteArray = this.art.getNumberArray("ElitePrimaryFireFLH");
        return eliteArray.length ? new FlhCoords(eliteArray) : this.primaryFireFlh;
    }
    get primaryFirePixelOffset(): number[] {
        return this.art.getNumberArray("PrimaryFirePixelOffset");
    }
    get secondaryFirePixelOffset(): number[] {
        return this.art.getNumberArray("SecondaryFirePixelOffset");
    }
    get secondaryFireFlh(): FlhCoords {
        return new FlhCoords(this.art.getNumberArray("SecondaryFireFLH"));
    }
    get eliteSecondaryFireFlh(): FlhCoords {
        const eliteArray = this.art.getNumberArray("EliteSecondaryFireFLH");
        return eliteArray.length ? new FlhCoords(eliteArray) : this.secondaryFireFlh;
    }
    getSpecialWeaponFlh(weaponIndex: number): FlhCoords {
        return new FlhCoords(this.art.getNumberArray(`Weapon${weaponIndex + 1}FLH`));
    }
    get fireUp(): number {
        return this.art.getNumber("FireUp", 0) || this.art.getNumber("DelayedFireDelay", 0);
    }
    get isAnimDelayedFire(): boolean {
        return this.art.getBool("IsAnimDelayedFire", false);
    }
    get zShapePointMove(): number[] {
        return this.art.getNumberArray("ZShapePointMove");
    }
    get zAdjust(): number {
        return this.art.getNumber("ZAdjust", 0);
    }
    get trailer(): string | undefined {
        return this.art.getString("Trailer");
    }
    get spawnDelay(): number {
        return this.art.getNumber("SpawnDelay", 1);
    }
    get translucent(): boolean {
        return this.art.getBool("Translucent", false);
    }
    get translucency(): number {
        let translucency = this.art.getNumber("Translucency", 0);
        translucency = (Math.floor(translucency / 25) * 25) / 100;
        return translucency;
    }
}
