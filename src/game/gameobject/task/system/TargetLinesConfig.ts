export interface TargetLinesConfig {
    isAttack?: boolean;
    pathNodes?: any[];
    target?: any;
}
export function cloneConfig(config: TargetLinesConfig | undefined): TargetLinesConfig | undefined {
    return config ? { ...config } : undefined;
}
export function configsAreEqual(config1: TargetLinesConfig | undefined, config2: TargetLinesConfig | undefined): boolean {
    return (!config1 && !config2) ||
        (config1?.isAttack === config2?.isAttack &&
            config1?.pathNodes === config2?.pathNodes &&
            config1?.target === config2?.target);
}
export function configHasTarget(config: TargetLinesConfig | undefined): boolean {
    return !(!config?.pathNodes.length && !config?.target);
}
