import { jsx } from '@/gui/jsx/jsx';
import { HtmlView } from '@/gui/jsx/HtmlView';
import { ReplaySel } from '@/gui/screen/replay/ReplaySel';
import { Replay } from '@/network/gamestate/Replay';
import { ScreenType } from '@/gui/screen/ScreenType';
import { KeepReplayBox } from '@/gui/screen/replay/KeepReplayBox';
import { CompositeDisposable } from '@/util/disposable/CompositeDisposable';
import { ReplayStorageError } from '@/gui/replay/ReplayStorageError';
import { ResourceLoader } from '@/engine/ResourceLoader';
import { StorageQuotaError } from '@/data/vfs/StorageQuotaError';
import { Task } from '@puzzl/core/lib/async/Task';
import { Parser } from '@/network/gameopt/Parser';
import { GameSpeed } from '@/game/GameSpeed';
import { ReplayExistsError } from '@/gui/replay/ReplayExistsError';
import { MainMenuScreen } from '@/gui/screen/mainMenu/MainMenuScreen';
import { OperationCanceledError } from '@puzzl/core/lib/async/cancellation';
import { IOError } from '@/data/vfs/IOError';
import { FileNotFoundError } from '@/data/vfs/FileNotFoundError';
import { RouteHelper } from '@/RouteHelper';
import { GameOptRandomGen } from '@/game/gameopts/GameOptRandomGen';
import { OBS_COUNTRY_ID } from '@/game/gameopts/constants';
interface ReplayMeta {
    id: string;
    name: string;
    timestamp: number;
    keep?: boolean;
}
interface ReplayDetails {
    engineVersion: string;
    durationSeconds?: number;
    gameId: string;
    gameTimestamp?: number;
    mapName?: string;
    players?: Array<{
        name: string;
        color: string;
    }>;
}
interface Strings {
    get(key: string, ...args: any[]): string;
}
interface ErrorHandler {
    handle(error: any, message: string, onClose?: () => void): void;
}
interface MessageBoxApi {
    show(message: string, buttonText?: string, onClose?: () => void): void;
    confirm(message: string, okText: string, cancelText: string): Promise<boolean>;
    destroy(): void;
}
interface ReplayManager {
    loadList(includeTemp?: boolean): Promise<ReplayMeta[]>;
    importReplay(file: File): Promise<void>;
    loadSerializedReplay(replay: ReplayMeta): Promise<string | Blob>;
    keepReplay(id: string, name: string): Promise<void>;
    deleteReplay(replay: ReplayMeta): Promise<void>;
    loadReplay(replay: ReplayMeta): Promise<any>;
}
interface JsxRenderer {
    render(jsx: any): any[];
}
interface UiScene {
    viewport: any;
    add(object: any): void;
    remove(object: any): void;
}
interface Rules {
    getMultiplayerColors(): Map<number, any>;
}
interface RootController {
    goToScreen(screenType: ScreenType, params?: any): void;
}
interface GameOpts {
    mapName: string;
    mapTitle?: string;
    mapDigest: string;
    mapOfficial: boolean;
    humanPlayers: Array<{
        name: string;
        countryId: number;
        colorId: number;
    }>;
}
interface ReplayHeader {
    gameId: string;
    gameTimestamp?: number;
    engineVersion: string;
    modHash: string;
    gameOptsSerialized: string;
}
export class ReplaySelScreen extends MainMenuScreen {
    declare public title: string;
    private disposables: CompositeDisposable;
    private availableReplays: ReplayMeta[] = [];
    private selectedReplay?: ReplayMeta;
    private form?: any;
    private fileInput?: HTMLInputElement;
    private clientVersions?: Record<string, string>;
    private currentReplayUrl?: string;
    private replayDetailsTask?: Task<void>;
    constructor(private engineVersion: string, private engineModHash: string, private activeMod?: string, private oldClientsBaseUrl?: string, private rootController?: RootController, private strings?: Strings, private jsxRenderer?: JsxRenderer, private errorHandler?: ErrorHandler, private messageBoxApi?: MessageBoxApi, private replayManager?: ReplayManager, private uiScene?: UiScene, private rules?: Rules, private sentry?: any) {
        super();
        this.title = this.strings?.get("GUI:Replays") || "Replays";
        this.disposables = new CompositeDisposable();
        this.handleSelectReplay = this.handleSelectReplay.bind(this);
    }
    private handleSelectReplay = (replay: ReplayMeta, doubleClick?: boolean): void => {
        const isNewSelection = this.selectedReplay?.id !== replay.id;
        this.selectedReplay = replay;
        if (isNewSelection) {
            this.updateSidebarButtons();
        }
        this.form?.applyOptions((options: any) => {
            options.selectedReplay = replay;
            options.selectedReplayDetails = undefined;
        });
        if (doubleClick) {
            this.loadSelectedReplay();
        }
        else {
            this.loadReplayDetails(replay);
        }
    };
    async onEnter(): Promise<void> {
        this.availableReplays = [];
        this.controller?.toggleMainVideo(false);
        this.initForm();
        try {
            this.availableReplays = await this.replayManager!.loadList(true);
        }
        catch (error: any) {
            if (!(error instanceof IOError) &&
                !(error instanceof FileNotFoundError) &&
                !(error instanceof StorageQuotaError)) {
                this.sentry?.captureException(new Error(`Failed to load replay list (${error.name ?? error.message})`, { cause: error }));
            }
            this.handleError(error, this.strings!.get("GUI:ReplayListError"));
            return;
        }
        this.selectedReplay = this.availableReplays[0];
        this.form?.applyOptions((options: any) => {
            options.replays = this.availableReplays;
            options.selectedReplay = this.selectedReplay;
        });
        if (this.selectedReplay !== undefined) {
            this.loadReplayDetails(this.selectedReplay);
        }
        this.initSidebar();
        this.initFileInput();
    }
    private initForm(): void {
        this.controller?.setMainComponent(this.jsxRenderer!.render(jsx(HtmlView, {
            innerRef: (ref: any) => (this.form = ref),
            component: ReplaySel,
            props: {
                strings: this.strings,
                replays: undefined,
                selectedReplay: undefined,
                selectedReplayDetails: undefined,
                onSelectReplay: this.handleSelectReplay
            }
        }))[0]);
    }
    private initFileInput(): void {
        const input = this.fileInput = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("accept", Replay.supportedExtensions.join(","));
        input.setAttribute("style", "display: none");
        document.body.appendChild(input);
        const handleChange = async (): Promise<void> => {
            const file = this.fileInput?.files?.[0];
            if (!file)
                return;
            try {
                await this.replayManager!.importReplay(file);
                this.availableReplays = await this.replayManager!.loadList();
                this.form?.applyOptions((options: any) => {
                    options.replays = this.availableReplays;
                });
            }
            catch (error: any) {
                let message: string;
                if (error instanceof StorageQuotaError) {
                    message = this.strings!.get("ts:storage_quota_exceeded");
                }
                else if (error instanceof ReplayStorageError) {
                    message = this.strings!.get("GUI:SaveReplayError");
                }
                else {
                    message = this.strings!.get("GUI:ImportReplayError");
                }
                this.errorHandler!.handle(error, message, () => { });
            }
        };
        input.addEventListener("change", handleChange);
        this.disposables.add(() => {
            if (this.fileInput) {
                document.body.removeChild(this.fileInput);
                this.fileInput.removeEventListener("change", handleChange);
                this.fileInput = undefined;
            }
        });
    }
    private initSidebar(): void {
        this.updateSidebarButtons();
        this.controller?.showSidebarButtons();
    }
    private updateSidebarButtons(): void {
        const replayMeta = this.getSelectedReplayMeta();
        this.controller?.setSidebarButtons([
            {
                label: this.strings!.get("GUI:LoadReplay"),
                disabled: !this.selectedReplay,
                onClick: () => {
                    this.loadSelectedReplay();
                }
            },
            {
                label: this.strings!.get(replayMeta?.keep ? "GUI:RenameReplay" : "GUI:KeepReplay"),
                tooltip: replayMeta?.keep ? undefined : this.strings!.get("STT:KeepReplay"),
                disabled: !this.selectedReplay,
                onClick: () => {
                    this.showKeepReplayBox(replayMeta!.name, (name: string) => {
                        this.replayManager!.keepReplay(replayMeta!.id, name)
                            .then(async () => {
                            this.availableReplays = await this.replayManager!.loadList();
                            this.selectedReplay = this.getSelectedReplayMeta();
                            this.form?.applyOptions((options: any) => {
                                options.replays = this.availableReplays;
                            });
                            this.updateSidebarButtons();
                        })
                            .catch((error: any) => {
                            let message: string;
                            if (error instanceof ReplayExistsError) {
                                message = this.strings!.get("GUI:ReplayExistsError");
                            }
                            else {
                                message = this.strings!.get("GUI:SaveReplayError");
                            }
                            this.errorHandler!.handle(error, message, () => { });
                        });
                    });
                }
            },
            {
                label: this.strings!.get("GUI:ImportReplay"),
                tooltip: this.strings!.get("STT:ImportReplay"),
                onClick: () => {
                    if (this.fileInput?.click !== undefined) {
                        this.fileInput.click();
                    }
                    else {
                        const event = document.createEvent("Event");
                        event.initEvent("click", true, true);
                        this.fileInput?.dispatchEvent(event);
                    }
                }
            },
            {
                label: this.strings!.get("GUI:ExportReplay"),
                tooltip: this.strings!.get("STT:ExportReplay"),
                disabled: !this.selectedReplay,
                onClick: () => {
                    this.exportCurrentReplay().catch((error: any) => this.errorHandler!.handle(error, this.strings!.get("GUI:ReplayError"), () => { }));
                }
            },
            {
                label: this.strings!.get("GUI:DeleteReplay"),
                disabled: !this.selectedReplay,
                onClick: async () => {
                    const replayMeta = this.getSelectedReplayMeta();
                    if (!replayMeta)
                        return;
                    const confirmed = await this.messageBoxApi!.confirm(this.strings!.get("GUI:ConfirmDeleteReplay", replayMeta.name), this.strings!.get("GUI:Ok"), this.strings!.get("GUI:Cancel"));
                    if (confirmed) {
                        try {
                            await this.replayManager!.deleteReplay(replayMeta);
                        }
                        catch (error: any) {
                            const message = error instanceof StorageQuotaError
                                ? this.strings!.get("ts:storage_quota_exceeded")
                                : this.strings!.get("GUI:DeleteReplayError");
                            this.errorHandler!.handle(error, message, () => { });
                            return;
                        }
                        this.selectedReplay = undefined;
                        this.availableReplays = await this.replayManager!.loadList();
                        this.form?.applyOptions((options: any) => {
                            options.replays = this.availableReplays;
                            options.selectedReplay = undefined;
                            options.selectedReplayDetails = undefined;
                        });
                        this.updateSidebarButtons();
                    }
                }
            },
            {
                label: this.strings!.get("GUI:Back"),
                isBottom: true,
                onClick: () => {
                    this.controller?.popScreen();
                }
            }
        ]);
    }
    private async loadSelectedReplay(): Promise<void> {
        const replay = this.selectedReplay;
        if (!replay)
            return;
        let replayHeader: ReplayHeader;
        try {
            const serialized = await this.replayManager!.loadSerializedReplay(replay);
            replayHeader = await new Replay().parseHeader(serialized);
        }
        catch (error: any) {
            this.errorHandler!.handle(error, this.strings!.get("GUI:ReplayError"), () => { });
            return;
        }
        if (replayHeader.engineVersion !== this.engineVersion) {
            if (!this.clientVersions && this.oldClientsBaseUrl) {
                this.messageBoxApi!.show(this.strings!.get("GUI:LoadingEx"));
                try {
                    const loader = new ResourceLoader(this.oldClientsBaseUrl);
                    this.clientVersions = await loader.loadJson("versions.json");
                }
                catch (error) {
                    console.warn("Couldn't download client version list", error);
                }
                finally {
                    this.messageBoxApi!.destroy();
                }
            }
            const clientVersion = this.clientVersions?.[replayHeader.engineVersion];
            if (clientVersion) {
                const confirmed = await this.messageBoxApi!.confirm(this.strings!.get("GUI:ReplayOpenOldClient", replayHeader.engineVersion), this.strings!.get("TXT_CONTINUE"), this.strings!.get("GUI:Close"));
                if (confirmed) {
                    const modQuery = this.activeMod
                        ? `?${RouteHelper.modQueryStringName}=${this.activeMod}`
                        : "";
                    window.open(`${this.oldClientsBaseUrl}v${clientVersion}/${modQuery}#/replay/${replay.id}`, "_blank");
                }
            }
            else {
                this.messageBoxApi!.show(this.strings!.get("GUI:ReplayVersionMismatch", replayHeader.engineVersion), this.strings!.get("GUI:Ok"));
            }
            return;
        }
        if (replayHeader.modHash === this.engineModHash) {
            let loadedReplay: any;
            try {
                loadedReplay = await this.replayManager!.loadReplay(replay);
            }
            catch (error: any) {
                this.errorHandler!.handle(error, this.strings!.get("GUI:ReplayError"), () => { });
                return;
            }
            this.rootController!.goToScreen(ScreenType.Replay, {
                replay: loadedReplay
            });
        }
        else {
            this.messageBoxApi!.show(this.strings!.get("GUI:ReplayModMismatch"), this.strings!.get("GUI:Ok"));
        }
    }
    private showKeepReplayBox(defaultName: string, onSubmit: (name: string) => void): void {
        const [component] = this.jsxRenderer!.render(jsx(HtmlView, {
            component: KeepReplayBox,
            props: {
                defaultName,
                strings: this.strings,
                onSubmit: (name: string) => {
                    onSubmit(name);
                    component.destroy();
                },
                onDismiss: () => {
                    component.destroy();
                },
                viewport: this.uiScene!.viewport
            }
        }));
        this.uiScene!.add(component);
        this.disposables.add(component, () => this.uiScene!.remove(component));
    }
    private async exportCurrentReplay(): Promise<void> {
        const replay = this.getSelectedReplayMeta();
        if (!replay) {
            throw new Error("No replay selected");
        }
        const serialized = await this.replayManager!.loadSerializedReplay(replay);
        if (this.currentReplayUrl) {
            URL.revokeObjectURL(this.currentReplayUrl);
        }
        const blob = new Blob([serialized], { type: "application/octet-stream" });
        this.currentReplayUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", this.currentReplayUrl);
        link.setAttribute("download", replay.name + Replay.extension);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    private getSelectedReplayMeta(): ReplayMeta | undefined {
        if (!this.selectedReplay)
            return undefined;
        return this.availableReplays.find(replay => replay.id === this.selectedReplay!.id);
    }
    async onLeave(): Promise<void> {
        if (this.currentReplayUrl) {
            URL.revokeObjectURL(this.currentReplayUrl);
        }
        this.clientVersions = undefined;
        this.availableReplays.length = 0;
        this.form = undefined;
        this.messageBoxApi?.destroy();
        this.disposables.dispose();
        this.replayDetailsTask?.cancel();
        this.replayDetailsTask = undefined;
        this.controller?.setMainComponent();
        await this.controller?.hideSidebarButtons();
    }
    private loadReplayDetails(replay: ReplayMeta): void {
        this.replayDetailsTask?.cancel();
        this.replayDetailsTask = new Task(async (cancellationToken) => {
            const serialized = await this.replayManager!.loadSerializedReplay(replay);
            const header = await new Replay().parseHeader(serialized);
            cancellationToken.throwIfCancelled();
            let gameOpts: GameOpts | undefined;
            let durationSeconds: number | undefined;
            if (header.engineVersion === this.engineVersion) {
                const replayInstance = new Replay();
                const content = typeof serialized === "string"
                    ? serialized
                    : await serialized.text();
                replayInstance.unserialize(content, replay);
                cancellationToken.throwIfCancelled();
                gameOpts = replayInstance.gameOpts;
                durationSeconds = Math.floor(replayInstance.endTick / GameSpeed.BASE_TICKS_PER_SECOND);
            }
            else {
                try {
                    gameOpts = new Parser().parseOptions(header.gameOptsSerialized);
                }
                catch (error) {
                    console.warn("Replay couldn't be parsed", error);
                }
            }
            let players: Array<{
                name: string;
                color: string;
            }> | undefined;
            if (gameOpts) {
                const randomGen = GameOptRandomGen.factory(header.gameId, header.gameTimestamp);
                const generatedColors = randomGen.generateColors(gameOpts as any);
                const availableColors = this.getAvailablePlayerColors();
                players = gameOpts.humanPlayers
                    .filter(player => player.countryId !== OBS_COUNTRY_ID)
                    .map(player => ({
                    name: player.name,
                    color: availableColors[generatedColors.get(player) ?? player.colorId]
                }));
            }
            const details: ReplayDetails = {
                gameId: header.gameId,
                gameTimestamp: header.gameTimestamp,
                engineVersion: header.engineVersion,
                durationSeconds,
                mapName: gameOpts?.mapTitle,
                players
            };
            this.form?.applyOptions((options: any) => {
                options.selectedReplayDetails = details;
            });
        });
        this.replayDetailsTask.start().catch((error: any) => {
            if (!(error instanceof OperationCanceledError)) {
                console.error(error);
            }
        });
    }
    private getAvailablePlayerColors(): string[] {
        return [...this.rules!.getMultiplayerColors().values()].map((color: any) => color.asHexString());
    }
    private handleError(error: any, message: string): void {
        this.errorHandler!.handle(error, message, () => {
            this.rootController!.goToScreen(ScreenType.MainMenuRoot);
        });
    }
}
