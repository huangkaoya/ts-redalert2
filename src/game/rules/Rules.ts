import { Color } from "@/util/Color";
import { ObjectType } from "@/engine/type/ObjectType";
import { CountryRules } from "@/game/rules/CountryRules";
import { WeaponRules } from "@/game/rules/WeaponRules";
import { AudioVisualRules } from "@/game/rules/AudioVisualRules";
import { GeneralRules } from "@/game/rules/GeneralRules";
import { MpDialogSettings } from "@/game/rules/MpDialogSettings";
import { LandType } from "@/game/type/LandType";
import { LandRules } from "@/game/rules/LandRules";
import { WarheadRules } from "@/game/rules/WarheadRules";
import { ProjectileRules } from "@/game/rules/ProjectileRules";
import { ObjectRulesFactory } from "@/game/rules/ObjectRulesFactory";
import { CombatDamageRules } from "@/game/rules/CombatDamageRules";
import { TiberiumRules } from "@/game/rules/TiberiumRules";
import { AiRules } from "@/game/rules/AiRules";
import { ElevationModelRules } from "@/game/rules/ElevationModelRules";
import { RadiationRules } from "@/game/rules/RadiationRules";
import { SuperWeaponRules } from "@/game/rules/SuperWeaponRules";
import { CrateRules } from "@/game/rules/CrateRules";
import { PowerupsRules } from "@/game/rules/PowerupsRules";
import { mpAllowedColors } from "@/game/rules/mpAllowedColors";
import { isNotNullOrUndefined } from "@/util/typeGuard";
import { Weapon } from "@/game/Weapon";
interface IniFile {
    getSection(name: string): IniSection | undefined;
    getOrCreateSection(name: string): IniSection;
    getOrderedSections(): IniSection[];
}
interface IniSection {
    name: string;
    entries: Map<string, any>;
}
interface Logger {
    debug(message: string): void;
}
interface ObjectRules {
    deathWeapon?: string;
    primary?: string;
    secondary?: string;
    elitePrimary?: string;
    eliteSecondary?: string;
    occupyWeapon?: string;
    eliteOccupyWeapon?: string;
    weaponCount?: number;
    getWeaponAtIndex(index: number): string;
    getEliteWeaponAtIndex(index: number): string;
}
interface SpecialFlags {
    initialVeteran?: boolean;
}
export class Rules {
    private ini: IniFile;
    private logger?: Logger;
    private buildingTypes = new Map<number, string>();
    private vehicleTypes = new Map<number, string>();
    private infantryTypes = new Map<number, string>();
    private aircraftTypes = new Map<number, string>();
    private terrainTypes = new Map<number, string>();
    private overlayTypes = new Map<number, string>();
    private overlayIdsByType = new Map<string, number>();
    private animationTypes = new Map<number, string>();
    private animationNames = new Set<string>();
    private voxelAnimTypes = new Map<number, string>();
    private smudgeTypes = new Map<number, string>();
    private warheadTypes = new Map<number, string>();
    private tiberiumTypes = new Map<number, string>();
    private superWeaponTypes = new Map<number, string>();
    private countryTypes = new Map<number, string>();
    readonly weaponTypes = new Map<number, string>();
    private allObjectRules = new Map<ObjectType, Map<string, ObjectRules>>();
    readonly buildingRules = new Map<string, ObjectRules>();
    readonly infantryRules = new Map<string, ObjectRules>();
    readonly vehicleRules = new Map<string, ObjectRules>();
    readonly aircraftRules = new Map<string, ObjectRules>();
    readonly terrainRules = new Map<string, ObjectRules>();
    readonly overlayRules = new Map<string, ObjectRules>();
    private smudgeRules = new Map<string, ObjectRules>();
    private voxelAnimRules = new Map<string, ObjectRules>();
    private countryRules = new Map<string, CountryRules>();
    readonly warheadRules = new Map<string, WarheadRules>();
    public powerups = new PowerupsRules();
    public colors = new Map<string, Color>();
    public general = new GeneralRules();
    public ai = new AiRules();
    public crateRules = new CrateRules();
    public elevationModel = new ElevationModelRules();
    public mpDialogSettings = new MpDialogSettings();
    public audioVisual = new AudioVisualRules();
    public combatDamage = new CombatDamageRules();
    public radiation = new RadiationRules();
    private landRules = new Map<LandType, LandRules>();
    private tiberiumRules = new Map<string, TiberiumRules>();
    private superWeaponRules = new Map<string, SuperWeaponRules>();
    private cachedWeaponRules = new Map<string, WeaponRules>();
    private cachedProjectileRules = new Map<string, ProjectileRules>();
    constructor(ini: IniFile, logger?: Logger) {
        this.ini = ini;
        this.logger = logger;
        this.init();
    }
    hasObject(name: string, type: ObjectType): boolean | undefined {
        return this.allObjectRules.get(type)?.has(name);
    }
    getObject(name: string, type: ObjectType): ObjectRules {
        const rules = this.allObjectRules.get(type)?.get(name);
        if (!rules) {
            throw new Error(`Missing rules for object "${name}"`);
        }
        return rules;
    }
    getTechnoByInternalId(id: number, type: ObjectType): ObjectRules {
        let typeName: string | undefined;
        if (type === ObjectType.Building) {
            typeName = this.buildingTypes.get(id);
        }
        else if (type === ObjectType.Infantry) {
            typeName = this.infantryTypes.get(id);
        }
        else if (type === ObjectType.Vehicle) {
            typeName = this.vehicleTypes.get(id);
        }
        else if (type === ObjectType.Aircraft) {
            typeName = this.aircraftTypes.get(id);
        }
        else {
            throw new Error(`Type ${ObjectType[type]} is not a techno type`);
        }
        if (typeName === undefined) {
            throw new Error(`Object type "${ObjectType[type]}" with ID "${id}" not found`);
        }
        return this.getObject(typeName, type);
    }
    getBuilding(name: string): ObjectRules {
        const rules = this.buildingRules.get(name);
        if (!rules) {
            throw new Error(`Missing rules for building "${name}"`);
        }
        return rules;
    }
    getWeapon(name: string): WeaponRules {
        let rules = this.cachedWeaponRules.get(name);
        if (!rules) {
            const section = this.ini.getSection(name);
            if (!section) {
                throw new Error(`Weapon ${name} is missing ini section`);
            }
            rules = new WeaponRules(section);
            this.cachedWeaponRules.set(name, rules);
        }
        return rules;
    }
    getWeaponByInternalId(id: number): WeaponRules {
        const weaponName = this.weaponTypes.get(id);
        if (!weaponName) {
            throw new RangeError(`Weapon with internal ID "${id}" not found`);
        }
        return this.getWeapon(weaponName);
    }
    getWarhead(name: string): WarheadRules {
        const key = name.toLowerCase();
        let rules = this.warheadRules.get(key);
        if (!rules) {
            let section = this.ini.getSection(name);
            if (!section) {
                section = this.ini.getOrderedSections().find((s) => s.name.toLowerCase() === key);
            }
            if (!section) {
                throw new Error("Unknown warhead " + name);
            }
            rules = new WarheadRules(section);
            this.warheadRules.set(key, rules);
        }
        return rules;
    }
    getProjectile(name: string): ProjectileRules {
        let rules = this.cachedProjectileRules.get(name);
        if (!rules) {
            const section = this.ini.getSection(name);
            if (!section) {
                throw new Error(`Projectile ${name} is missing ini section`);
            }
            rules = new ProjectileRules(ObjectType.Projectile, section);
            this.cachedProjectileRules.set(name, rules);
        }
        return rules;
    }
    getOverlayName(id: number): string {
        const name = this.overlayTypes.get(id);
        if (!name) {
            throw new Error("Invalid overlay id " + id);
        }
        return name;
    }
    hasOverlayId(id: number): boolean {
        return this.overlayTypes.has(id);
    }
    getOverlayId(name: string): number {
        const id = this.overlayIdsByType.get(name);
        if (id === undefined) {
            throw new Error("Invalid overlay name " + name);
        }
        return id;
    }
    getOverlay(name: string): ObjectRules {
        const rules = this.overlayRules.get(name);
        if (!rules) {
            throw new Error(`Missing rules for overlay "${name}"`);
        }
        return rules;
    }
    getAnimationName(id: number): string | undefined {
        return this.animationTypes.get(id);
    }
    getCountry(name: string): CountryRules {
        if (!this.countryRules.has(name)) {
            throw new Error("Unknown country " + name);
        }
        return this.countryRules.get(name)!;
    }
    getMultiplayerCountries(): CountryRules[] {
        return [...this.countryRules.values()].filter(country => country.multiplay);
    }
    getMultiplayerColors(): Map<string, Color> {
        const colors = new Map<string, Color>();
        mpAllowedColors.forEach(colorName => {
            if (!this.colors.has(colorName)) {
                throw new Error(`Multiplayer color "${colorName}" does not exist in the rules [Colors] section.`);
            }
            colors.set(colorName, this.colors.get(colorName)!);
        });
        return colors;
    }
    getLandRules(landType: LandType): LandRules {
        let rules = this.landRules.get(landType);
        if (!rules) {
            const sectionName = landType === LandType.Cliff ? "Rock" : LandType[landType];
            rules = new LandRules().readIni(this.ini.getOrCreateSection(sectionName));
            this.landRules.set(landType, rules);
        }
        return rules;
    }
    getTiberium(id: number): TiberiumRules {
        const typeName = this.tiberiumTypes.get(id);
        if (!typeName) {
            throw new Error("Unknown tiberium type " + id);
        }
        return this.tiberiumRules.get(typeName)!;
    }
    getSuperWeapon(name: string): SuperWeaponRules {
        if (!this.superWeaponRules.has(name)) {
            throw new Error(`Unknown superweapon type "${name}"`);
        }
        return this.superWeaponRules.get(name)!;
    }
    getIni(): IniFile {
        return this.ini;
    }
    applySpecialFlags(flags: SpecialFlags): void {
        if (flags.initialVeteran) {
            this.general.veteran.initialVeteran = true;
        }
    }
    private init(): void {
        this.readAudioVisual();
        this.readCombatDamage();
        this.readRadiation();
        this.readGeneral();
        this.readAi();
        this.readCrateRules();
        this.readElevationModel();
        this.readMpDialogSettings();
        this.readObjectTypes("BuildingTypes", this.buildingTypes);
        this.readObjectTypes("InfantryTypes", this.infantryTypes);
        this.readObjectTypes("VehicleTypes", this.vehicleTypes);
        this.readObjectTypes("AircraftTypes", this.aircraftTypes);
        this.readObjectTypes("TerrainTypes", this.terrainTypes);
        this.readObjectTypes("SmudgeTypes", this.smudgeTypes);
        this.readObjectTypes("Animations", this.animationTypes);
        this.animationNames = new Set(this.animationTypes.values());
        this.readObjectTypes("VoxelAnims", this.voxelAnimTypes);
        this.readObjectTypes("OverlayTypes", this.overlayTypes);
        this.overlayTypes.forEach((name, id) => this.overlayIdsByType.set(name, id));
        this.readColors();
        this.readObjectTypes("Countries", this.countryTypes);
        this.readObjectTypes("Warheads", this.warheadTypes);
        this.readObjectTypes("Tiberiums", this.tiberiumTypes);
        this.readObjectTypes("SuperWeaponTypes", this.superWeaponTypes);
        this.allObjectRules
            .set(ObjectType.Building, this.buildingRules)
            .set(ObjectType.Infantry, this.infantryRules)
            .set(ObjectType.Vehicle, this.vehicleRules)
            .set(ObjectType.Aircraft, this.aircraftRules)
            .set(ObjectType.Terrain, this.terrainRules)
            .set(ObjectType.Overlay, this.overlayRules)
            .set(ObjectType.Smudge, this.smudgeRules)
            .set(ObjectType.VoxelAnim, this.voxelAnimRules);
        this.readObjects(ObjectType.Building, this.buildingTypes, this.buildingRules);
        this.readObjects(ObjectType.Infantry, this.infantryTypes, this.infantryRules);
        this.readObjects(ObjectType.Vehicle, this.vehicleTypes, this.vehicleRules);
        this.readObjects(ObjectType.Aircraft, this.aircraftTypes, this.aircraftRules);
        this.readObjects(ObjectType.Terrain, this.terrainTypes, this.terrainRules);
        this.readObjects(ObjectType.Overlay, this.overlayTypes, this.overlayRules);
        this.readObjects(ObjectType.Smudge, this.smudgeTypes, this.smudgeRules);
        this.readObjects(ObjectType.VoxelAnim, this.voxelAnimTypes, this.voxelAnimRules);
        this.readCountries();
        this.readWarheads();
        this.readPowerups();
        this.readTiberiums();
        this.readSuperWeapons();
        this.buildWeaponsList();
    }
    private readAudioVisual(): void {
        const section = this.ini.getSection("AudioVisual");
        if (!section) {
            throw new Error("Missing [AudioVisual] section");
        }
        this.audioVisual.readIni(section);
    }
    private readCombatDamage(): void {
        const section = this.ini.getSection("CombatDamage");
        if (!section) {
            throw new Error("Missing [CombatDamage] section");
        }
        this.combatDamage.readIni(section);
    }
    private readRadiation(): void {
        const section = this.ini.getSection("Radiation");
        if (!section) {
            throw new Error("Missing [Radiation] section");
        }
        this.radiation.readIni(section);
    }
    private readGeneral(): void {
        const section = this.ini.getSection("General");
        if (!section) {
            throw new Error("Missing [General] section");
        }
        this.general.readIni(section as any);
    }
    private readAi(): void {
        const section = this.ini.getSection("AI");
        if (!section) {
            throw new Error("Missing [AI] section");
        }
        this.ai.readIni(section);
    }
    private readCrateRules(): void {
        const section = this.ini.getSection("CrateRules");
        if (!section) {
            throw new Error("Missing [CrateRules] section");
        }
        this.crateRules.readIni(section);
    }
    private readElevationModel(): void {
        const section = this.ini.getSection("ElevationModel");
        if (!section) {
            throw new Error("Missing [ElevationModel] section");
        }
        this.elevationModel.readIni(section);
    }
    private readMpDialogSettings(): void {
        const section = this.ini.getSection("MultiplayerDialogSettings");
        if (!section) {
            throw new Error("Missing [MultiplayerDialogSettings] section");
        }
        this.mpDialogSettings.readIni(section as any);
    }
    private readObjectTypes(sectionName: string, typeMap: Map<number, string>): void {
        const section = this.ini.getSection(sectionName);
        if (!section) {
            throw new Error(`Missing [${sectionName}] section`);
        }
        let index = 0;
        const seenTypes = new Set<string>();
        section.entries.forEach((value, key) => {
            if (typeof value === "string") {
                if (Number.isNaN(Number(key))) {
                    this.logger?.debug(`Non-numeric id "${key}" found in rules section [${sectionName}]. Skipping.`);
                }
                else if (seenTypes.has(value)) {
                    this.logger?.debug(`Duplicate type "${value}" in rules section [${sectionName}]. Skipping.`);
                }
                else {
                    typeMap.set(index++, value);
                    seenTypes.add(value);
                }
            }
            else {
                this.logger?.debug(`Non-string type found in rules section [${sectionName}]. Skipping.`);
            }
        });
    }
    private readColors(): void {
        const section = this.ini.getSection("Colors");
        if (!section) {
            throw new Error("Missing [Colors] section");
        }
        section.entries.forEach((value, name) => {
            const [h, s, v] = (value as string).split(",");
            const color = Color.fromHsv(parseInt(h, 10), parseInt(s, 10), parseInt(v, 10));
            this.colors.set(name, color);
        });
    }
    private readObjects(objectType: ObjectType, typeMap: Map<number, string>, rulesMap: Map<string, ObjectRules>): void {
        typeMap.forEach((typeName, id) => {
            const section = this.ini.getSection(typeName);
            if (section) {
                const rules = new ObjectRulesFactory().create(objectType, section, this.general, id as any);
                rulesMap.set(typeName, rules as any);
            }
            else {
                this.logger?.debug(`${ObjectType[objectType]} type "${typeName}" has no rules section`);
            }
        });
    }
    private readCountries(): void {
        this.countryTypes.forEach((name, id) => {
            const section = this.ini.getSection(name);
            if (!section) {
                throw new Error("Missing ini section for country " + name);
            }
            const rules = new CountryRules(id as any);
            rules.readIni(section as any);
            this.countryRules.set(name, rules);
        });
    }
    private readWarheads(): void {
        this.warheadTypes.forEach(name => {
            const section = this.ini.getSection(name);
            if (section) {
                const rules = new WarheadRules(section);
                this.warheadRules.set(name.toLowerCase(), rules);
            }
            else {
                this.logger?.debug(`Warhead "${name}" has no rules section`);
            }
        });
    }
    private readPowerups(): void {
        const section = this.ini.getSection("Powerups");
        if (!section) {
            throw new Error("Missing [Powerups] section");
        }
        this.powerups.readIni(section.entries);
    }
    private readTiberiums(): void {
        this.tiberiumTypes.forEach((name, id) => {
            const section = this.ini.getSection(name);
            if (!section) {
                throw new Error("Missing rules section for tiberium type " + name);
            }
            this.tiberiumRules.set(name, new TiberiumRules(id).readIni(section));
        });
    }
    private readSuperWeapons(): void {
        this.superWeaponTypes.forEach((name, id) => {
            const section = this.ini.getSection(name);
            if (!section) {
                throw new Error("Missing rules section for superweapon type " + name);
            }
            this.superWeaponRules.set(name, new SuperWeaponRules(id).readIni(section));
        });
    }
    private buildWeaponsList(): void {
        const weaponNames = new Set<string>();
        weaponNames.add(this.general.dropPodWeapon);
        for (const superWeapon of this.superWeaponRules.values()) {
            if (superWeapon.weaponType) {
                weaponNames.add(superWeapon.weaponType);
            }
        }
        weaponNames.add(Weapon.NUKE_PAYLOAD_NAME);
        const allObjectRules = [
            ...this.buildingRules.values(),
            ...this.aircraftRules.values(),
            ...this.vehicleRules.values(),
            ...this.infantryRules.values(),
        ];
        for (const rules of allObjectRules) {
            const weapons = [
                rules.deathWeapon,
                rules.primary,
                rules.secondary,
                rules.elitePrimary,
                rules.eliteSecondary,
                rules.occupyWeapon,
                rules.eliteOccupyWeapon,
                ...(rules.weaponCount
                    ? new Array(rules.weaponCount)
                        .fill(0)
                        .map((_, index) => [
                        rules.getWeaponAtIndex(index),
                        rules.getEliteWeaponAtIndex(index),
                    ])
                        .flat()
                    : []),
            ]
                .filter(isNotNullOrUndefined)
                .filter(weapon => weapon !== "");
            for (const weapon of weapons) {
                weaponNames.add(weapon);
            }
        }
        let weaponIndex = 0;
        for (const weaponName of weaponNames) {
            this.weaponTypes.set(weaponIndex++, weaponName);
        }
    }
}
