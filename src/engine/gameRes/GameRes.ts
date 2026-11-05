import { DataStream } from '../../data/DataStream';
import { MixFile } from '../../data/MixFile';
import { MixEntry } from '../../data/MixEntry';
import { VirtualFileSystem } from '../../data/vfs/VirtualFileSystem';
import { Engine, EngineType } from '../Engine';
import { ResourceLoader, LoaderResult } from '../ResourceLoader';
import { DownloadError } from '../../network/HttpRequest';
import { AppLogger } from '../../util/logger';
import { GameResConfig } from './GameResConfig';
import { ChecksumError } from './importError/ChecksumError';
import { FileNotFoundError as GameResFileNotFoundError } from './importError/FileNotFoundError';
import { NoStorageError } from './importError/NoStorageError';
import { Crc32 } from '../../data/Crc32';
import { Palette } from '../../data/Palette';
import { ShpFile } from '../../data/ShpFile';
import { PcxFile } from '../../data/PcxFile';
import { ImageUtils } from '../gfx/ImageUtils';
import { RgbaBitmap } from '../../data/Bitmap';
import { CanvasUtils } from '../gfx/CanvasUtils';
import { GameResBoxApi } from '../../gui/component/GameResBoxApi';
import { GameResSource } from './GameResSource';
import { RealFileSystem } from '../../data/vfs/RealFileSystem';
import { ResourceType, resourcesForPrefetch, theaterSpecificResources } from '../resourceConfigs';
import { CdnResourceLoader } from './CdnResourceLoader';
import { LocalPrefs, StorageKey } from '../../LocalPrefs';
import { FileSystemUtil } from './FileSystemUtil';
import { StorageQuotaError } from '../../data/vfs/StorageQuotaError';
import { FileNotFoundError as VfsFileNotFoundError } from '../../data/vfs/FileNotFoundError';
import { IOError } from '../../data/vfs/IOError';
import { GameResImporter, type ImportProgressCallback } from './GameResImporter';
import type { Strings } from '../../data/Strings';
import SplashScreen from '../../gui/component/SplashScreen';
import type { Viewport } from '../../gui/Viewport';
import type { Config } from '../../Config';
import { RealFileSystemDir } from '../../data/vfs/RealFileSystemDir';
interface FsAccessLibrary {
    support: {
        adapter: {
            native?: boolean;
            cache?: boolean;
            indexeddb?: boolean;
        };
    };
    adapters: {
        indexeddb?: any;
        cache?: any;
    };
    getOriginPrivateDirectory: (module?: any) => Promise<FileSystemDirectoryHandle>;
}
interface InitResult {
    configToPersist?: GameResConfig;
    cdnResLoader?: CdnResourceLoader;
}
type LoadProgressCallback = (loadingText?: string, backgroundImage?: string | Blob) => void;
type FatalErrorCallback = (error: Error, strings: Strings) => Promise<void>;
type ImportErrorCallback = (error: Error, strings: Strings) => Promise<void>;
export class GameRes {
    private appVersion: string;
    private modName?: string;
    private fsAccessLib: FsAccessLibrary;
    private localPrefs: LocalPrefs;
    private strings: Strings;
    private rootEl: HTMLElement;
    private splashScreen: any;
    private viewport: Viewport;
    private appConfig: Config;
    private appResPath: string;
    private sentry?: any;
    constructor(appVersion: string, modName: string | undefined, fsAccessLib: FsAccessLibrary, localPrefs: LocalPrefs, strings: Strings, rootEl: HTMLElement, splashScreen: any, viewport: Viewport, appConfig: Config, appResPath: string, sentry?: any) {
        this.appVersion = appVersion;
        this.modName = modName;
        this.fsAccessLib = fsAccessLib;
        this.localPrefs = localPrefs;
        this.strings = strings;
        this.rootEl = rootEl;
        this.splashScreen = splashScreen;
        this.viewport = viewport;
        this.appConfig = appConfig;
        this.appResPath = appResPath;
        this.sentry = sentry;
    }
    async init(persistedConfig: GameResConfig | undefined, onFatalError: FatalErrorCallback, onImportError: ImportErrorCallback): Promise<InitResult> {
        let resourcesLoadedSuccessfully = false;
        let configRequiresSave = false;
        let createdBlobUrl: string | undefined;
        let cdnResourceLoader: CdnResourceLoader | undefined = undefined;
        const updateSplashScreen: LoadProgressCallback = (text, image) => {
            if (text)
                this.splashScreen.setLoadingText(text);
            if (image) {
                let imageUrl: string;
                if (typeof image === 'string') {
                    imageUrl = image;
                }
                else {
                    if (createdBlobUrl)
                        URL.revokeObjectURL(createdBlobUrl);
                    createdBlobUrl = URL.createObjectURL(image);
                    imageUrl = createdBlobUrl;
                }
                this.splashScreen.setBackgroundImage(imageUrl);
            }
        };
        let nativeFsHandle: FileSystemDirectoryHandle | undefined;
        try {
            nativeFsHandle = await this.getBrowserFsHandle("native");
        }
        catch (e) {
            if (!(e instanceof NoStorageError))
                throw e;
        }
        let migrationDone = false;
        try {
            if (nativeFsHandle) {
                migrationDone = await this.migrateStorageToNative(nativeFsHandle, updateSplashScreen);
            }
        }
        catch (e: any) {
            console.warn("Storage migration to native failed", e);
            const error = new Error("Failed to migrate files to native file system");
            (error as any).cause = e;
            this.sentry?.captureException(error);
            migrationDone = false;
        }
        finally {
            updateSplashScreen(this.strings.get("GUI:LoadingEx"));
        }
        let rfs: RealFileSystem | undefined;
        try {
            const fsHandleToUse = migrationDone && nativeFsHandle ? nativeFsHandle : await this.getBrowserFsHandle("fallback");
            if (fsHandleToUse) {
                rfs = await Engine.initRfs(fsHandleToUse);
            }
        }
        catch (e) {
            if (!(e instanceof NoStorageError))
                throw e;
            console.warn("No storage adapters available.");
        }
        let currentConfig = persistedConfig;
        if (!currentConfig && rfs) {
            const rootDir = rfs.getRootDirectory();
            console.log('[GameRes] Checking for existing game files. RFS rootDir:', rootDir);
            if (rootDir && await this.lookForGameFiles(rootDir)) {
                console.log('[GameRes] Found game files in local storage, creating config');
                currentConfig = new GameResConfig("");
                currentConfig.source = GameResSource.Local;
                configRequiresSave = true;
            }
            else {
                console.log('[GameRes] No game files found in local storage');
            }
        }
        else {
            console.log('[GameRes] Skipping game file check. currentConfig:', currentConfig, 'rfs:', rfs);
        }
        let modRfsDir: RealFileSystemDir | undefined;
        if (rfs) {
            const modDirHandle = await Engine.getModDir();
            if (modDirHandle) {
                modRfsDir = await this.loadMod(rfs, modDirHandle);
            }
            const mapDirHandle = await Engine.getMapDir();
            if (mapDirHandle && rfs && typeof (rfs as any).addDirectoryHandle === 'function') {
                const mapRfsDir = new RealFileSystemDir(mapDirHandle);
                rfs.addDirectory(mapRfsDir);
            }
        }
        if (currentConfig) {
            const splashBg = await this.loadSplashScreenBackground(rfs?.getRootDirectory(), modRfsDir, currentConfig);
            if (typeof splashBg === 'string') {
                this.splashScreen.setBackgroundImage(splashBg);
            }
            else if (splashBg) {
                if (createdBlobUrl)
                    URL.revokeObjectURL(createdBlobUrl);
                createdBlobUrl = URL.createObjectURL(splashBg);
                this.splashScreen.setBackgroundImage(createdBlobUrl);
            }
            try {
                this.splashScreen.setLoadingText(this.strings.get("GUI:LoadingEx"));
                cdnResourceLoader = await this.loadResources(rfs, currentConfig, updateSplashScreen);
                resourcesLoadedSuccessfully = true;
            }
            catch (e: any) {
                console.error("Failed to load initial game resources", e);
                console.error("Error details:", {
                    name: e.name,
                    message: e.message,
                    stack: e.stack,
                    cause: e.cause
                });
                this.splashScreen.setLoadingText("");
                this.splashScreen.setBackgroundImage("");
                await onFatalError(e, this.strings);
            }
        }
        const gameResBoxApi = new GameResBoxApi(this.viewport, this.strings, this.rootEl, this.fsAccessLib as any);
        let archiveUrlFallback = this.appConfig.gameResArchiveUrl;
        while (!resourcesLoadedSuccessfully) {
            console.log('[GameRes] Resources not loaded successfully, prompting user for game files');
            this.splashScreen.setLoadingText("");
            this.splashScreen.setBackgroundImage("");
            if (createdBlobUrl) {
                URL.revokeObjectURL(createdBlobUrl);
                createdBlobUrl = undefined;
            }
            console.log('[GameRes] Calling gameResBoxApi.promptForGameRes');
            const userSelection = await gameResBoxApi.promptForGameRes(archiveUrlFallback, !!this.appConfig.gameresBaseUrl && !this.modName);
            console.log('[GameRes] User selection from prompt:', userSelection);
            currentConfig = new GameResConfig(this.appConfig.gameresBaseUrl ?? "");
            configRequiresSave = true;
            let selectedSource: GameResSource;
            if (userSelection) {
                if (userSelection instanceof URL) {
                    selectedSource = GameResSource.Archive;
                    archiveUrlFallback = userSelection.toString();
                }
                else {
                    if (userSelection.kind === "file") {
                        selectedSource = GameResSource.Archive;
                    }
                    else if (userSelection.kind === "directory") {
                        selectedSource = GameResSource.Local;
                    }
                    else {
                        const kind = (userSelection as any).kind;
                        console.error("Unexpected FileSystemHandle kind:", kind, userSelection);
                        throw new Error(`Unexpected FileSystemHandle type from prompt: ${kind}`);
                    }
                }
            }
            else {
                selectedSource = GameResSource.Cdn;
            }
            currentConfig.source = selectedSource;
            if (selectedSource !== GameResSource.Cdn) {
                try {
                    if (!rfs) {
                        if (selectedSource === GameResSource.Local && userSelection && !(userSelection instanceof URL) && userSelection.kind === 'directory') {
                            const handle = userSelection as FileSystemDirectoryHandle;
                            rfs = await Engine.initRfs(handle);
                        }
                        else {
                            throw new NoStorageError("No storage adapters available for import.");
                        }
                    }
                    const rootDir = rfs.getRootDirectory();
                    if (!rootDir)
                        throw new Error("RFS root directory not available for import");
                    await new GameResImporter(this.appConfig, this.strings, this.sentry).import(userSelection, rootDir, (text, image) => {
                        updateSplashScreen(text, image);
                        if (text)
                            console.info(text);
                    });
                    console.info("Game assets successfully imported.");
                }
                catch (e: any) {
                    console.error("Failed to import game assets", e);
                    console.error("Import error details:", {
                        name: e.name,
                        message: e.message,
                        stack: e.stack,
                        originalError: e.originalError,
                        userSelection: userSelection
                    });
                    this.splashScreen.setLoadingText("");
                    this.splashScreen.setBackgroundImage("");
                    await onImportError(e, this.strings);
                    continue;
                }
                finally {
                    this.splashScreen.setLoadingText("");
                }
            }
            try {
                this.splashScreen.setLoadingText(this.strings.get("GUI:LoadingEx"));
                cdnResourceLoader = await this.loadResources(rfs, currentConfig, updateSplashScreen);
                resourcesLoadedSuccessfully = true;
            }
            catch (e: any) {
                console.error("Failed to load game assets after prompt/import", e);
                console.error("Load error details:", {
                    name: e.name,
                    message: e.message,
                    stack: e.stack,
                    cause: e.cause,
                    config: currentConfig
                });
                this.splashScreen.setLoadingText("");
                this.splashScreen.setBackgroundImage("");
                await onFatalError(e, this.strings);
            }
        }
        if (createdBlobUrl)
            URL.revokeObjectURL(createdBlobUrl);
        return { configToPersist: configRequiresSave ? currentConfig : undefined, cdnResLoader: cdnResourceLoader };
    }
    private async loadMod(rfs: RealFileSystem, modDirHandle: FileSystemDirectoryHandle): Promise<RealFileSystemDir | undefined> {
        let modName = this.modName;
        let specificModDir: RealFileSystemDir | undefined;
        if (modName) {
            const baseModRfsDir = new RealFileSystemDir(modDirHandle);
            if (await baseModRfsDir.containsEntry(modName)) {
                console.info(`Loading mod "${modName}"...`);
                specificModDir = await baseModRfsDir.getDirectory(modName);
                rfs.addDirectory(specificModDir);
                Engine.setActiveMod(modName);
            }
            else {
                console.info(`Mod "${modName}" not found. Ignoring.`);
                this.modName = undefined;
                Engine.setActiveMod(undefined);
            }
        }
        return specificModDir;
    }
    private async lookForGameFiles(rfsDir: RealFileSystemDir): Promise<boolean> {
        const entries = await rfsDir.listEntries();
        console.log('[GameRes.lookForGameFiles] Entries in directory:', entries);
        const requiredFiles = ["language.mix", "multi.mix", "ra2.mix"];
        const hasAllFiles = requiredFiles.every((fileName) => entries.includes(fileName));
        console.log('[GameRes.lookForGameFiles] Required files:', requiredFiles, 'Has all files:', hasAllFiles);
        return hasAllFiles;
    }
    private async migrateStorageToNative(nativeFsHandle: FileSystemDirectoryHandle, onProgress: LoadProgressCallback): Promise<boolean> {
        const migrationPendingKey = "_storage_migration_pending";
        if (this.localPrefs.getItem(migrationPendingKey)) {
            console.info("Resuming pending native storage migration: clearing native storage first.");
            for await (const key of nativeFsHandle.keys()) {
                await nativeFsHandle.removeEntry(key, { recursive: true });
            }
            this.localPrefs.removeItem(migrationPendingKey);
        }
        else {
            let hasContent = false;
            for await (const _ of nativeFsHandle.keys()) {
                hasContent = true;
                break;
            }
            if (hasContent) {
                console.info("Native storage appears to have content. Migration not attempted.");
                return true;
            }
        }
        if (this.localPrefs.getItem(StorageKey.LastGpuTier) === undefined) {
            console.info("LastGpuTier not set in LocalPrefs. Migration skipped.");
            return true;
        }
        console.info("Attempting to migrate old storage to new native storage...");
        let fallbackFsHandle: FileSystemDirectoryHandle | undefined;
        try {
            fallbackFsHandle = await this.getBrowserFsHandle("fallback");
        }
        catch (e) {
            if (e instanceof NoStorageError) {
                console.info("No existing fallback storage found. Migration skipped.");
                return false;
            }
            throw e;
        }
        if (navigator.storage?.estimate) {
            try {
                const usage = await navigator.storage.estimate();
                if (usage.usage !== undefined && usage.quota !== undefined) {
                    if (usage.usage > (usage.quota - 5 * 1024 * 1024) / 2) {
                        console.info("Migration to native storage skipped due to insufficient space estimate.");
                        return false;
                    }
                }
            }
            catch (estError) {
                console.warn("Could not estimate storage quota, proceeding with migration carefully:", estError);
            }
        }
        const fallbackRfsDir = new RealFileSystemDir(fallbackFsHandle);
        const filesInFallback = await FileSystemUtil.listDir(fallbackRfsDir.getNativeHandle());
        if (filesInFallback.includes(Engine.rfsSettings.cacheDir)) {
            console.info(`Removing old cache directory: ${Engine.rfsSettings.cacheDir}`);
            await fallbackRfsDir.deleteDirectory(Engine.rfsSettings.cacheDir, true);
        }
        this.localPrefs.setItem(migrationPendingKey, "1");
        try {
            await this.migrateDir(fallbackRfsDir, nativeFsHandle, onProgress);
        }
        catch (e) {
            console.error("Error during directory migration, attempting to clear native target:", e);
            for await (const key of nativeFsHandle.keys()) {
                try {
                    await nativeFsHandle.removeEntry(key, { recursive: true });
                }
                catch { }
            }
            throw e;
        }
        finally {
            this.localPrefs.removeItem(migrationPendingKey);
        }
        try {
            console.info("Attempting to delete old IndexedDB database: fileSystem");
            indexedDB.deleteDatabase("fileSystem");
            if (this.fsAccessLib.support.adapter.cache && globalThis.caches) {
                console.info("Attempting to delete old Cache API storage: sandboxed-fs");
                await globalThis.caches.delete("sandboxed-fs");
            }
        }
        catch (cleanupError) {
            console.warn("Error during old storage cleanup:", cleanupError);
        }
        console.info("Storage migration to native completed.");
        return true;
    }
    private async migrateDir(sourceDirHandleWrapper: RealFileSystemDir, targetDirHandle: FileSystemDirectoryHandle, onProgress: LoadProgressCallback): Promise<void> {
        for await (const entry of sourceDirHandleWrapper.getNativeHandle().values()) {
            onProgress(this.strings.get("TS:storage_migrating_file", `${targetDirHandle.name}/${entry.name}`));
            if (entry.kind === 'directory') {
                const targetSubDir = await targetDirHandle.getDirectoryHandle(entry.name, { create: true });
                const sourceSubDirWrapper = new RealFileSystemDir(entry as FileSystemDirectoryHandle);
                await this.migrateDir(sourceSubDirWrapper, targetSubDir, onProgress);
            }
            else if (entry.kind === 'file') {
                const cleanedName = entry.name.replace(/\u200f/g, "");
                const targetFileHandle = await targetDirHandle.getFileHandle(cleanedName, { create: true });
                const writable = await targetFileHandle.createWritable();
                const sourceFile = await (entry as FileSystemFileHandle).getFile();
                await sourceFile.stream().pipeTo(writable);
            }
        }
    }
    private async loadResources(rfs: RealFileSystem | undefined, config: GameResConfig, onProgress: LoadProgressCallback): Promise<CdnResourceLoader | undefined> {
        if (config.source === undefined) {
            throw new Error("GameResConfig source is undefined before initializing game resource source in Engine.");
        }
        Engine.initGameResSource(config.source);
        let cdnLoader: CdnResourceLoader | undefined;
        if (config.isCdn()) {
            const cdnBaseUrl = config.getCdnBaseUrl();
            if (!cdnBaseUrl)
                throw new Error("CDN base URL not available in config");
            const tempResourceLoader = new ResourceLoader(cdnBaseUrl);
            const manifest = await tempResourceLoader.loadJson("manifest.json");
            if (manifest.version !== 2) {
                throw new Error("Unknown manifest version " + manifest.version);
            }
            if (manifest.format !== "mix") {
                throw new Error("Unsupported CDN resource format " + manifest.format);
            }
            const cacheDirHandle = await Engine.getCacheDir();
            if (!cacheDirHandle) {
                console.warn("Cache directory handle not available, CDN resources might not be cached effectively.");
            }
            cdnLoader = new CdnResourceLoader(cdnBaseUrl, manifest, cacheDirHandle, rfs || new RealFileSystem());
        }
        else {
            if (!rfs) {
                throw new NoStorageError("No available storage adapters for local/archive resources.");
            }
            console.info("Checking integrity of mix files...");
            const rootDir = rfs.getRootDirectory();
            if (!rootDir)
                throw new Error("RFS root not available for mix integrity check");
            await this.checkMixesIntegrity(rootDir);
            console.info("Mixes are valid.");
        }
        const logger = AppLogger.get("vfs");
        logger.info("Initializing virtual filesystem...");
        const vfs = await Engine.initVfs(rfs, logger);
        await vfs.loadStandaloneFiles({
            exclude: ["keyboard.ini", "theme.ini"].map((fileName) => Engine.getFileNameVariant(fileName)),
        });
        await vfs.loadExtraMixFiles(Engine.getActiveEngine());
        await this.loadCustomMix(vfs);
        await this.loadMixes(config, cdnLoader, vfs, onProgress);
        await Engine.loadMapList();
        await this.initUiCssVariables(this.rootEl);
        return cdnLoader;
    }
    private async checkMixesIntegrity(rfsDir: RealFileSystemDir): Promise<void> {
        const mixesToVerify = new Map<string, string[]>([
            ["ra2.mix", ["E7BA3BE", "5DC70844", "D48F0E34"]],
            ["multi.mix", ["984EFDB6", "3CDB648F"]],
        ]);
        for (const [mixName, expectedCrcs] of mixesToVerify.entries()) {
            let file: File;
            let buffer: ArrayBuffer;
            try {
                file = await rfsDir.getRawFile(mixName, true);
                buffer = await file.arrayBuffer();
            }
            catch (e: any) {
                if (e instanceof VfsFileNotFoundError) {
                    throw new GameResFileNotFoundError(mixName);
                }
                if (e instanceof DOMException) {
                    const ioErr = new IOError(`Failed to read file (${e.name}) for CRC check`);
                    (ioErr as any).cause = e;
                    throw ioErr;
                }
                throw e;
            }
            const calculatedCrc = Crc32.calculateCrc(new Uint8Array(buffer));
            if (!expectedCrcs.includes(calculatedCrc.toString(16).toUpperCase())) {
                throw new ChecksumError(`Checksum mismatch for "${mixName}" (size: ${file.size}). ` +
                    `Checksum "${calculatedCrc.toString(16).toUpperCase()}" doesn't match known values: ${expectedCrcs.join(', ')}`, mixName);
            }
        }
    }
    private async loadCustomMix(vfs: VirtualFileSystem): Promise<void> {
        const resourceLoader = new ResourceLoader(this.appResPath);
        const mixDataBuffer = await resourceLoader.loadBinary(`ra2cd.mix?v=${this.appVersion}`);
        const mixFile = new MixFile(new DataStream(mixDataBuffer));
        vfs.addArchive(mixFile, "ra2cd.mix");
    }
    private async loadMixes(config: GameResConfig, cdnLoader: CdnResourceLoader | undefined, vfs: VirtualFileSystem, onProgress: LoadProgressCallback): Promise<void> {
        if (config.isCdn() && cdnLoader) {
            const cdnBaseUrl = config.getCdnBaseUrl();
            if (!cdnBaseUrl)
                throw new Error("CDN Load: Base URL missing.");
            onProgress(this.strings.get("TS:Downloading"), cdnBaseUrl + Engine.rfsSettings.splashImgFileName);
            const coreMixesToLoad: ResourceType[] = [
                ResourceType.Ini,
                ResourceType.Ui,
                ResourceType.Strings,
            ];
            const loadedCoreMixes = await cdnLoader.loadResources(coreMixesToLoad, undefined, (percent) => {
                onProgress(this.strings.get("TS:DownloadingPg", percent));
            });
            onProgress(this.strings.get("GUI:LoadingEx"));
            for (const resType of coreMixesToLoad) {
                const mixFileName = cdnLoader.getResourceFileName(resType);
                const mixData = loadedCoreMixes.pop(resType);
                if (mixData instanceof ArrayBuffer) {
                    const mixFile = new MixFile(new DataStream(mixData));
                    vfs.addArchive(mixFile, mixFileName);
                }
                else {
                    console.error(`Failed to load mix ${mixFileName} from CDN: incorrect data type.`);
                }
            }
        }
        else {
            await vfs.loadImplicitMixFiles(Engine.getActiveEngine());
            const cacheDirHandle = await Engine.getCacheDir();
            if (cacheDirHandle) {
                try {
                    await CdnResourceLoader.clearCache(new RealFileSystemDir(cacheDirHandle));
                }
                catch (e) {
                    if (!(e instanceof StorageQuotaError))
                        throw e;
                    console.warn("Could not clear CDN cache due to quota error:", e);
                }
            }
        }
    }
    private async initUiCssVariables(rootElement: HTMLElement): Promise<void> {
        const imagesToConvert: [
            string,
            string?
        ][] = [
            ["pudlgbgn.shp", "dialog.pal"],
            ["mnbttn.shp", "mainbttn.pal"],
            ["cue_i.pcx"],
            ["cce_i.pcx"],
            ["cce_il.pcx"],
            ["cce_ir.pcx"],
        ];
        if (!Engine.vfs)
            throw new Error("VFS not initialized for UI CSS Variables");
        const convertedImageBlobs = await this.convertImagesToPng(Engine.vfs, imagesToConvert);
        try {
            const menuLogoFile = Engine.vfs.openFile("menulogo.png");
            convertedImageBlobs.set("menulogo.png", menuLogoFile.asFile("image/png"));
        }
        catch (e) {
            console.warn('Failed to load menulogo.png from VFS for CSS variables', e);
        }
        try {
            const iconSpriteBlob = await this.generateIconSprite(Engine.vfs);
            if (iconSpriteBlob) {
                convertedImageBlobs.set("icons24.pcx", iconSpriteBlob);
            }
            else {
                console.warn('Icon sprite generation failed or returned null, not adding to CSS variables.');
            }
        }
        catch (e) {
            console.warn('Failed to generate icon sprite for CSS variables', e);
        }
        const cssVarMap: {
            [cssVar: string]: string;
        } = {
            "--res-menu-logo": "menulogo.png",
            "--res-icons-24": "icons24.pcx",
            "--res-dlg-bgn": "pudlgbgn.shp",
            "--res-mnbttn": "mnbttn.shp",
            "--res-cue-i": "cue_i.pcx",
            "--res-cce-i": "cce_i.pcx",
            "--res-cce-il": "cce_il.pcx",
            "--res-cce-ir": "cce_ir.pcx",
        };
        const blobUrlsToRevoke: string[] = [];
        for (const cssVar in cssVarMap) {
            const fileNameKey = cssVarMap[cssVar];
            const blob = convertedImageBlobs.get(fileNameKey);
            if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                blobUrlsToRevoke.push(blobUrl);
                rootElement.style.setProperty(cssVar, `url("${blobUrl}")`);
            }
            else {
                console.warn(`Image for CSS variable "${cssVar}" (file: "${fileNameKey}") not found.`);
            }
        }
    }
    private async loadSplashScreenBackground(rfsDir: RealFileSystemDir | undefined, modDir: RealFileSystemDir | undefined, config: GameResConfig): Promise<string | Blob | undefined> {
        const splashFileName = Engine.rfsSettings.splashImgFileName;
        if (config.isCdn()) {
            const cdnBaseUrl = config.getCdnBaseUrl();
            return cdnBaseUrl ? cdnBaseUrl + splashFileName : undefined;
        }
        let splashFile: File | undefined;
        if (modDir) {
            try {
                splashFile = await modDir.getRawFile(splashFileName, false, "image/png");
            }
            catch (e) {
                if (!(e instanceof VfsFileNotFoundError))
                    console.warn("Failed to load splash from mod dir", e);
            }
        }
        if (!splashFile && rfsDir) {
            try {
                splashFile = await rfsDir.getRawFile(splashFileName, false, "image/png");
            }
            catch (e) {
                if (!(e instanceof VfsFileNotFoundError))
                    console.warn("Failed to load splash from main game dir", e);
            }
        }
        return splashFile;
    }
    private async getBrowserFsHandle(preference: "native" | "fallback"): Promise<FileSystemDirectoryHandle> {
        const adaptersToTry: {
            name: string;
            module?: any;
        }[] = [];
        if (preference === "native" && this.fsAccessLib.support.adapter.native) {
            adaptersToTry.push({ name: "native", module: undefined });
        }
        if (preference === "fallback" || adaptersToTry.length === 0) {
            if (this.fsAccessLib.support.adapter.indexeddb) {
                adaptersToTry.push({ name: "indexeddb", module: this.fsAccessLib.adapters.indexeddb });
            }
            if (this.fsAccessLib.support.adapter.cache) {
                adaptersToTry.push({ name: "cache", module: this.fsAccessLib.adapters.cache });
            }
        }
        for (const adapterInfo of adaptersToTry) {
            try {
                console.info(`Loading storage adapter "${adapterInfo.name}"...`);
                const fsHandle = await this.fsAccessLib.getOriginPrivateDirectory(adapterInfo.module);
                try {
                    const testFile = await fsHandle.getFileHandle("_browsercheck.tmp", { create: true });
                    if (typeof testFile.createWritable !== 'function') {
                        throw new Error("createWritable is not supported on this file handle.");
                    }
                    const actualFile = await testFile.getFile();
                    if (actualFile.name !== testFile.name) {
                        console.warn("Browser check: FileHandle.name and File.name mismatch. Polyfill might be needed.");
                    }
                }
                catch (checkError: any) {
                    if (checkError.name === "QuotaExceededError") {
                        console.error(`Storage adapter "${adapterInfo.name}" failed browser check due to QuotaExceededError.`);
                        throw checkError;
                    }
                    else if (adapterInfo.name === "indexeddb" && checkError.name === "NotFoundError") {
                        console.warn("IndexedDB NotFoundError during browser check, attempting reset...");
                        await new Promise<void>(resolve => {
                            indexedDB.deleteDatabase("fileSystem");
                            this.localPrefs.removeItem(StorageKey.GameRes);
                            console.warn("Reloading page to attempt IndexedDB recovery...");
                            location.reload();
                        });
                    }
                    console.warn(`Browser check for adapter "${adapterInfo.name}" encountered an issue:`, checkError);
                }
                finally {
                    try {
                        await fsHandle.removeEntry("_browsercheck.tmp");
                    }
                    catch {
                    }
                }
                console.info(`Storage adapter "${adapterInfo.name}" loaded successfully.`);
                return fsHandle;
            }
            catch (e: any) {
                console.warn(`Couldn't load FS adapter "${adapterInfo.name}"`, e);
            }
        }
        throw new NoStorageError("No available/functional FS adapters found.");
    }
    private async convertImagesToPng(vfs: VirtualFileSystem, imageDefs: [
        string,
        string?
    ][]): Promise<Map<string, Blob>> {
        const results = new Map<string, Blob>();
        for (const [fileName, paletteName] of imageDefs) {
            let imageBlob: Blob | undefined;
            try {
                if (fileName.endsWith(".shp")) {
                    const shpFile = vfs.openFile(fileName);
                    const shpFileInstance = new ShpFile(shpFile);
                    if (!paletteName) {
                        throw new Error(`No palette specified for SHP image "${fileName}"`);
                    }
                    const palFile = vfs.openFile(paletteName);
                    const paletteInstance = new Palette(palFile);
                    imageBlob = await ImageUtils.convertShpToPng(shpFileInstance, paletteInstance);
                }
                else if (fileName.endsWith(".pcx")) {
                    const pcxFile = vfs.openFile(fileName);
                    const pcxFileInstance = new PcxFile(pcxFile);
                    imageBlob = await pcxFileInstance.toPngBlob();
                }
                else {
                    console.warn(`Unknown image type for conversion: "${fileName}"`);
                    continue;
                }
                if (imageBlob) {
                    results.set(fileName, imageBlob);
                }
            }
            catch (e) {
                console.error(`Failed to convert image "${fileName}":`, e);
            }
        }
        return results;
    }
    private async generateIconSprite(vfs: VirtualFileSystem): Promise<Blob | null> {
        const iconFiles = [
            "wouref.pcx", "wodref.pcx", "wouact.pcx", "wodact.pcx",
            "dnarrowr.pcx", "dnarrowp.pcx", "uparrowr.pcx", "uparrowp.pcx",
            "sbgript.pcx", "sbgripm.pcx", "sbgripb.pcx", "trakgrip.pcx",
        ];
        const pcxFiles: PcxFile[] = [];
        for (const fileName of iconFiles) {
            try {
                const virtualFile = vfs.openFile(fileName);
                pcxFiles.push(new PcxFile(virtualFile));
            }
            catch (e) {
                console.error(`Failed to load PCX for icon sprite: ${fileName}`, e);
            }
        }
        if (pcxFiles.length === 0)
            throw new Error("No PCX files loaded for icon sprite generation");
        const iconSize = 24;
        const finalBitmap = new RgbaBitmap(iconSize * pcxFiles.length, iconSize);
        for (let i = 0; i < pcxFiles.length; i++) {
            const pcx = pcxFiles[i];
            if (pcx.width && pcx.height && pcx.data) {
                const iconBitmap = new RgbaBitmap(pcx.width, pcx.height, pcx.data);
                finalBitmap.drawRgbaImage(iconBitmap, iconSize * i, 0, iconSize, iconSize);
            }
            else {
                console.warn(`PCX file ${iconFiles[i]} missing data/dimensions for icon sprite.`);
            }
        }
        const canvas = CanvasUtils.canvasFromRgbaImageData(finalBitmap.data, finalBitmap.width, finalBitmap.height);
        return await CanvasUtils.canvasToBlob(canvas, "image/png");
    }
}
