import { IniFile } from '../data/IniFile';
import { ShpFile } from '../data/ShpFile';
import { VxlFile } from '../data/VxlFile';
import { TmpFile } from '../data/TmpFile';
import { Palette } from '../data/Palette';
import { Theater } from './Theater';
import { TheaterType } from './TheaterType';
import { version as appVersion } from '../version';
import { VirtualFileSystem } from '../data/vfs/VirtualFileSystem';
import { RealFileSystem } from '../data/vfs/RealFileSystem';
import { LazyResourceCollection } from './LazyResourceCollection';
import { WavFile } from '../data/WavFile';
import { LazyAsyncResourceCollection } from './LazyAsyncResourceCollection';
import { Mp3File } from '../data/Mp3File';
import { mixDatabase } from './mixDatabase';
import { GameResSource } from './gameRes/GameResSource';
import { Crc32 } from '../data/Crc32';
import { GameModes } from '../game/ini/GameModes';
import * as stringUtils from '../util/string';
import { MapList } from './MapList';
import { HvaFile } from '../data/HvaFile';
import { MixinRulesType } from '../game/ini/MixinRulesType';
import { AppLogger } from '../util/logger';
type AppLoggerType = typeof AppLogger;
interface TheaterSettings {
    type: TheaterType;
    theaterIni: string;
    mixes: string[];
    extension: string;
    newTheaterChar: string;
    isoPaletteName: string;
    unitPaletteName: string;
    overlayPaletteName: string;
    libPaletteName: string;
}
interface VfsLogger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}
export enum EngineType {
    AutoDetect = 0,
    TiberianSun = 1,
    Firestorm = 2,
    RedAlert2 = 3,
    YurisRevenge = 4
}
export class Engine {
    public static readonly UI_ANIM_SPEED = 2;
    public static rfsSettings = {
        menuVideoFileName: "ra2ts_l.webm",
        splashImgFileName: "glsl.png",
        mapDir: "maps",
        modDir: "mods",
        musicDir: "music",
        tauntsDir: "Taunts",
        cacheDir: "cache",
        replayDir: "replays",
    };
    public static supportedMapTypes = ["mpr", "map"];
    public static images = new LazyResourceCollection((file) => new ShpFile(file));
    public static voxels = new LazyResourceCollection((file) => new VxlFile(file));
    public static voxelAnims = new LazyResourceCollection((file) => new HvaFile(file));
    public static sounds = new LazyResourceCollection((file) => new WavFile(file));
    public static themes = new LazyAsyncResourceCollection((file) => new Mp3File(file), false);
    public static taunts = new LazyAsyncResourceCollection(async (file) => new WavFile(file instanceof File
        ? new Uint8Array(await file.arrayBuffer())
        : file.getBytes()));
    public static iniFiles = new LazyResourceCollection((file) => new IniFile(file));
    public static tileData = new LazyResourceCollection((file) => new TmpFile(file));
    public static palettes = new LazyResourceCollection((file) => new Palette(file));
    public static theaters = new Map<TheaterType, Theater>();
    public static theaterSettings = new Map<EngineType, TheaterSettings[]>()
        .set(EngineType.RedAlert2, [
        {
            type: TheaterType.Temperate,
            theaterIni: "temperat.ini",
            mixes: ["isotemp.mix", "temperat.mix", "tem.mix"],
            extension: ".tem",
            newTheaterChar: "T",
            isoPaletteName: "isotem.pal",
            unitPaletteName: "unittem.pal",
            overlayPaletteName: "temperat.pal",
            libPaletteName: "libtem.pal",
        },
        {
            type: TheaterType.Snow,
            theaterIni: "snow.ini",
            mixes: ["isosnow.mix", "snow.mix", "sno.mix"],
            extension: ".sno",
            newTheaterChar: "A",
            isoPaletteName: "isosno.pal",
            unitPaletteName: "unitsno.pal",
            overlayPaletteName: "snow.pal",
            libPaletteName: "libsno.pal",
        },
        {
            type: TheaterType.Urban,
            theaterIni: "urban.ini",
            mixes: ["isourb.mix", "urb.mix", "urban.mix"],
            extension: ".urb",
            newTheaterChar: "U",
            isoPaletteName: "isourb.pal",
            unitPaletteName: "uniturb.pal",
            overlayPaletteName: "urban.pal",
            libPaletteName: "liburb.pal",
        },
    ])
        .set(EngineType.YurisRevenge, [
        {
            type: TheaterType.Temperate,
            theaterIni: "temperatmd.ini",
            mixes: [
                "isotemp.mix",
                "isotemmd.mix",
                "temperat.mix",
                "tem.mix",
            ],
            extension: ".tem",
            newTheaterChar: "T",
            isoPaletteName: "isotem.pal",
            unitPaletteName: "unittem.pal",
            overlayPaletteName: "temperat.pal",
            libPaletteName: "libtem.pal",
        },
        {
            type: TheaterType.Snow,
            theaterIni: "snowmd.ini",
            mixes: [
                "isosnomd.mix",
                "snowmd.mix",
                "isosnow.mix",
                "snow.mix",
                "sno.mix",
            ],
            extension: ".sno",
            newTheaterChar: "A",
            isoPaletteName: "isosno.pal",
            unitPaletteName: "unitsno.pal",
            overlayPaletteName: "snow.pal",
            libPaletteName: "libsno.pal",
        },
        {
            type: TheaterType.Urban,
            theaterIni: "urbanmd.ini",
            mixes: ["isourbmd.mix", "isourb.mix", "urb.mix", "urban.mix"],
            extension: ".urb",
            newTheaterChar: "U",
            isoPaletteName: "isourb.pal",
            unitPaletteName: "uniturb.pal",
            overlayPaletteName: "urban.pal",
            libPaletteName: "liburb.pal",
        },
        {
            type: TheaterType.NewUrban,
            theaterIni: "urbannmd.ini",
            mixes: [
                "isoubnmd.mix",
                "isoubn.mix",
                "ubn.mix",
                "urbann.mix",
            ],
            extension: ".ubn",
            newTheaterChar: "N",
            isoPaletteName: "isoubn.pal",
            unitPaletteName: "unitubn.pal",
            overlayPaletteName: "urbann.pal",
            libPaletteName: "libubn.pal",
        },
        {
            type: TheaterType.Desert,
            theaterIni: "desertmd.ini",
            mixes: [
                "isodesmd.mix",
                "desert.mix",
                "des.mix",
                "isodes.mix",
            ],
            extension: ".des",
            newTheaterChar: "D",
            isoPaletteName: "isodes.pal",
            unitPaletteName: "unitdes.pal",
            overlayPaletteName: "desert.pal",
            libPaletteName: "libdes.pal",
        },
        {
            type: TheaterType.Lunar,
            theaterIni: "lunarmd.ini",
            mixes: ["isolunmd.mix", "isolun.mix", "lun.mix", "lunar.mix"],
            extension: ".lun",
            newTheaterChar: "L",
            isoPaletteName: "isolun.pal",
            unitPaletteName: "unitlun.pal",
            overlayPaletteName: "lunar.pal",
            libPaletteName: "liblun.pal",
        },
    ]);
    public static customRulesFileName = "rulescd.ini";
    public static customArtFileName = "artcd.ini";
    public static customMpModesFileName = "mpmodescd.ini";
    public static shroudFileName = "shroud.shp";
    public static mixinRulesFileNames = new Map<MixinRulesType, string>()
        .set(MixinRulesType.NoDogEngiKills, "nodogengikills.ini")
        .set(MixinRulesType.BalanceChanges, "balancecd.ini");
    private static activeMod?: string;
    private static modHash?: number;
    private static gameResSource?: GameResSource;
    public static rfs?: RealFileSystem;
    public static vfs?: VirtualFileSystem;
    public static art?: IniFile;
    public static rules?: IniFile;
    public static ai?: IniFile;
    public static activeTheater?: Theater;
    private static mapList?: MapList;
    static getVersion(): string {
        return appVersion.split(".").slice(0, 2).join(".");
    }
    static getModHash(): number {
        if (!this.modHash) {
            throw new Error("Rules must be loaded first");
        }
        return this.modHash;
    }
    static getActiveMod(): string | undefined {
        return this.activeMod;
    }
    static setActiveMod(modName: string | undefined): void {
        this.activeMod = modName;
    }
    static initGameResSource(source: GameResSource): void {
        this.gameResSource = source;
    }
    static async initRfs(rootHandle: FileSystemDirectoryHandle): Promise<RealFileSystem> {
        const rfsInstance = (this.rfs = new RealFileSystem());
        rfsInstance.addRootDirectoryHandle(rootHandle);
        return rfsInstance;
    }
    static async initVfs(rfsInstance: RealFileSystem | undefined, logger: VfsLogger): Promise<VirtualFileSystem> {
        this.vfs = new VirtualFileSystem(rfsInstance, logger);
        this.iniFiles.setVfs(this.vfs);
        this.palettes.setVfs(this.vfs);
        this.images.setVfs(this.vfs);
        this.voxels.setVfs(this.vfs);
        this.voxelAnims.setVfs(this.vfs);
        this.tileData.setVfs(this.vfs);
        this.sounds.setVfs(this.vfs);
        const musicDirPath = Engine.rfsSettings.musicDir;
        if (Engine.rfs && (await Engine.rfs.containsEntry(musicDirPath))) {
            const musicDir = await Engine.rfs.getDirectory(musicDirPath);
            console.log('[Engine] Setting themes directory for music files');
            try {
                const handle = musicDir.getNativeHandle();
                if (handle) {
                    Engine.themes.setDir(handle);
                    console.log('[Engine] Themes directory set successfully');
                }
                else {
                    console.warn('[Engine] Failed to get native handle for music directory');
                }
            }
            catch (error) {
                console.error('[Engine] Failed to set themes directory:', error);
            }
        }
        else {
            console.warn('[Engine] Music directory not found in RFS');
        }
        const tauntsDir = await this.rfs?.findDirectory(this.rfsSettings.tauntsDir);
        this.taunts.setDir(tauntsDir?.getNativeHandle());
        return this.vfs;
    }
    static supportsTheater(theaterType: TheaterType): boolean {
        const currentEngine = this.getActiveEngine();
        return (this.theaterSettings.get(currentEngine)?.some((setting) => setting.type === theaterType) || false);
    }
    static getTheaterSettings(engineType: EngineType, theaterType: TheaterType): TheaterSettings {
        const settingsForEngine = this.theaterSettings.get(engineType);
        if (!settingsForEngine) {
            throw new Error(`Unknown engineType "${EngineType[engineType]}"`);
        }
        const specificSetting = settingsForEngine.find((setting) => setting.type === theaterType);
        if (!specificSetting) {
            throw new Error(`Unsupported theater "${TheaterType[theaterType]}" for engine "${EngineType[engineType]}"`);
        }
        return specificSetting;
    }
    static async loadTheater(theaterType: TheaterType): Promise<Theater> {
        if (!this.rules || !this.art) {
            throw new Error("Rules and art should be loaded first");
        }
        if (this.gameResSource === undefined) {
            throw new Error("No gameResSource is set");
        }
        const currentEngine = this.getActiveEngine();
        let theaterInstance: Theater | undefined;
        const settings = this.getTheaterSettings(currentEngine, theaterType);
        if (this.gameResSource !== GameResSource.Cdn && this.vfs) {
            for (const mixName of settings.mixes) {
                await this.vfs.addMixFile(mixName);
            }
        }
        if (this.theaters.has(theaterType)) {
            theaterInstance = this.theaters.get(theaterType)!;
        }
        else {
            const theaterIniFile = this.getTheaterIni(currentEngine, theaterType);
            const tileDataCollection = this.getTileData();
            theaterInstance = Theater.factory(theaterType, theaterIniFile, settings, tileDataCollection, this.palettes);
            this.theaters.set(theaterType, theaterInstance);
        }
        this.activeTheater = theaterInstance;
        return theaterInstance;
    }
    static unloadTheater(theaterType: TheaterType): void {
        if (this.vfs) {
            const currentEngine = this.getActiveEngine();
            const settings = this.getTheaterSettings(currentEngine, theaterType);
            for (const mixName of settings.mixes) {
                this.vfs.removeArchive(mixName);
            }
        }
    }
    static unloadSideMixData(): void {
        for (const mixFileName of ["sidec01.mix", "sidec01cd.mix"]) {
            const mixInfo = mixDatabase.get(mixFileName);
            if (!mixInfo) {
                console.warn(`Mix "${mixFileName}" not found in mix database`);
                return;
            }
            for (const entryName of mixInfo) {
                const extension = entryName.split('.').pop()?.toLowerCase();
                (extension === "pal" ? this.palettes : this.images).clear(entryName);
            }
        }
    }
    static getTheaterIni(engineType: EngineType, theaterType: TheaterType): IniFile {
        const iniFileName = this.getTheaterSettings(engineType, theaterType).theaterIni;
        return this.getIni(iniFileName);
    }
    static loadRules(): void {
        const rulesFileName = this.getFileNameVariant("rules.ini");
        const artFileName = this.getFileNameVariant("art.ini");
        const aiFileName = this.getFileNameVariant("ai.ini");
        const rulesBase = this.iniFiles.get(rulesFileName);
        console.log('current rulesBase', rulesBase);
        const artBase = this.iniFiles.get(artFileName);
        const aiBase = this.iniFiles.get(aiFileName);
        if (!rulesBase)
            throw new Error(`Rules "${rulesFileName}" not found`);
        if (!artBase)
            throw new Error(`Art "${artFileName}" not found`);
        if (!aiBase)
            throw new Error(`AI "${aiFileName}" not found`);
        const rulesCustom = this.iniFiles.get(this.customRulesFileName);
        const artCustom = this.iniFiles.get(this.customArtFileName);
        if (!rulesCustom)
            throw new Error(`Rules "${this.customRulesFileName}" not found`);
        if (!artCustom)
            throw new Error(`Art "${this.customArtFileName}" not found`);
        this.art = artBase.clone().mergeWith(artCustom);
        this.rules = rulesBase.clone().mergeWith(rulesCustom);
        console.log('current custom rules', rulesCustom);
        this.ai = aiBase;
        this.modHash = this.computeModHash();
    }
    static computeModHash(): number {
        if (!this.vfs)
            throw new Error("VFS not initialized");
        const filesToHash: string[] = [
            this.customRulesFileName,
            this.customArtFileName,
            this.customMpModesFileName,
            this.shroudFileName,
            this.getFileNameVariant("rules.ini"),
            this.getFileNameVariant("art.ini"),
            this.getFileNameVariant("ai.ini"),
            ...Array.from(this.mixinRulesFileNames.values()),
        ];
        const currentEngine = this.getActiveEngine();
        const theaterSettingsForEngine = this.theaterSettings.get(currentEngine);
        if (!theaterSettingsForEngine) {
            throw new Error(`Unsupported engineType "${EngineType[currentEngine]}"`);
        }
        for (const setting of theaterSettingsForEngine) {
            filesToHash.push(this.getFileNameVariant(setting.theaterIni));
        }
        const mpModes = this.getMpModes();
        for (const mode of mpModes.getAll()) {
            if (mode.rulesOverride) {
                filesToHash.push(mode.rulesOverride);
            }
        }
        const crc = new Crc32();
        for (const fileName of filesToHash) {
            if (!this.vfs.fileExists(fileName)) {
                throw new Error(`File ${fileName} not found for hashing`);
            }
            crc.append(this.vfs.openFile(fileName).getBytes());
        }
        crc.append(stringUtils.binaryStringToUint8Array(this.getVersion()));
        return crc.get();
    }
    static getRules(): IniFile {
        if (!this.rules)
            throw new Error("Rules must be loaded first");
        console.log('current rules', this.rules);
        return this.rules;
    }
    static getArt(): IniFile {
        if (!this.art)
            throw new Error("Art must be loaded first");
        return this.art;
    }
    static getAi(): IniFile {
        if (!this.ai)
            throw new Error("AI must be loaded first");
        return this.ai;
    }
    static getFileNameVariant(baseFileName: string): string {
        const currentEngine = this.getActiveEngine();
        let suffix = "";
        if (currentEngine === EngineType.YurisRevenge) {
            suffix = "md";
        }
        else if (currentEngine !== EngineType.RedAlert2) {
            throw new Error("Unsupported engine type " + EngineType[currentEngine]);
        }
        return suffix ? baseFileName.replace(/\.([^.]+)$/, `${suffix}.$1`) : baseFileName;
    }
    static getMpModes(): GameModes {
        return new GameModes(this.getIni(this.customMpModesFileName), (fileName: string) => this.getIni(fileName));
    }
    static getUiIni(): IniFile {
        const uiIniFileName = this.getFileNameVariant("ui.ini");
        return this.getIni(uiIniFileName);
    }
    static getIni(fileName: string): IniFile {
        const iniFile = this.iniFiles.get(fileName);
        if (!iniFile) {
            console.warn(`INI file "${fileName}" not found, returning empty INI file`);
            return new IniFile();
        }
        return iniFile;
    }
    static async loadMapList(): Promise<MapList> {
        if (!this.vfs)
            throw new Error("File system not initialized");
        const gameModes = this.getMpModes();
        const combinedMapList = new MapList(gameModes);
        const missionsPktFileName = this.getFileNameVariant("missions.pkt");
        if (this.iniFiles.has(missionsPktFileName)) {
            combinedMapList.addFromIni(this.getIni(missionsPktFileName));
        }
        else {
            console.warn(`Map list file "${missionsPktFileName}" not found, skipping`);
        }
        for (const archiveName of this.vfs.listArchives()) {
            const pktFileName = archiveName.toLowerCase().replace(/\.[^.]+$/, "") + ".pkt";
            if (this.vfs.fileExists(pktFileName)) {
                combinedMapList.addFromIni(new IniFile(this.vfs.openFile(pktFileName)));
            }
        }
        const localMapList = new MapList(gameModes);
        if (this.rfs) {
            const rootDir = this.rfs.getRootDirectory();
            if (rootDir) {
                const entries = await rootDir.listEntries();
                for (const entryName of entries) {
                    const lowerEntryName = entryName.toLowerCase();
                    try {
                        if (lowerEntryName.endsWith(".pkt")) {
                            const fileData = await this.rfs.openFile(entryName, true);
                            if (fileData) {
                                localMapList.addFromIni(new IniFile(fileData));
                            }
                        }
                        else if (this.supportedMapTypes.some((type) => lowerEntryName.endsWith("." + type))) {
                            const fileData = await this.rfs.openFile(entryName, true);
                            if (fileData) {
                                localMapList.addFromMapFile(fileData);
                            }
                        }
                    }
                    catch (e) {
                        console.warn(`Couldn't read file "${entryName}" from RFS`, e);
                    }
                }
            }
        }
        localMapList.sortByName();
        combinedMapList.mergeWith(localMapList);
        this.mapList = combinedMapList;
        return combinedMapList;
    }
    static getTileData(): LazyResourceCollection<TmpFile> {
        return this.tileData;
    }
    static getImages(): LazyResourceCollection<ShpFile> {
        return this.images;
    }
    static getVoxels(): LazyResourceCollection<VxlFile> {
        return this.voxels;
    }
    static getVoxelAnims(): LazyResourceCollection<HvaFile> {
        return this.voxelAnims;
    }
    static getPalettes(): LazyResourceCollection<Palette> {
        return this.palettes;
    }
    static getSounds(): LazyResourceCollection<WavFile> {
        return this.sounds;
    }
    static getThemes(): LazyAsyncResourceCollection<Mp3File> {
        return this.themes;
    }
    static getTaunts(): LazyAsyncResourceCollection<WavFile> {
        return this.taunts;
    }
    static getActiveEngine(): EngineType {
        return EngineType.RedAlert2;
    }
    static getLastTheaterType(): TheaterType | undefined {
        return this.activeTheater?.type;
    }
    static async getCacheDir(): Promise<FileSystemDirectoryHandle | undefined> {
        try {
            return await this.getOrCreateDir(this.rfsSettings.cacheDir, true);
        }
        catch (e) {
            console.error("Couldn't get cache directory", e);
            return undefined;
        }
    }
    static async getReplayDir(): Promise<FileSystemDirectoryHandle | undefined> {
        const currentMod = this.getActiveMod();
        if (currentMod) {
            const modDirRoot = await this.getModDir();
            const modSpecificDir = await modDirRoot?.getDirectoryHandle(currentMod, {
                create: true,
            });
            return await modSpecificDir?.getDirectoryHandle(this.rfsSettings.replayDir, { create: true });
        }
        return await this.getOrCreateDir(this.rfsSettings.replayDir);
    }
    static async getModDir(): Promise<FileSystemDirectoryHandle | undefined> {
        return await this.getOrCreateDir(this.rfsSettings.modDir);
    }
    static async getMapDir(): Promise<FileSystemDirectoryHandle | undefined> {
        return await this.getOrCreateDir(this.rfsSettings.mapDir);
    }
    static async getOrCreateDir(dirName: string, isPrivate: boolean = false): Promise<FileSystemDirectoryHandle | undefined> {
        const rootDir = this.rfs?.getRootDirectory();
        if (rootDir) {
            const nativeRootDirHandle = rootDir.getNativeHandle();
            if (nativeRootDirHandle) {
                return await nativeRootDirHandle.getDirectoryHandle(dirName, { create: true });
            }
            else {
                return await rootDir.getOrCreateDirectoryHandle(dirName, isPrivate);
            }
        }
        return undefined;
    }
    static getMapList(): MapList | undefined {
        return this.mapList;
    }
    static destroy(): void {
        this.activeTheater = undefined;
        this.activeMod = undefined;
        this.modHash = undefined;
        this.mapList = undefined;
        this.rfs = undefined;
        this.vfs = undefined;
        this.art = undefined;
        this.iniFiles.clearAll();
        this.images.clearAll();
        this.palettes.clearAll();
        this.rules = undefined;
        this.ai = undefined;
        this.theaters.clear();
        this.tileData.clearAll();
        this.voxels.clearAll();
        this.voxelAnims.clearAll();
        this.sounds.clearAll();
        this.themes.clearAll();
        this.taunts.clearAll();
    }
}
