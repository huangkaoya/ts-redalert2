import { Replay } from "../network/gamestate/Replay";
import { ReplayExistsError } from "./replay/ReplayExistsError";

function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
interface ReplayManifestEntry {
    id: string;
    name: string;
    keep: boolean;
    timestamp: number;
}
interface ReplayStorage {
    getManifest(forceRefresh?: boolean): Promise<ReplayManifestEntry[]>;
    getReplayData(entry: ReplayManifestEntry): Promise<string | Blob>;
    hasReplayData(entry: ReplayManifestEntry): Promise<boolean>;
    saveReplayData(entry: ReplayManifestEntry, data: string): Promise<void>;
    deleteReplayData(entry: ReplayManifestEntry): Promise<void>;
    saveManifest(manifest: ReplayManifestEntry[]): Promise<void>;
}
export class ReplayManager {
    private storage: ReplayStorage;
    constructor(storage: ReplayStorage) {
        this.storage = storage;
    }
    async loadList(forceRefresh: boolean = false): Promise<ReplayManifestEntry[]> {
        return await this.storage.getManifest(forceRefresh);
    }
    async loadSerializedReplay(entry: ReplayManifestEntry): Promise<string | Blob> {
        return await this.storage.getReplayData(entry);
    }
    async loadReplay(entry: ReplayManifestEntry): Promise<Replay> {
        const serializedData = await this.loadSerializedReplay(entry);
        const replay = new Replay();
        const dataString = typeof serializedData === "string"
            ? serializedData
            : await serializedData.text();
        replay.unserialize(dataString, entry);
        return replay;
    }
    async saveReplay(replay: Replay, keep: boolean = false): Promise<string> {
        const name = replay.name;
        if (!name) {
            throw new Error("Replay is not initialized");
        }
        const id = generateId();
        const serializedData = replay.serialize();
        let entry: ReplayManifestEntry = {
            id,
            name,
            keep,
            timestamp: replay.timestamp
        };
        let counter = 1;
        while (await this.storage.hasReplayData(entry)) {
            if (counter > 1) {
                entry.name = entry.name.replace(/ \(\d+\)$/, "");
            }
            entry.name += ` (${++counter})`;
        }
        let manifest = await this.loadList();
        const temporaryReplays = manifest.filter((entry) => !entry.keep);
        if (temporaryReplays.length > 50) {
            for (const oldReplay of temporaryReplays.slice(50)) {
                await this.storage.deleteReplayData(oldReplay);
                manifest.splice(manifest.indexOf(oldReplay), 1);
            }
        }
        manifest.unshift(entry);
        await this.storage.saveReplayData(entry, serializedData);
        await this.storage.saveManifest(manifest);
        return id;
    }
    async keepReplay(replayId: string, newName: string): Promise<void> {
        const manifest = await this.loadList();
        const existingEntry = manifest.find((entry) => entry.id === replayId);
        if (existingEntry) {
            const updatedEntry: ReplayManifestEntry = {
                ...existingEntry,
                name: Replay.sanitizeFileName(newName),
                keep: true,
            };
            if (await this.storage.hasReplayData(updatedEntry)) {
                throw new ReplayExistsError(`A replay with name "${updatedEntry.name}" already exists`);
            }
            const replayData = await this.storage.getReplayData(existingEntry);
            const dataString = typeof replayData === "string"
                ? replayData
                : await replayData.text();
            await this.storage.deleteReplayData(existingEntry);
            await this.storage.saveReplayData(updatedEntry, dataString);
            Object.assign(existingEntry, updatedEntry);
            await this.storage.saveManifest(manifest);
        }
    }
    async deleteReplay(entry: ReplayManifestEntry): Promise<void> {
        await this.storage.deleteReplayData(entry);
        const manifest = await this.loadList();
        const entryIndex = manifest.findIndex((manifestEntry) => manifestEntry.id === entry.id);
        if (entryIndex !== -1) {
            manifest.splice(entryIndex, 1);
            await this.storage.saveManifest(manifest);
        }
    }
    async importReplay(file: File): Promise<Replay> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const extension = Replay.supportedExtensions.find((item) => file.name.toLowerCase().endsWith(item));
                    const fileName = extension
                        ? file.name.slice(0, -extension.length)
                        : file.name;
                    const replay = new Replay();
                    replay.unserialize(event.target?.result as string, {
                        name: fileName,
                        timestamp: file.lastModified,
                    });
                    await this.saveReplay(replay, true);
                    resolve(replay);
                }
                catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => {
                reject(reader.error);
            };
            reader.readAsText(file, "utf-8");
        });
    }
}
