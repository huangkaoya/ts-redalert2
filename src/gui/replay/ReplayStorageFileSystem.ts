import { VirtualFile } from '../../data/vfs/VirtualFile';
import { DataStream } from '../../data/DataStream';
import { StorageQuotaError } from '../../data/vfs/StorageQuotaError';
import { Replay } from '../../network/gamestate/Replay';
import { ReplayStorageError } from './ReplayStorageError';
import { ReplayMeta } from './ReplayMeta';
declare const THREE: {
    MathUtils: {
        generateUUID(): string;
    };
};
interface VirtualFileSystemDirectory {
    containsEntry(fileName: string): Promise<boolean>;
    openFile(fileName: string): Promise<VirtualFile>;
    writeFile(file: VirtualFile): Promise<void>;
    deleteFile(fileName: string): Promise<void>;
    getEntries(): AsyncIterable<string>;
    getRawFiles(): AsyncIterable<{
        name: string;
        lastModified: number;
    }>;
    getRawFile(fileName: string): Promise<string>;
}
interface SentryService {
    captureException(error: Error, callback?: (event: any) => any): void;
}
export class ReplayStorageFileSystem {
    public static readonly manifestFileName = '_index.json';
    public static readonly unsavedReplayPrefix = 'Unsaved_';
    constructor(private dir: VirtualFileSystemDirectory, private sentry?: SentryService) { }
    async getManifest(rebuild: boolean = false): Promise<ReplayMeta[]> {
        if (rebuild) {
            return await this.rebuildManifest();
        }
        if (!(await this.dir.containsEntry(ReplayStorageFileSystem.manifestFileName))) {
            return [];
        }
        const manifestContent = (await this.dir.openFile(ReplayStorageFileSystem.manifestFileName)).readAsString('utf-8');
        if (!manifestContent.length) {
            return [];
        }
        try {
            return JSON.parse(manifestContent);
        }
        catch (error) {
            console.error('Replay manifest is corrupt', error);
            this.sentry?.captureException(error as Error, (event) => {
                event.addAttachment({
                    filename: ReplayStorageFileSystem.manifestFileName,
                    data: manifestContent,
                });
                return event;
            });
            await this.deleteManifest();
            return await this.rebuildManifest();
        }
    }
    async saveManifest(manifest: ReplayMeta[]): Promise<void> {
        const stream = new DataStream();
        stream.writeString(JSON.stringify(manifest), 'utf-8');
        const file = new VirtualFile(stream, ReplayStorageFileSystem.manifestFileName);
        try {
            await this.dir.writeFile(file);
        }
        catch (error) {
            if (error instanceof StorageQuotaError) {
                throw error;
            }
            throw new ReplayStorageError(`Failed to save manifest (${(error as Error).message})`, { cause: error as Error });
        }
    }
    async deleteManifest(): Promise<void> {
        await this.dir.deleteFile(ReplayStorageFileSystem.manifestFileName);
    }
    async rebuildManifest(): Promise<ReplayMeta[]> {
        const currentManifest = await this.getManifest();
        let replayFileCount = 0;
        for await (const entry of this.dir.getEntries()) {
            if (this.isReplayFile(entry)) {
                replayFileCount++;
            }
        }
        if (replayFileCount === currentManifest.length) {
            return currentManifest;
        }
        console.info('Rebuilding replay index...');
        const replayFiles = new Map<string, {
            name: string;
            lastModified: number;
        }>();
        for await (const file of this.dir.getRawFiles()) {
            if (this.isReplayFile(file.name)) {
                replayFiles.set(file.name, file);
            }
        }
        const newManifest: ReplayMeta[] = [];
        for (const entry of currentManifest) {
            const fileName = this.getReplayFileNames(entry).find((name) => replayFiles.has(name));
            if (fileName) {
                newManifest.push(entry);
                this.getReplayFileNames(entry).forEach((name) => replayFiles.delete(name));
            }
        }
        if (currentManifest.length - newManifest.length > 0) {
            console.info(`Removed ${currentManifest.length - newManifest.length} orphaned entries from index`);
        }
        if (replayFiles.size > 0) {
            const seenReplayNames = new Set<string>();
            for (const file of replayFiles.values()) {
                const extension = Replay.supportedExtensions.find((item) => file.name.toLowerCase().endsWith(item))!;
                const replayName = file.name
                    .replace(ReplayStorageFileSystem.unsavedReplayPrefix, '')
                    .slice(0, -extension.length);
                const uniqueKey = `${file.name.startsWith(ReplayStorageFileSystem.unsavedReplayPrefix) ? 'temp' : 'keep'}:${replayName.toLowerCase()}`;
                if (seenReplayNames.has(uniqueKey)) {
                    continue;
                }
                seenReplayNames.add(uniqueKey);
                const timestamp = file.lastModified;
                newManifest.unshift({
                    id: THREE.MathUtils.generateUUID(),
                    name: replayName,
                    keep: !file.name.startsWith(ReplayStorageFileSystem.unsavedReplayPrefix),
                    timestamp: timestamp,
                });
            }
            newManifest.sort((a, b) => a.timestamp === b.timestamp
                ? a.name.localeCompare(b.name)
                : b.timestamp - a.timestamp);
            console.info(`Added ${replayFiles.size} new entries to replay index`);
        }
        try {
            await this.saveManifest(newManifest);
        }
        catch (error) {
            if (!(error instanceof StorageQuotaError)) {
                throw error;
            }
            console.error('Failed to save rebuilt manifest because storage is full', error);
        }
        console.info('Rebuild finished.');
        return newManifest;
    }
    async deleteAllReplays(): Promise<void> {
        for await (const entry of this.dir.getEntries()) {
            if (this.isReplayFile(entry)) {
                await this.dir.deleteFile(entry);
            }
        }
        await this.deleteManifest();
    }
    async getReplayData(meta: ReplayMeta): Promise<string> {
        for (const fileName of this.getReplayFileNames(meta)) {
            if (await this.dir.containsEntry(fileName)) {
                return await this.dir.getRawFile(fileName);
            }
        }
        throw new Error(`Replay file "${this.getReplayFileName(meta)}" not found.`);
    }
    async hasReplayData(meta: ReplayMeta): Promise<boolean> {
        for (const fileName of this.getReplayFileNames(meta)) {
            if (await this.dir.containsEntry(fileName)) {
                return true;
            }
        }
        return false;
    }
    async saveReplayData(meta: ReplayMeta, data: string): Promise<void> {
        const stream = new DataStream();
        stream.writeString(data, 'utf-8');
        const fileName = this.getReplayFileName(meta);
        const file = new VirtualFile(stream, fileName);
        try {
            await this.dir.writeFile(file);
        }
        catch (error) {
            if (error instanceof StorageQuotaError) {
                throw error;
            }
            if (error instanceof TypeError) {
                throw new ReplayStorageError(`Failed to save replay file "${fileName}" (${(error as Error).message})`, { cause: error as Error });
            }
            throw new ReplayStorageError(`Failed to save replay file (${(error as Error).message})`, { cause: error as Error });
        }
    }
    async deleteReplayData(meta: ReplayMeta): Promise<void> {
        for (const fileName of this.getReplayFileNames(meta)) {
            if (await this.dir.containsEntry(fileName)) {
                await this.dir.deleteFile(fileName);
            }
        }
    }
    getReplayFileName(meta: ReplayMeta): string {
        return ((meta.keep ? '' : ReplayStorageFileSystem.unsavedReplayPrefix) +
            meta.name +
            Replay.extension);
    }
    private getReplayFileNames(meta: ReplayMeta): string[] {
        const prefix = meta.keep ? '' : ReplayStorageFileSystem.unsavedReplayPrefix;
        return Replay.supportedExtensions.map((extension) => prefix + meta.name + extension);
    }
    private isReplayFile(fileName: string): boolean {
        return Replay.supportedExtensions.some((extension) => fileName.toLowerCase().endsWith(extension));
    }
}
