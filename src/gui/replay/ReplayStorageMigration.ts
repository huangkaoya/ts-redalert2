import { Replay } from '../../network/gamestate/Replay';
import { ReplayStorageFileSystem } from './ReplayStorageFileSystem';
import { ReplayMeta } from './ReplayMeta';
declare const THREE: {
    MathUtils: {
        generateUUID(): string;
    };
};
interface SplashScreen {
    setLoadingText(text: string): void;
}
interface Strings {
    get(key: string, value?: number): string;
}
interface LocalPrefs {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    listItems(): string[];
}
interface VirtualFileSystemDirectory {
    containsEntry(fileName: string): Promise<boolean>;
    openFile(fileName: string): Promise<VirtualFile>;
    writeFile(file: VirtualFile): Promise<void>;
    deleteFile(fileName: string): Promise<void>;
    getEntries(): AsyncIterable<string>;
}
interface VirtualFile {
    readAsString(encoding: string): string;
    filename: string;
}
interface OldReplayMeta {
    id: string;
    name: string;
    keep: boolean;
    timestamp: number;
}
export class ReplayStorageMigration {
    public static readonly migratedMarker = '_r_replays_migrated';
    constructor(private splashScreen: SplashScreen, private strings: Strings, private replayDir: VirtualFileSystemDirectory, private localPrefs: LocalPrefs, private storageFileSystem: ReplayStorageFileSystem) { }
    async migrate(): Promise<void> {
        if (Number(this.localPrefs.getItem(ReplayStorageMigration.migratedMarker) || 0) !== 4) {
            console.info('Running replay storage migrations...');
            await this.runMigrationTo4();
            this.localPrefs.setItem(ReplayStorageMigration.migratedMarker, '4');
            console.info('Migrations finished.');
        }
    }
    private async runMigrationTo4(): Promise<void> {
        this.localPrefs.removeItem('_r_replayList');
        for (const item of this.localPrefs.listItems()) {
            if (item.startsWith('_r_replay_')) {
                this.localPrefs.removeItem(item);
            }
        }
        const replayDir = this.replayDir;
        const oldManifestName = 'replays.json';
        if (await replayDir.containsEntry(oldManifestName)) {
            if (await replayDir.containsEntry(ReplayStorageFileSystem.manifestFileName)) {
                await replayDir.deleteFile(oldManifestName);
            }
            else {
                const oldManifestContent = (await replayDir.openFile(oldManifestName)).readAsString('utf-8');
                let oldManifest: OldReplayMeta[] = [];
                try {
                    oldManifest = JSON.parse(oldManifestContent);
                }
                catch (error) {
                }
                if (oldManifest.length > 0) {
                    this.splashScreen.setLoadingText(this.strings.get('ts:replay_storage_migrating', 0));
                    const newManifest: ReplayMeta[] = [];
                    const existingFiles = new Set<string>();
                    for await (const entry of replayDir.getEntries()) {
                        if (Replay.supportedExtensions.some((extension) => entry.toLowerCase().endsWith(extension))) {
                            existingFiles.add(entry);
                        }
                    }
                    const fileRenames = new Map<string, string>();
                    const usedNames = new Set<string>();
                    for (const oldEntry of oldManifest) {
                        const oldFileName = Replay.supportedExtensions
                            .map((extension) => 'replay_' + oldEntry.id + extension)
                            .find((fileName) => existingFiles.has(fileName));
                        if (oldFileName) {
                            const newEntry: ReplayMeta = {
                                id: THREE.MathUtils.generateUUID(),
                                name: Replay.sanitizeFileName(oldEntry.name),
                                keep: oldEntry.keep,
                                timestamp: oldEntry.timestamp,
                            };
                            newManifest.push(newEntry);
                            let newFileName = this.storageFileSystem.getReplayFileName(newEntry);
                            let counter = 1;
                            while (usedNames.has(newFileName.toLowerCase())) {
                                let baseName = newFileName.replace(Replay.extension, '');
                                if (counter > 1) {
                                    baseName = baseName.replace(/ \(\d+\)$/, '');
                                }
                                newFileName = baseName + ` (${++counter})` + Replay.extension;
                            }
                            if (counter > 1) {
                                newEntry.name += ` (${counter})`;
                            }
                            fileRenames.set(oldFileName, newFileName);
                            usedNames.add(newFileName.toLowerCase());
                        }
                    }
                    await replayDir.deleteFile(oldManifestName);
                    try {
                        let processed = 0;
                        const total = fileRenames.size;
                        for (const [oldName, newName] of fileRenames) {
                            const file = await replayDir.openFile(oldName);
                            (file as any).filename = newName;
                            await replayDir.writeFile(file as any);
                            await replayDir.deleteFile(oldName);
                            this.splashScreen.setLoadingText(this.strings.get('ts:replay_storage_migrating', Math.floor((++processed / total) * 100)));
                        }
                        await this.storageFileSystem.saveManifest(newManifest);
                    }
                    catch (error) {
                        console.error(error);
                    }
                }
                else {
                    await replayDir.deleteFile(oldManifestName);
                }
            }
        }
    }
}
