import * as stringUtils from '../../util/string';
import { TileSetEntry } from './TileSetEntry';
import { TileSet } from './TileSet';
import { TileSetAnim } from './TileSetAnim';
import type { IniFile } from '../../data/IniFile';
import type { TmpFile } from '../../data/TmpFile';
export enum HighBridgeHeadType {
    TopLeft = 0,
    BottomRight = 1,
    TopRight = 2,
    BottomLeft = 3,
    MiddleTlBr = 4,
    MiddleTrBl = 5
}
const highBridgeHeadMapping = new Map<HighBridgeHeadType, string[]>([
    [HighBridgeHeadType.TopLeft, ['BridgeTopLeft1', 'BridgeTopLeft2']],
    [HighBridgeHeadType.BottomRight, ['BridgeBottomRight1', 'BridgeBottomRight2']],
    [HighBridgeHeadType.TopRight, ['BridgeTopRight1', 'BridgeTopRight2']],
    [HighBridgeHeadType.BottomLeft, ['BridgeBottomLeft1', 'BridgeBottomLeft2']],
    [HighBridgeHeadType.MiddleTlBr, ['BridgeMiddle1']],
    [HighBridgeHeadType.MiddleTrBl, ['BridgeMiddle2']],
]);
export class TileSets {
    private theaterIni: IniFile;
    private tileSets: TileSet[] = [];
    private orderedEntries: TileSetEntry[] = [];
    private highBridgeSetNums: number[];
    private cliffSetNums: number[];
    constructor(theaterIni: IniFile) {
        this.theaterIni = theaterIni;
        this.highBridgeSetNums = [
            this.getGeneralValue('BridgeSet'),
            this.getGeneralValue('WoodBridgeSet'),
        ];
        this.cliffSetNums = [
            this.getGeneralValue('CliffSet'),
            this.getGeneralValue('WaterCliffs'),
            this.getGeneralValue('DestroyableCliffs'),
        ];
    }
    public getTile(tileNum: number): TileSetEntry | undefined {
        return this.orderedEntries[tileNum];
    }
    public getTileImage(tileNum: number, subTile: number, randomIndexSelector: (min: number, max: number) => number): unknown {
        const tileEntry = this.getTile(tileNum);
        if (!tileEntry) {
            throw new Error(`TileNum ${tileNum} not found`);
        }
        const tmpFile = tileEntry.getTmpFile(subTile, randomIndexSelector);
        if (!tmpFile || subTile >= tmpFile.images.length) {
            throw new Error(`SubTile ${subTile} not found`);
        }
        return tmpFile.images[subTile];
    }
    public getSetNum(tileNum: number): number {
        const tileEntry = this.orderedEntries[tileNum];
        if (!tileEntry) {
            throw new Error('Invalid tileNum ' + tileNum);
        }
        return this.tileSets.indexOf(tileEntry.owner);
    }
    public getTileNumFromSet(setIndex: number, tileIndexInSet = 0): number {
        let totalTileCount = 0;
        this.tileSets.some((set, currentIndex) => {
            if (currentIndex === setIndex) {
                totalTileCount += tileIndexInSet;
                return true;
            }
            totalTileCount += set.entries.length;
            return false;
        });
        return totalTileCount;
    }
    public getGeneralValue(key: string): number {
        const generalSection = this.theaterIni.getSection('General');
        if (!generalSection) {
            throw new Error('Missing [General] section in theater ini');
        }
        return generalSection.getNumber(key);
    }
    public loadTileData(vfs: any, extension: string): void {
        this.tileSets.length = 0;
        this.orderedEntries.length = 0;
        this.initTileSets(vfs, extension);
        this.initAnimations();
    }
    public readMaxTileNum(): number {
        let setIndex = 0;
        let totalTiles = 0;
        for (;;) {
            const sectionName = 'TileSet' + stringUtils.pad(String(setIndex), '0000');
            const section = this.theaterIni.getSection(sectionName);
            if (!section) {
                break;
            }
            setIndex++;
            totalTiles += section.getNumber('TilesInSet');
        }
        return totalTiles;
    }
    private initTileSets(vfs: any, extension: string): void {
        let setIndex = 0;
        let section;
        for (;;) {
            const sectionName = 'TileSet' + stringUtils.pad(String(setIndex), '0000');
            section = this.theaterIni.getSection(sectionName);
            if (!section) {
                break;
            }
            setIndex++;
            const tileSet = new TileSet(section.getString('FileName'), section.getString('SetName'), section.getNumber('TilesInSet'));
            this.tileSets.push(tileSet);
            for (let i = 1; i <= tileSet.tilesInSet; i++) {
                const entry = new TileSetEntry(tileSet, i - 1);
                const charA = 'a'.charCodeAt(0);
                for (let charCode = charA - 1; charCode <= 'z'.charCodeAt(0); charCode++) {
                    if (!(charCode >= charA && tileSet.setName === 'Bridges')) {
                        let fileName = tileSet.fileName + stringUtils.pad(String(i), '00');
                        if (charCode >= charA) {
                            fileName += String.fromCharCode(charCode);
                        }
                        fileName += extension;
                        const fileData = vfs.get(fileName) as TmpFile | null;
                        if (!fileData) {
                            break;
                        }
                        entry.addFile(fileData);
                    }
                }
                tileSet.entries.push(entry);
                this.orderedEntries.push(entry);
            }
        }
    }
    private initAnimations(): void {
        const orderedSections = this.theaterIni.getOrderedSections();
        for (let i = this.tileSets.length; i < orderedSections.length; ++i) {
            const section = orderedSections[i];
            const tileSet = this.tileSets.find((ts) => ts.setName === section.name);
            if (tileSet) {
                for (let j = 1; j <= tileSet.tilesInSet; ++j) {
                    const tileKey = 'Tile' + stringUtils.pad(String(j), '00');
                    const animKey = tileKey + 'Anim';
                    const animName = section.getString(animKey);
                    if (animName) {
                        const anim = new TileSetAnim(animName, section.getNumber(tileKey + 'AttachesTo'), section.getNumber(tileKey + 'XOffset'), section.getNumber(tileKey + 'YOffset'));
                        tileSet.entries[j - 1].setAnimation(anim);
                    }
                    else {
                        console.warn(`Missing anim "${animKey}" for tileset ` + tileSet.setName);
                    }
                }
            }
        }
    }
    public isLAT(setNum: number): boolean {
        return (setNum === this.getGeneralValue('RoughTile') ||
            setNum === this.getGeneralValue('SandTile') ||
            setNum === this.getGeneralValue('GreenTile') ||
            setNum === this.getGeneralValue('PaveTile'));
    }
    public isCLAT(setNum: number): boolean {
        return (setNum === this.getGeneralValue('ClearToRoughLat') ||
            setNum === this.getGeneralValue('ClearToSandLat') ||
            setNum === this.getGeneralValue('ClearToGreenLat') ||
            setNum === this.getGeneralValue('ClearToPaveLat'));
    }
    public getLAT(clatSetNum: number): number {
        if (clatSetNum === this.getGeneralValue('ClearToRoughLat')) {
            return this.getGeneralValue('RoughTile');
        }
        if (clatSetNum === this.getGeneralValue('ClearToSandLat')) {
            return this.getGeneralValue('SandTile');
        }
        if (clatSetNum === this.getGeneralValue('ClearToGreenLat')) {
            return this.getGeneralValue('GreenTile');
        }
        if (clatSetNum === this.getGeneralValue('ClearToPaveLat')) {
            return this.getGeneralValue('PaveTile');
        }
        return -1;
    }
    public getCLATSet(latSetNum: number): number {
        if (latSetNum === this.getGeneralValue('RoughTile')) {
            return this.getGeneralValue('ClearToRoughLat');
        }
        if (latSetNum === this.getGeneralValue('SandTile')) {
            return this.getGeneralValue('ClearToSandLat');
        }
        if (latSetNum === this.getGeneralValue('GreenTile')) {
            return this.getGeneralValue('ClearToGreenLat');
        }
        if (latSetNum === this.getGeneralValue('PaveTile')) {
            return this.getGeneralValue('ClearToPaveLat');
        }
        return -1;
    }
    public canConnectTiles(setNum1: number, setNum2: number): boolean {
        if (setNum1 === setNum2)
            return false;
        const greenTile = this.getGeneralValue('GreenTile');
        const paveTile = this.getGeneralValue('PaveTile');
        const miscPaveTile = this.getGeneralValue('MiscPaveTile');
        const shorePieces = this.getGeneralValue('ShorePieces');
        const waterBridge = this.getGeneralValue('WaterBridge');
        const pavedRoads = this.getGeneralValue('PavedRoads');
        const medians = this.getGeneralValue('Medians');
        return !((setNum1 === greenTile && setNum2 === shorePieces) ||
            (setNum2 === greenTile && setNum1 === shorePieces) ||
            (setNum1 === greenTile && setNum2 === waterBridge) ||
            (setNum2 === greenTile && setNum1 === waterBridge) ||
            (setNum1 === paveTile && setNum2 === pavedRoads) ||
            (setNum2 === paveTile && setNum1 === pavedRoads) ||
            (setNum1 === paveTile && setNum2 === miscPaveTile) ||
            (setNum2 === paveTile && setNum1 === miscPaveTile) ||
            (setNum1 === paveTile && setNum2 === medians) ||
            (setNum2 === paveTile && setNum1 === medians));
    }
    public getHighBridgeHeadType(tileIndex: number): HighBridgeHeadType | undefined {
        for (const [type, names] of highBridgeHeadMapping) {
            for (const name of names) {
                if (this.getGeneralValue(name) === tileIndex + 1) {
                    return type;
                }
            }
        }
        return undefined;
    }
    public getOppositeHighBridgeHeadType(headType: HighBridgeHeadType): HighBridgeHeadType {
        switch (headType) {
            case HighBridgeHeadType.TopLeft:
                return HighBridgeHeadType.BottomRight;
            case HighBridgeHeadType.TopRight:
                return HighBridgeHeadType.BottomLeft;
            case HighBridgeHeadType.BottomLeft:
                return HighBridgeHeadType.TopRight;
            case HighBridgeHeadType.BottomRight:
                return HighBridgeHeadType.TopLeft;
            case HighBridgeHeadType.MiddleTlBr:
            case HighBridgeHeadType.MiddleTrBl:
                throw new Error('Middle bridge heads can\'t have opposites');
            default:
                throw new Error(`Unhandled headType ${headType}`);
        }
    }
    public isCliffTile(tileNum: number): boolean {
        return this.cliffSetNums.includes(this.getSetNum(tileNum));
    }
    public isHighBridgeBoundaryTile(tileNum: number): boolean {
        if (this.highBridgeSetNums.includes(this.getSetNum(tileNum))) {
            const tileEntry = this.getTile(tileNum);
            const headType = this.getHighBridgeHeadType(tileEntry.index);
            return (headType !== undefined &&
                ![HighBridgeHeadType.MiddleTlBr, HighBridgeHeadType.MiddleTrBl].includes(headType));
        }
        return false;
    }
    public isHighBridgeMiddleTile(tileNum: number): boolean {
        if (this.highBridgeSetNums.includes(this.getSetNum(tileNum))) {
            const tileEntry = this.getTile(tileNum);
            const headType = this.getHighBridgeHeadType(tileEntry.index);
            return (headType !== undefined &&
                [HighBridgeHeadType.MiddleTlBr, HighBridgeHeadType.MiddleTrBl].includes(headType));
        }
        return false;
    }
}
