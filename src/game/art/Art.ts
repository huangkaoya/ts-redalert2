import { ObjectArt } from './ObjectArt';
import { ObjectType } from '@/engine/type/ObjectType';
import { ObjectRules } from '@/game/rules/ObjectRules';
import { IniSection } from '@/data/IniSection';
export class Art {
    private rules: any;
    private artIni: any;
    private mapFile: any;
    private logger: any;
    private objectArt: Map<any, Map<string, ObjectArt>>;
    constructor(rules: any, artIni: any, mapFile: any, logger: any) {
        this.rules = rules;
        this.artIni = artIni;
        this.mapFile = mapFile;
        this.logger = logger;
        this.objectArt = new Map();
        this.parse();
    }
    hasObject(name: string, type: ObjectType): boolean | undefined {
        return this.objectArt.get(type)?.has(name);
    }
    getObject(name: string, type: ObjectType): ObjectArt {
        if (!name) {
            throw new Error(`Must specify an art name for type "${ObjectType[type]}"`);
        }
        const art = this.objectArt.get(type)?.get(name);
        if (art) {
            return art;
        }
        this.logger?.debug(`Missing art for object "${name}"`);
        return new ObjectArt(type, this.rules.hasObject(name, type)
            ? this.rules.getObject(name, type)
            : new ObjectRules(type, new IniSection(name)), new IniSection(name));
    }
    getAnimation(name: string): ObjectArt {
        return this.getObject(name, ObjectType.Animation);
    }
    getProjectile(name: string): ObjectArt {
        const projectile = this.rules.getProjectile(name);
        const imageName = projectile.imageName;
        let section = this.artIni.getSection(imageName);
        if (!section) {
            this.logger?.debug(`Image ${imageName} (Projectile: ${name}) has no section in art.ini`);
            section = new IniSection(imageName);
        }
        return ObjectArt.factory(projectile.type, projectile, this.artIni, section);
    }
    getIni(): any {
        return this.artIni;
    }
    private parse(): void {
        this.rules.allObjectRules.forEach((rules: any[], type: ObjectType) => {
            const artMap = new Map<string, ObjectArt>();
            this.objectArt.set(type, artMap);
            rules.forEach((rule) => {
                const imageSection = this.artIni.getSection(rule.imageName);
                const nameSection = this.artIni.getSection(rule.name);
                const section = this.applyUnitMapOverrides(rule, this.mapFile, nameSection, imageSection);
                if (section) {
                    const art = ObjectArt.factory(rule.type, rule, this.artIni, section);
                    artMap.set(rule.name, art);
                }
                else {
                    this.logger?.debug(`${ObjectType[rule.type]} "${rule.name}" has no art section "${rule.imageName}"`);
                }
            });
        });
        const animations = [[ObjectType.Animation, this.rules.animationNames]];
        animations.forEach(([type, names]) => {
            const artMap = new Map<string, ObjectArt>();
            this.objectArt.set(type, artMap);
            names.forEach((name: string) => {
                const section = this.artIni.getSection(name);
                if (section) {
                    const rules = new ObjectRules(type, new IniSection(name));
                    const art = new ObjectArt(type, rules as any, section);
                    artMap.set(name, art);
                }
                else {
                    this.logger?.debug(`${ObjectType[type]} "${name}" has no art section`);
                }
            });
        });
    }
    private applyUnitMapOverrides(rule: any, mapFile: any, nameSection: any, imageSection: any): any {
        if ([ObjectType.Infantry, ObjectType.Vehicle, ObjectType.Aircraft].includes(rule.type) &&
            mapFile?.getSection(rule.name)?.getString("Image") &&
            nameSection) {
            const mergedSection = nameSection.clone();
            imageSection?.entries.forEach((value: any, key: string) => {
                mergedSection.set(key, value);
            });
            this.logger?.debug(`${ObjectType[rule.type]} "${rule.name}": ` +
                `Using merged art sections ${rule.name} and ${rule.imageName}`);
            return mergedSection;
        }
        return imageSection;
    }
}
