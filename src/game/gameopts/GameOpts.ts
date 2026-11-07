export function isHumanPlayerInfo(info: any): boolean {
    return "name" in info;
}
export enum AiDifficulty {
    Brutal = 0,
    Medium = 1,
    Easy = 2,
    MediumSea = 3,
    Normal = 4,
    Custom = 5,
}
export interface HumanPlayerInfo {
    name: string;
    countryId: number;
    colorId: number;
    startPos: number;
    teamId: number;
}
export interface AiPlayerInfo {
    difficulty: AiDifficulty;
    customBotId?: string;
    countryId: number;
    colorId: number;
    startPos: number;
    teamId: number;
}
export interface GameOpts {
    gameMode: number;
    gameSpeed: number;
    credits: number;
    unitCount: number;
    shortGame: boolean;
    superWeapons: boolean;
    buildOffAlly: boolean;
    mcvRepacks: boolean;
    cratesAppear: boolean;
    hostTeams?: boolean;
    destroyableBridges: boolean;
    multiEngineer: boolean;
    instantCapture?: boolean;
    delayedOils?: boolean;
    noDogEngiKills: boolean;
    /** v0.85 option: apply the official balance rules mixin. */
    balanceChanges?: boolean;
    mapName: string;
    mapTitle: string;
    mapDigest: string;
    mapSizeBytes: number;
    maxSlots: number;
    mapOfficial: boolean;
    humanPlayers: HumanPlayerInfo[];
    aiPlayers: (AiPlayerInfo | undefined)[];
    unknown?: string;
}
