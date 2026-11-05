import React from "react";
import { jsx } from "@/gui/jsx/jsx";
import { HtmlView } from "@/gui/jsx/HtmlView";
import { ScreenType } from "@/gui/screen/ScreenType";
import { CompositeDisposable } from "@/util/disposable/CompositeDisposable";
import { StorageQuotaError } from "data/vfs/StorageQuotaError";
import { MainMenuScreen } from "@/gui/screen/mainMenu/MainMenuScreen";
import { IOError } from "data/vfs/IOError";
import { FileNotFoundError } from "data/vfs/FileNotFoundError";
import { ModSel } from "@/gui/screen/mainMenu/modSel/ModSel";
import { Engine } from "@/engine/Engine";
import { FileSystemUtil } from "@/engine/gameRes/FileSystemUtil";
import { ModImporter } from "@/gui/screen/mainMenu/modSel/ModImporter";
import { InvalidArchiveError } from "@/engine/gameRes/importError/InvalidArchiveError";
import { ArchiveExtractionError } from "@/engine/gameRes/importError/ArchiveExtractionError";
import { BadModArchiveError } from "@/gui/screen/mainMenu/modSel/BadModArchiveError";
import { DuplicateModError } from "@/gui/screen/mainMenu/modSel/DuplicateModError";
import { Mod } from "@/gui/screen/mainMenu/modSel/Mod";
import { ModStatus } from "@/gui/screen/mainMenu/modSel/ModStatus";
import { CancellationTokenSource, OperationCanceledError } from "@puzzl/core/lib/async/cancellation";
import { ModDownloadPrompt } from "@/gui/screen/mainMenu/modSel/ModDownloadPrompt";
interface ModManager {
    listLocal(): Promise<any[]>;
    listRemote(): Promise<any[]>;
    buildModList(local: any[], remote?: any[]): Promise<Mod[]>;
    deleteModFiles(modId: string): Promise<void>;
    loadMod(modId?: string): void;
    getModDir(): any;
}
interface RootController {
    goToScreen(screenType: any): void;
}
interface ErrorHandler {
    handle(error: any, message: string, onClose: () => void): void;
}
interface MessageBoxApi {
    show(message: React.ReactElement | string, buttonText?: string, onClose?: () => void): void;
    confirm(message: React.ReactElement | string, confirmText: string, cancelText: string): Promise<boolean>;
    destroy(): void;
    updateText(text: string): void;
}
interface ModResourceLoader {
    loadResources(resources: any[], cancellationToken: any, onProgress?: (progress: number) => void): Promise<any>;
    getResourceFileName(resource: any): string;
}
interface FsAccessLib {
    showOpenFilePicker(options: any): Promise<any>;
}
interface Sentry {
    captureException(error: Error): void;
}
export class ModSelScreen extends MainMenuScreen {
    private rootController: RootController;
    private strings: any;
    private jsxRenderer: any;
    private errorHandler: ErrorHandler;
    private messageBoxApi: MessageBoxApi;
    private modManager: ModManager;
    private activeModId: string;
    private modSdkUrl?: string;
    private modResourceLoader: ModResourceLoader;
    private fsAccessLib: FsAccessLib;
    private sentry: Sentry;
    private disposables: CompositeDisposable;
    private availableMods: Mod[] = [];
    private activeMod?: Mod;
    private selectedMod?: Mod;
    private form?: any;
    constructor(rootController: RootController, strings: any, jsxRenderer: any, errorHandler: ErrorHandler, messageBoxApi: MessageBoxApi, modManager: ModManager, activeModId: string, modSdkUrl: string | undefined, modResourceLoader: ModResourceLoader, fsAccessLib: FsAccessLib, sentry: Sentry) {
        super();
        this.rootController = rootController;
        this.strings = strings;
        this.jsxRenderer = jsxRenderer;
        this.errorHandler = errorHandler;
        this.messageBoxApi = messageBoxApi;
        this.modManager = modManager;
        this.activeModId = activeModId;
        this.modSdkUrl = modSdkUrl;
        this.modResourceLoader = modResourceLoader;
        this.fsAccessLib = fsAccessLib;
        this.sentry = sentry;
        this.title = this.strings.get("GUI:Mods");
        this.disposables = new CompositeDisposable();
        this.handleSelectMod = async (mod: Mod, doubleClick: boolean) => {
            const isNewSelection = this.selectedMod?.id !== mod.id;
            this.selectedMod = mod;
            if (isNewSelection) {
                this.updateSidebarButtons();
            }
            this.form?.applyOptions((options: any) => {
                options.selectedMod = mod;
            });
            if (doubleClick &&
                mod !== this.activeMod &&
                mod.status === ModStatus.Installed) {
                await this.loadOrUnloadMod(mod);
            }
        };
    }
    private handleSelectMod: (mod: Mod, doubleClick: boolean) => Promise<void>;
    async onEnter(): Promise<void> {
        this.availableMods = [];
        this.controller.toggleMainVideo(false);
        this.initForm();
        const mods = await this.loadAvailableMods();
        if (mods) {
            this.availableMods = mods;
            this.activeMod = this.availableMods.find((mod) => mod.id === this.activeModId);
            this.selectedMod = this.activeMod;
            this.form.applyOptions((options: any) => {
                options.mods = this.availableMods;
                options.activeMod = this.activeMod;
                options.selectedMod = this.selectedMod;
            });
            this.initSidebar();
        }
    }
    private async loadAvailableMods(): Promise<Mod[] | undefined> {
        try {
            const [localMods, remoteMods] = await Promise.all([
                this.modManager.listLocal(),
                this.modManager.listRemote().catch((error) => {
                    console.warn("Failed to fetch remote mods", [error]);
                    return undefined;
                }),
            ]);
            return await this.modManager.buildModList(localMods, remoteMods);
        }
        catch (error: any) {
            if (!(error instanceof IOError ||
                error instanceof FileNotFoundError ||
                error instanceof StorageQuotaError)) {
                this.sentry?.captureException(new Error(`Failed to load mod list (${error.name ?? error.message})`, { cause: error }));
            }
            this.handleError(error, this.strings.get("GUI:ModListError"));
            return undefined;
        }
    }
    private initForm(): void {
        this.controller.setMainComponent(this.jsxRenderer.render(jsx(HtmlView, {
            innerRef: (ref: any) => (this.form = ref),
            component: ModSel,
            props: {
                strings: this.strings,
                mods: undefined,
                activeMod: undefined,
                selectedMod: undefined,
                onSelectMod: this.handleSelectMod,
            },
        }))[0]);
    }
    private initSidebar(): void {
        this.updateSidebarButtons();
        this.controller.showSidebarButtons();
    }
    private updateSidebarButtons(): void {
        this.controller?.setSidebarButtons([
            {
                label: this.selectedMod && this.selectedMod === this.activeMod
                    ? this.strings.get("GUI:UnloadMod")
                    : this.selectedMod?.isInstalled()
                        ? this.strings.get("GUI:LoadMod")
                        : this.strings.get("GUI:ModActionInstall"),
                disabled: !this.selectedMod,
                onClick: async () => {
                    const mod = this.selectedMod!;
                    if (mod.status === ModStatus.Installed || mod === this.activeMod) {
                        await this.loadOrUnloadMod(mod);
                    }
                    else {
                        const sizeMb = (mod.meta.downloadSize || 0) / 1024 / 1024;
                        if (mod.meta.manualDownload) {
                            const isUpdate = mod.status === ModStatus.UpdateAvailable;
                            const promptElement = React.createElement(ModDownloadPrompt, {
                                url: mod.meta.download,
                                sizeMb: sizeMb,
                                isUpdate: isUpdate,
                                strings: this.strings,
                                onClick: () => this.messageBoxApi.destroy(),
                            });
                            if (isUpdate) {
                                if (!(await this.messageBoxApi.confirm(promptElement, this.strings.get("GUI:Close"), this.strings.get("GUI:ModActionLoadAnyway")))) {
                                    await this.loadOrUnloadMod(mod);
                                }
                            }
                            else {
                                this.messageBoxApi.show(promptElement, this.strings.get("GUI:Close"), () => { });
                            }
                        }
                        else {
                            let shouldLoadAfterInstall = false;
                            if (mod.status === ModStatus.UpdateAvailable) {
                                if (!(await this.messageBoxApi.confirm(this.strings.get("GUI:ModUpdateAvail") +
                                    "\n\n" +
                                    this.strings.get("GUI:UpdateModPrompt", mod.latestVersion, sizeMb), this.strings.get("GUI:ModActionUpdate"), this.strings.get("GUI:ModActionLoadAnyway")))) {
                                    await this.loadOrUnloadMod(mod);
                                    return;
                                }
                                shouldLoadAfterInstall = true;
                            }
                            else if (sizeMb > 10 &&
                                !(await this.messageBoxApi.confirm(this.strings.get("GUI:InstallModDownloadPrompt", sizeMb), this.strings.get("GUI:Continue"), this.strings.get("GUI:Cancel")))) {
                                return;
                            }
                            let downloadedFile: File;
                            try {
                                downloadedFile = await this.downloadMod(mod);
                            }
                            catch (error) {
                                if (error instanceof OperationCanceledError) {
                                    return;
                                }
                                this.errorHandler.handle(error, this.strings.get("GUI:DownloadFailed"), () => { });
                                return;
                            }
                            this.messageBoxApi.destroy();
                            try {
                                await this.importModFromFile(downloadedFile, mod.status === ModStatus.UpdateAvailable);
                            }
                            catch (error) {
                                this.handleModImportError(error);
                                return;
                            }
                            if (shouldLoadAfterInstall) {
                                await this.loadOrUnloadMod(mod);
                            }
                        }
                    }
                },
            },
            {
                label: this.strings.get("GUI:ImportMod"),
                tooltip: this.strings.get("STT:ImportMod"),
                onClick: async () => {
                    try {
                        let file: File;
                        try {
                            const fileHandle = await FileSystemUtil.showArchivePicker(this.fsAccessLib);
                            file = await fileHandle.getFile();
                        }
                        catch (error: any) {
                            if (error.name === "AbortError")
                                return;
                            if (error instanceof DOMException) {
                                throw new IOError(`File could not be read (${error.name})`, { cause: error });
                            }
                            throw error;
                        }
                        await this.importModFromFile(file, false);
                    }
                    catch (error) {
                        this.handleModImportError(error);
                    }
                },
            },
            {
                label: this.strings.get("GUI:UninstallMod"),
                tooltip: this.strings.get("STT:UninstallMod"),
                disabled: !(this.selectedMod?.isInstalled() &&
                    this.activeMod !== this.selectedMod),
                onClick: async () => {
                    const mod = this.selectedMod!;
                    if (await this.messageBoxApi.confirm(this.strings.get("GUI:ConfirmUninstallMod", mod.name), this.strings.get("GUI:Ok"), this.strings.get("GUI:Cancel"))) {
                        this.messageBoxApi.show(this.strings.get("GUI:WorkingPleaseWait"));
                        try {
                            await this.modManager.deleteModFiles(mod.id);
                        }
                        catch (error: any) {
                            const message = error instanceof StorageQuotaError
                                ? this.strings.get("ts:storage_quota_exceeded")
                                : this.strings.get("GUI:UninstallModError");
                            this.errorHandler.handle(error, message, () => { });
                            return;
                        }
                        finally {
                            this.messageBoxApi.destroy();
                        }
                        const updatedMods = await this.loadAvailableMods();
                        if (updatedMods) {
                            this.availableMods = updatedMods;
                            this.selectedMod = undefined;
                            this.form?.applyOptions((options: any) => {
                                options.mods = this.availableMods;
                                options.selectedMod = undefined;
                            });
                            this.updateSidebarButtons();
                        }
                    }
                },
            },
            {
                label: this.strings.get("GUI:BrowseMod"),
                tooltip: this.strings.get("STT:BrowseMod"),
                onClick: () => {
                    this.controller?.pushScreen(ScreenType.OptionsStorage, {
                        startIn: Engine.rfsSettings.modDir +
                            (this.selectedMod?.isInstalled() ? "/" + this.selectedMod.id : ""),
                    });
                },
            },
            ...(this.modSdkUrl
                ? [
                    {
                        label: this.strings.get("GUI:ModSDK"),
                        tooltip: this.strings.get("STT:ModSDK"),
                        onClick: () => {
                            window.open(this.modSdkUrl, "_blank");
                        },
                    },
                ]
                : []),
            {
                label: this.strings.get("GUI:Back"),
                isBottom: true,
                onClick: () => {
                    this.controller?.popScreen();
                },
            },
        ]);
    }
    private async loadOrUnloadMod(mod: Mod): Promise<void> {
        await this.controller?.hideSidebarButtons();
        this.modManager.loadMod(mod !== this.activeMod ? mod.id : undefined);
    }
    private async downloadMod(mod: Mod): Promise<File> {
        const downloadUrl = mod.meta.download;
        if (!downloadUrl) {
            throw new Error("Mod meta is missing download");
        }
        const cancellationSource = new CancellationTokenSource();
        this.messageBoxApi.show(this.strings.get("TS:Downloading"), this.strings.get("GUI:Cancel"), () => cancellationSource.cancel());
        const resource = {
            id: "archive",
            src: downloadUrl,
            type: "binary",
            sizeHint: mod.meta.downloadSize,
        };
        const resources = await this.modResourceLoader.loadResources([resource], cancellationSource.token, (progress: number) => {
            this.messageBoxApi.updateText(this.strings.get("TS:DownloadingPg", progress));
        });
        const archiveData = resources.pop("archive");
        return new File([archiveData], this.modResourceLoader.getResourceFileName(resource));
    }
    private async importModFromFile(file: File, overwrite: boolean): Promise<void> {
        this.messageBoxApi.show(this.strings.get("ts:import_preparing_for_import"));
        const onProgress = (message: string) => {
            this.messageBoxApi.updateText(message);
        };
        let modMeta: any;
        try {
            modMeta = await new ModImporter(this.strings, this.messageBoxApi, navigator.storage).import(file, this.modManager.getModDir(), overwrite, onProgress);
        }
        finally {
            this.messageBoxApi.destroy();
        }
        if (modMeta) {
            const mod = new Mod(modMeta, undefined);
            if (mod) {
                const existingIndex = this.availableMods.findIndex((m) => m.id === mod.id);
                if (existingIndex !== -1) {
                    this.availableMods.splice(existingIndex, 1, mod);
                }
                else {
                    this.availableMods.unshift(mod);
                }
                this.selectedMod = mod;
                this.form?.applyOptions((options: any) => {
                    options.mods = this.availableMods;
                    options.selectedMod = mod;
                });
                this.updateSidebarButtons();
            }
        }
    }
    private handleModImportError(error: any): void {
        const strings = this.strings;
        let message = strings.get("GUI:ImportModError");
        if (error instanceof BadModArchiveError) {
            message += "\n\n" + strings.get("GUI:ImportModBadArchive");
        }
        else if (error instanceof DuplicateModError) {
            message += "\n\n" + strings.get("GUI:ImportDuplicateModError");
        }
        else if (error instanceof InvalidArchiveError) {
            message += "\n\n" + strings.get("ts:import_invalid_archive");
        }
        else if (error instanceof ArchiveExtractionError) {
            if (error.cause?.message?.match(/out of memory|allocation/i)) {
                message += "\n\n" + strings.get("ts:import_out_of_memory");
            }
            else {
                message += "\n\n" + strings.get("ts:import_archive_extract_failed");
            }
        }
        else if (error.message?.match(/out of memory|allocation/i)) {
            message += "\n\n" + strings.get("ts:import_out_of_memory");
        }
        else if (error.name === "QuotaExceededError" || error instanceof StorageQuotaError) {
            message += "\n\n" + strings.get("ts:storage_quota_exceeded");
        }
        else if (!(error instanceof IOError || error instanceof FileNotFoundError)) {
            this.sentry?.captureException(new Error("Mod import failed " + (error.message ?? error.name), { cause: error }));
        }
        this.errorHandler.handle(error, message, () => { });
    }
    async onStack(): Promise<void> {
        await this.onLeave();
    }
    onUnstack(): void {
        this.onEnter();
    }
    async onLeave(): Promise<void> {
        this.availableMods.length = 0;
        this.form = undefined;
        this.messageBoxApi.destroy();
        this.disposables.dispose();
        this.controller.setMainComponent();
        await this.controller.hideSidebarButtons();
    }
    private handleError(error: any, message: string): void {
        this.errorHandler.handle(error, message, () => {
            this.rootController.goToScreen(ScreenType.MainMenuRoot);
        });
    }
}
