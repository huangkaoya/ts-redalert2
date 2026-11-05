import { ModManager } from "@/gui/screen/mainMenu/modSel/ModManager";
interface IniSection {
    getString(key: string): string | undefined;
    get(key: string): string | string[] | undefined;
    getNumber(key: string): number | undefined;
    getBool(key: string): boolean;
}
interface IniFile {
    getSection(name: string): IniSection | undefined;
}
export class ModMeta {
    public id?: string;
    public name?: string;
    public supported: boolean = false;
    public description?: string;
    public authors?: string[];
    public website?: string;
    public version?: string;
    public download?: string;
    public downloadSize?: number;
    public manualDownload: boolean = false;
    fromIniFile(iniFile: IniFile): this {
        const generalSection = iniFile.getSection("General");
        if (!generalSection) {
            throw new Error("Mod meta missing [General] section");
        }
        return this.fromIniSection(generalSection);
    }
    fromIniSection(section: IniSection): this {
        const id = section.getString("ID");
        const name = section.getString("Name");
        if (!id) {
            throw new Error("Mod meta missing ID");
        }
        if (!id.match(ModManager.modIdRegex)) {
            throw new Error(`Mod meta has invalid ID "${id}". ` +
                "ID must contain only alphanumeric characters, dash (-) or underscore (_)");
        }
        if (!name) {
            throw new Error("Mod meta missing Name");
        }
        this.id = id;
        this.name = name;
        this.supported = true;
        this.description = section.getString("Description") || undefined;
        const authors = section.get("Author");
        if (authors) {
            this.authors = Array.isArray(authors) ? authors : [authors];
        }
        const website = section.getString("Website");
        if (website) {
            if (website.match(/^https?:\/\//)) {
                this.website = website;
            }
            else {
                console.warn(`Invalid mod meta website "${website}"`);
            }
        }
        this.version = section.getString("Version") || undefined;
        this.download = section.getString("Download") || undefined;
        this.downloadSize = section.getNumber("DownloadSize") || undefined;
        this.manualDownload = section.getBool("ManualDownload");
        return this;
    }
    clone(): ModMeta {
        const cloned = new ModMeta();
        cloned.id = this.id;
        cloned.name = this.name;
        cloned.supported = this.supported;
        cloned.description = this.description;
        cloned.authors = this.authors?.slice();
        cloned.website = this.website;
        cloned.version = this.version;
        cloned.download = this.download;
        cloned.downloadSize = this.downloadSize;
        cloned.manualDownload = this.manualDownload;
        return cloned;
    }
}
