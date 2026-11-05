import { MixFile } from '../../data/MixFile';
import { Engine, EngineType } from '../Engine';
import { sleep } from '../../util/time';
import { ChecksumError } from './importError/ChecksumError';
import { FileNotFoundError as GameResFileNotFoundError } from './importError/FileNotFoundError';
import { ArchiveExtractionError } from './importError/ArchiveExtractionError';
import { VirtualFile } from '../../data/vfs/VirtualFile';
import { mixDatabase } from '../mixDatabase';
import { Palette } from '../../data/Palette';
import { ShpFile } from '../../data/ShpFile';
import { ImageUtils } from '../gfx/ImageUtils';
import * as stringUtils from '../../util/string';
import { VideoConverter } from './VideoConverter';
import { InvalidArchiveError } from './importError/InvalidArchiveError';
import { FileNotFoundError as VfsFileNotFoundError } from '../../data/vfs/FileNotFoundError';
import { IOError } from '../../data/vfs/IOError';
import { RealFileSystemDir } from '../../data/vfs/RealFileSystemDir';
import { NoWebAssemblyError } from './importError/NoWebAssemblyError';
import { HttpRequest, DownloadError } from '../../network/HttpRequest';
import { ArchiveDownloadError } from './importError/ArchiveDownloadError';
import type { Config } from '../../Config';
import type { Strings } from '../../data/Strings';
import type { DataStream } from '../../data/DataStream';
import type { FFmpeg } from '@ffmpeg/ffmpeg';
interface SevenZipWasmModule {
    FS: any;
    callMain: (args: string[]) => void;
}
interface SevenZipWasmOptions {
    quit?: (code: number, message?: string) => void;
}
declare function createSevenZipWasm(options?: SevenZipWasmOptions): Promise<SevenZipWasmModule>;
const REQUIRED_MIX_SIZES = new Map<string, number>()
    .set("ra2.mix", 281895456)
    .set("language.mix", 53116040)
    .set("multi.mix", 25856283)
    .set("theme.mix", 76862662);
function formatMib(bytes: number): number {
    return bytes / 1024 / 1024;
}
function wrapFsOpen(originalFsOpen: any, prefilledContents: Map<string, Uint8Array>) {
    return function (this: any, path: string, flags: string, mode?: any, unknown1?: any, unknown2?: any) {
        let stream = originalFsOpen.call(this, path, flags, mode, unknown1, unknown2);
        const prefilledData = prefilledContents.get(stream.node.name);
        if (prefilledData) {
            stream.node.contents = new Uint8Array(prefilledData);
            const originalWrite = stream.stream_ops.write;
            stream.stream_ops = { ...stream.stream_ops };
            stream.stream_ops.write = function (this: any, str: any, buffer: any, offset: number, length: number, position?: number, canOwn?: boolean) {
                if (!position) {
                    str.node.usedBytes = str.node.contents.byteLength;
                }
                const bytesWritten = originalWrite.call(this, str, buffer, offset, length, position, canOwn);
                if (!position) {
                    str.node.usedBytes = bytesWritten;
                }
                return bytesWritten;
            };
        }
        return stream;
    };
}
export type ImportProgressCallback = (text?: string, backgroundImage?: Blob | string) => void;
export type ImportSource = URL | File | FileSystemDirectoryHandle | FileSystemFileHandle;
export class GameResImporter {
    private appConfig: Config;
    private strings: Strings;
    private sentry?: any;
    constructor(appConfig: Config, strings: Strings, sentry?: any) {
        this.appConfig = appConfig;
        this.strings = strings;
        this.sentry = sentry;
    }
    async import(source: ImportSource | undefined, targetRfsRootDir: RealFileSystemDir, onProgress: ImportProgressCallback): Promise<void> {
        const essentialMixes = ["ra2.mix", "language.mix", "multi.mix", "theme.mix"];
        const optionalMixes = new Set(["theme.mix"]);
        const tauntsDirName = Engine.rfsSettings.tauntsDir;
        const S = this.strings;
        console.log('[GameResImporter] Starting import process');
        console.log('[GameResImporter] Source:', source);
        console.log('[GameResImporter] WebAssembly available:', typeof WebAssembly);
        console.log('[GameResImporter] Dynamic import supported: true');
        onProgress(S.get("ts:import_preparing_for_import"));
        if (!source) {
            throw new Error("Import source is undefined.");
        }
        if (source instanceof URL || source instanceof File || (source as any).kind === "file") {
            console.log('[GameResImporter] Processing archive file');
            if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
                throw new NoWebAssemblyError("WebAssembly is not available or not an object.");
            }
            console.log('[GameResImporter] WebAssembly check passed');
            let sevenZipModule: SevenZipWasmModule;
            let sevenZipExitCode: number | undefined;
            let sevenZipErrorMessage: string | undefined;
            try {
                console.log('[GameResImporter] Attempting to load 7z-wasm module');
                const sevenZipWasmModule = await import("7z-wasm");
                const sevenZipFactory = sevenZipWasmModule.default as any;
                console.log('[GameResImporter] 7z-wasm module loaded, creating instance');
                sevenZipModule = await sevenZipFactory({
                    locateFile: (path: string, scriptDirectory: string) => {
                        if (path === '7zz.wasm') {
                            return '/7zz.wasm';
                        }
                        return path;
                    },
                    quit: (code: number, exitStatus: any) => {
                        sevenZipExitCode = code;
                        sevenZipErrorMessage = exitStatus?.message || String(exitStatus);
                        console.log('[GameResImporter] 7z quit callback:', code, exitStatus);
                    },
                });
                console.log('[GameResImporter] 7z-wasm instance created successfully');
            }
            catch (e: any) {
                console.error('[GameResImporter] Failed to load/create 7z-wasm:', e);
                if (e.message?.match(/Load failed|Failed to fetch/i)) {
                    const error = new DownloadError("Failed to load 7z-wasm module");
                    (error as any).originalError = e;
                    throw error;
                }
                if (e instanceof WebAssembly.RuntimeError) {
                    const error = new IOError("Couldn't load 7z-wasm due to runtime error");
                    (error as any).originalError = e;
                    throw error;
                }
                throw e;
            }
            let archiveData: Uint8Array;
            let archiveName: string;
            if (source instanceof URL) {
                let downloadedBytes = 0;
                const urlStr = source.toString();
                const corsProxy = this.appConfig.getCorsProxy?.(source.hostname);
                let effectiveUrl = urlStr;
                if (corsProxy) {
                    effectiveUrl = `${corsProxy}${encodeURIComponent(urlStr)}`;
                }
                try {
                    const buffer = await new HttpRequest().fetchBinary(effectiveUrl, undefined, {
                        onProgress: (delta, total) => {
                            downloadedBytes += delta;
                            const progressText = total
                                ? S.get("ts:downloadingpgsize", formatMib(downloadedBytes), formatMib(total), (downloadedBytes / total) * 100)
                                : S.get("ts:downloadingpgunkn", formatMib(downloadedBytes));
                            onProgress(progressText);
                        },
                    });
                    archiveData = new Uint8Array(buffer);
                    archiveName = source.pathname.split('/').pop() || "archive.7z";
                }
                catch (e: any) {
                    if (downloadedBytes === 0 && e instanceof DownloadError) {
                        const error = new ArchiveDownloadError(urlStr, "Archive download failed at start");
                        (error as any).originalError = e;
                        throw error;
                    }
                    throw e;
                }
            }
            else if (source instanceof File) {
                archiveData = new Uint8Array(await source.arrayBuffer());
                archiveName = source.name;
            }
            else {
                const fileHandle = source as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                archiveData = new Uint8Array(await file.arrayBuffer());
                archiveName = file.name;
            }
            onProgress(S.get("ts:import_loading_archive"));
            sevenZipModule.FS.chdir("/tmp");
            try {
                const fileStream = sevenZipModule.FS.open(archiveName, "w+");
                sevenZipModule.FS.write(fileStream, archiveData, 0, archiveData.byteLength, 0, true);
                sevenZipModule.FS.close(fileStream);
            }
            catch (e: any) {
                if (e instanceof DOMException) {
                    const error = new IOError(`Could not write archive to Emscripten FS "${archiveName}" (${e.name})`);
                    (error as any).originalError = e;
                    throw error;
                }
                throw e;
            }
            const entriesToExtract = [...essentialMixes, tauntsDirName];
            for (const entryName of entriesToExtract) {
                onProgress(S.get("ts:import_extracting", entryName));
                await sleep(100);
                sevenZipExitCode = undefined;
                sevenZipErrorMessage = undefined;
                sevenZipModule.callMain(["x", "-ssc-", "-aoa", archiveName, entryName]);
                if (sevenZipExitCode !== 0 && sevenZipExitCode !== undefined) {
                    if (sevenZipExitCode === 1 && entryName === tauntsDirName) {
                        console.warn(`Taunts directory "${entryName}" not found in archive, or non-fatal extraction issue. Skipping.`);
                    }
                    else if (sevenZipExitCode === 1 && optionalMixes.has(entryName)) {
                        console.warn(`Optional mix file "${entryName}" not found in archive or non-fatal extraction issue. Skipping.`);
                    }
                    else {
                        const baseErrorMsg = `7-Zip exited with code ${sevenZipExitCode} for ${entryName}`;
                        if (sevenZipErrorMessage?.match(/out of memory|allocation/i)) {
                            const error = new RangeError(`${baseErrorMsg} - Out of memory`);
                            (error as any).originalError = new Error(sevenZipErrorMessage);
                            throw error;
                        }
                        const error = new ArchiveExtractionError(`${baseErrorMsg}`);
                        (error as any).originalError = new Error(sevenZipErrorMessage);
                        throw error;
                    }
                }
                const emFsCurrentDirContents = sevenZipModule.FS.lookupPath(sevenZipModule.FS.cwd())["node"].contents;
                const extractedEntryNames = Object.keys(emFsCurrentDirContents);
                if (entryName !== tauntsDirName) {
                    const mixFileNameInFs = extractedEntryNames.find(name => stringUtils.equalsIgnoreCase(name, entryName)) || entryName;
                    onProgress(S.get("ts:import_importing", mixFileNameInFs));
                    let fileData;
                    try {
                        fileData = this.readFileFromEmFs(sevenZipModule.FS, mixFileNameInFs);
                        sevenZipModule.FS.unlink(mixFileNameInFs);
                    }
                    catch (e: any) {
                        if (e.errno === 44 && optionalMixes.has(entryName)) {
                            console.warn(`Optional Mix file "${entryName}" not found in Emscripten FS after extraction. Skipping.`);
                            continue;
                        }
                        if (e.errno === 44 && !REQUIRED_MIX_SIZES.has(entryName.toLowerCase())) {
                            console.warn(`File "${entryName}" not found in Emscripten FS and not strictly required. Skipping.`);
                            continue;
                        }
                        throw new GameResFileNotFoundError(entryName);
                    }
                    await this.importMixArchive(fileData, targetRfsRootDir, onProgress, S);
                }
                else {
                    const tauntsDirInFs = extractedEntryNames.find(name => stringUtils.equalsIgnoreCase(name, tauntsDirName));
                    if (tauntsDirInFs) {
                        const tauntsDirNode = sevenZipModule.FS.lookupPath(tauntsDirInFs)["node"];
                        const tauntFileNames = Object.keys(tauntsDirNode.contents).map(name => `${tauntsDirInFs}/${name}`);
                        try {
                            const targetTauntsDir = await targetRfsRootDir.getOrCreateDirectory(tauntsDirName, true);
                            for (const tauntFilePath of tauntFileNames) {
                                onProgress(S.get("ts:import_importing", tauntFilePath));
                                const fileData = this.readFileFromEmFs(sevenZipModule.FS, tauntFilePath);
                                sevenZipModule.FS.unlink(tauntFilePath);
                                await targetTauntsDir.writeFile(fileData);
                            }
                        }
                        catch (e: any) {
                            if (!(e instanceof DOMException || e instanceof IOError || e.errno === 44))
                                throw e;
                            console.warn("Failed to copy taunts folder. Skipping.", e);
                        }
                    }
                    else {
                        console.warn("Taunts folder not found in archive after extraction. Skipping.");
                    }
                }
            }
            sevenZipModule.FS.unlink(archiveName);
            try {
                await targetRfsRootDir.openFile("ra2.mix");
            }
            catch (e) {
                if (e instanceof VfsFileNotFoundError || e instanceof IOError) {
                    onProgress(this.strings.get("GUI:LoadingEx"));
                    console.error("Essential file ra2.mix not found after import. Reloading might be necessary.");
                    throw new Error("Import verification failed: ra2.mix not found.");
                }
                throw e;
            }
        }
        else {
            const sourceDirWrapper = new RealFileSystemDir(source as FileSystemDirectoryHandle, true);
            const sourceEntries = await sourceDirWrapper.listEntries();
            for (const mixName of essentialMixes) {
                onProgress(S.get("ts:import_importing", mixName));
                const actualFileName = sourceEntries.find(entry => stringUtils.equalsIgnoreCase(entry, mixName)) || mixName;
                let virtualFile;
                try {
                    virtualFile = await sourceDirWrapper.openFile(actualFileName);
                }
                catch (e: any) {
                    if (e instanceof VfsFileNotFoundError) {
                        if (optionalMixes.has(mixName)) {
                            console.warn(`Optional Mix file "${mixName}" not found in source directory. Skipping.`);
                            continue;
                        }
                        throw new GameResFileNotFoundError(mixName);
                    }
                    throw e;
                }
                await this.importMixArchive(virtualFile, targetRfsRootDir, onProgress, S);
            }
            const tauntsDirInSource = sourceEntries.find(entry => stringUtils.equalsIgnoreCase(entry, tauntsDirName)) || tauntsDirName;
            let sourceTauntsDir: RealFileSystemDir | undefined;
            try {
                sourceTauntsDir = await sourceDirWrapper.getDirectory(tauntsDirInSource);
            }
            catch (e: any) {
                if (!(e instanceof VfsFileNotFoundError || e instanceof IOError))
                    throw e;
                console.warn(`Taunts directory "${tauntsDirInSource}" not found in source (${e.name}). Skipping.`);
            }
            if (sourceTauntsDir) {
                try {
                    const targetTauntsRfsDir = await targetRfsRootDir.getOrCreateDirectory(tauntsDirName, true);
                    for await (const rawFile of sourceTauntsDir.getRawFiles()) {
                        onProgress(S.get("ts:import_importing", `${targetTauntsRfsDir.name}/${rawFile.name}`));
                        const virtualFile = await VirtualFile.fromRealFile(rawFile);
                        await targetTauntsRfsDir.writeFile(virtualFile);
                    }
                }
                catch (e: any) {
                    if (!(e instanceof IOError))
                        throw e;
                    console.warn("Failed to copy taunts folder from source. Skipping.", e);
                }
            }
        }
        onProgress("Game assets successfully imported.");
    }
    private readFileFromEmFs(emFs: any, filePath: string): VirtualFile {
        emFs.chmod(filePath, 0o700);
        const fileNode = emFs.lookupPath(filePath)["node"];
        if (!fileNode || !fileNode.contents) {
            throw new VfsFileNotFoundError(`File node or contents missing in Emscripten FS for ${filePath}`);
        }
        const fileData = fileNode.contents.subarray(0, fileNode.usedBytes);
        const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
        return VirtualFile.fromBytes(fileData, fileName);
    }
    private async importMixArchive(mixVirtualFile: VirtualFile, targetRfsRootDir: RealFileSystemDir, onProgress: ImportProgressCallback, S: Strings): Promise<void> {
        const mixFileNameLower = mixVirtualFile.filename.toLowerCase();
        const isThemeMix = !!mixFileNameLower.match(/^theme[^.]*\.mix$/);
        if (mixVirtualFile.getSize() === 0) {
            if (isThemeMix) {
                console.warn(`Mix file ${mixVirtualFile.filename} is empty. Skipping theme import.`);
                return;
            }
            throw new ChecksumError(`Mix file "${mixFileNameLower}" is empty`, mixFileNameLower);
        }
        if (!isThemeMix) {
            await targetRfsRootDir.writeFile(mixVirtualFile, mixFileNameLower);
        }
        if (isThemeMix) {
            const musicDirName = Engine.rfsSettings.musicDir;
            const targetMusicDir = await targetRfsRootDir.getOrCreateDirectory(musicDirName, true);
            await this.importMusic(mixVirtualFile, targetMusicDir, (percent) => onProgress(S.get("ts:import_importing_pg", mixFileNameLower, percent.toFixed(0))));
        }
        else if (mixFileNameLower.match(/language\.mix$/)) {
            onProgress(S.get("ts:import_importing_long", mixFileNameLower));
            await this.importVideo(mixVirtualFile, targetRfsRootDir);
        }
        else if (mixFileNameLower.match(/ra2\.mix$/)) {
            const splashImageBlob = await this.importSplashImage(mixVirtualFile, targetRfsRootDir);
            if (splashImageBlob)
                onProgress(undefined, splashImageBlob);
        }
    }
    private async importMusic(mixVirtualFile: VirtualFile, targetMusicDir: RealFileSystemDir, onProgressPercent: (percent: number) => void): Promise<void> {
        let mixFileInstance: MixFile;
        try {
            mixFileInstance = new MixFile(mixVirtualFile.stream as DataStream);
        }
        catch (e) {
            console.warn(`Failed to read music mix archive "${mixVirtualFile.filename}". Skipping.`, e);
            return;
        }
        const knownMusicFiles = mixDatabase.get(mixVirtualFile.filename.toLowerCase());
        if (!knownMusicFiles) {
            console.warn(`File "${mixVirtualFile.filename}" not found in mix database. Skipping music import.`);
            return;
        }
        const totalFiles = knownMusicFiles.length;
        let processedFiles = 0;
        for (const wavFileNameInMix of knownMusicFiles) {
            processedFiles++;
            onProgressPercent((processedFiles / totalFiles) * 100);
            if (!wavFileNameInMix.toLowerCase().endsWith('.wav')) {
                console.warn(`Music file "${wavFileNameInMix}" in mix ${mixVirtualFile.filename} is not a WAV file. Skipping.`);
                continue;
            }
            const mp3FileName = wavFileNameInMix.replace(/\.wav$/i, ".mp3");
            if (mixFileInstance.containsFile(wavFileNameInMix)) {
                const wavFileEntry = mixFileInstance.openFile(wavFileNameInMix);
                if (wavFileEntry.stream.byteLength > 0) {
                    let mp3Data: Uint8Array | undefined;
                    try {
                        const ffmpeg = await this.createFFmpeg();
                        const wavData = new Uint8Array(wavFileEntry.stream.buffer, wavFileEntry.stream.byteOffset, wavFileEntry.stream.byteLength);
                        await ffmpeg.writeFile(wavFileNameInMix, wavData);
                        await ffmpeg.exec(["-i", wavFileNameInMix, "-vn", "-ar", "22050", "-q:a", "5", mp3FileName]);
                        mp3Data = await ffmpeg.readFile(mp3FileName) as Uint8Array;
                        await ffmpeg.deleteFile(wavFileNameInMix);
                        await ffmpeg.deleteFile(mp3FileName);
                    }
                    catch (e) {
                        console.warn(`Failed to convert music file "${wavFileNameInMix}" to MP3. Skipping.`, e);
                        this.sentry?.captureException(new Error(`FFmpeg conversion failed for ${wavFileNameInMix}`), { extra: { error: e } });
                        continue;
                    }
                    if (mp3Data) {
                        const mp3Blob = new Blob([mp3Data as any], { type: "audio/mpeg" });
                        try {
                            const virtualMp3 = VirtualFile.fromBytes(mp3Data, mp3FileName);
                            await targetMusicDir.writeFile(virtualMp3);
                        }
                        catch (e) {
                            console.warn(`Failed to write music file "${mp3FileName}" to target. Skipping.`, e);
                        }
                    }
                }
                else {
                    console.warn(`Music file "${wavFileNameInMix}" is empty in the mix archive. Skipping.`);
                }
            }
            else {
                console.warn(`Music file "${wavFileNameInMix}" was not found in mix archive "${mixVirtualFile.filename}". Skipping.`);
            }
        }
    }
    private async importVideo(languageMixVirtualFile: VirtualFile, targetRfsRootDir: RealFileSystemDir): Promise<void> {
        let ffmpeg: FFmpeg;
        try {
            ffmpeg = await this.createFFmpeg();
        }
        catch (e: any) {
            if (e.message?.match(/Load failed|Failed to fetch/i)) {
                const error = new DownloadError("Failed to load FFmpeg for video conversion");
                (error as any).originalError = e;
                throw error;
            }
            this.sentry?.captureException(new Error("FFmpeg creation failed for video import"));
            console.error("Skipping video import due to FFmpeg creation failure.", e);
            return;
        }
        const langMix = new MixFile(languageMixVirtualFile.stream as DataStream);
        console.log('[GameResImporter] language.mix loaded, checking detailed contents...');
        console.log('[GameResImporter] File size:', languageMixVirtualFile.getSize(), 'bytes');
        console.log('[GameResImporter] MixFile index size:', (langMix as any).index?.size || 'unknown');
        if ((langMix as any).index) {
            const index = (langMix as any).index as Map<number, any>;
            console.log('[GameResImporter] language.mix index entries (first 20):');
            let entryCount = 0;
            for (const [hash, entry] of index.entries()) {
                entryCount++;
                console.log(`[GameResImporter]   Entry ${entryCount}: hash=0x${hash.toString(16).toUpperCase()}, offset=${entry.offset}, length=${entry.length}`);
                if (entryCount >= 20) {
                    console.log(`[GameResImporter]   ... and ${index.size - 20} more entries`);
                    break;
                }
            }
        }
        const binkFileName = "ra2ts_l.bik";
        const webmFileName = Engine.rfsSettings.menuVideoFileName;
        const videoFileVariants = [
            'ra2ts_l.bik', 'RA2TS_L.BIK', 'Ra2ts_l.bik', 'RA2TS_L.bik'
        ];
        console.log('[GameResImporter] Testing video file variants:');
        let foundVideoFile = false;
        let actualVideoFileName = binkFileName;
        for (const variant of videoFileVariants) {
            const exists = langMix.containsFile(variant);
            console.log(`[GameResImporter]   "${variant}" exists: ${exists}`);
            if (exists && !foundVideoFile) {
                foundVideoFile = true;
                actualVideoFileName = variant;
            }
        }
        if (!foundVideoFile) {
            console.warn(`Video file "${binkFileName}" not found in ${languageMixVirtualFile.filename}, skipping menu video import`);
            return;
        }
        console.log(`[GameResImporter] Using video file: "${actualVideoFileName}"`);
        const binkFileEntry = langMix.openFile(actualVideoFileName);
        let webmBuffer: Uint8Array;
        try {
            webmBuffer = await new VideoConverter().convertBinkVideo(ffmpeg, binkFileEntry);
        }
        catch (e) {
            this.sentry?.captureException(new Error(`Bink to WebM conversion failed for ${actualVideoFileName}`), { extra: { error: e } });
            console.error("Bink video conversion failed, skipping menu video.", e);
            return;
        }
        const webmBlob = new Blob([webmBuffer as any], { type: "video/webm" });
        const virtualWebmFile = VirtualFile.fromBytes(webmBuffer, webmFileName);
        await targetRfsRootDir.writeFile(virtualWebmFile);
    }
    private async createFFmpeg(): Promise<FFmpeg> {
        const ffmpegModule = await import("@ffmpeg/ffmpeg");
        const FFmpegClass = ffmpegModule.FFmpeg;
        if (typeof FFmpegClass !== 'function') {
            console.error('[GameResImporter] FFmpeg class is not available:', typeof FFmpegClass);
            throw new Error('FFmpeg class is not available from @ffmpeg/ffmpeg module');
        }
        const ffmpeg = new FFmpegClass();
        const originalDefine = (window as any).define;
        (window as any).define = undefined;
        try {
            await ffmpeg.load();
        }
        finally {
            (window as any).define = originalDefine;
        }
        return ffmpeg;
    }
    private async importSplashImage(ra2MixVirtualFile: VirtualFile, targetRfsRootDir: RealFileSystemDir): Promise<Blob | undefined> {
        console.log('[GameResImporter] Starting splash image import from ra2.mix...');
        const ra2Mix = new MixFile(ra2MixVirtualFile.stream as DataStream);
        if (!ra2Mix.containsFile("local.mix")) {
            throw new GameResFileNotFoundError("local.mix");
        }
        console.log('[GameResImporter] Found local.mix, opening...');
        const localMixFile = ra2Mix.openFile("local.mix");
        const localMix = new MixFile(localMixFile.stream);
        if (!localMix.containsFile("glsl.shp")) {
            throw new GameResFileNotFoundError("glsl.shp");
        }
        if (!localMix.containsFile("gls.pal")) {
            throw new GameResFileNotFoundError("gls.pal");
        }
        console.log('[GameResImporter] Found glsl.shp and gls.pal, extracting...');
        const glslShpFile = localMix.openFile("glsl.shp");
        const glsPalFile = localMix.openFile("gls.pal");
        console.log('[GameResImporter] Parsing SHP and palette...');
        const shpFile = new ShpFile(glslShpFile);
        const palette = new Palette(glsPalFile);
        console.log('[GameResImporter] Converting SHP to PNG...');
        const pngBlob = await ImageUtils.convertShpToPng(shpFile, palette);
        const splashImgFileName = Engine.rfsSettings.splashImgFileName;
        console.log(`[GameResImporter] Creating file "${splashImgFileName}" for RFS...`);
        let splashFile: File | undefined;
        try {
            splashFile = new File([pngBlob], splashImgFileName, { type: pngBlob.type });
        }
        catch (e) {
            console.error('[GameResImporter] Failed to create splash image file. Skipping.', e);
            this.sentry?.captureException(new Error(`Failed to create splash image file (type=${pngBlob.type})`), { extra: { error: e } });
        }
        if (splashFile) {
            console.log(`[GameResImporter] Writing "${splashImgFileName}" to RFS...`);
            const virtualSplashFile = VirtualFile.fromBytes(new Uint8Array(await splashFile.arrayBuffer()), splashImgFileName);
            await targetRfsRootDir.writeFile(virtualSplashFile);
            console.log(`[GameResImporter] ✅ Successfully wrote "${splashImgFileName}" to RFS`);
        }
        return pngBlob;
    }
}
