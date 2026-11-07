import { MixinRulesType } from './MixinRulesType';
export class MixinRules {
    static getTypes(config: {
        noDogEngiKills?: boolean;
        balanceChanges?: boolean;
    }): MixinRulesType[] {
        const types: MixinRulesType[] = [];
        if (config.noDogEngiKills) {
            types.push(MixinRulesType.NoDogEngiKills);
        }
        if (config.balanceChanges) {
            types.push(MixinRulesType.BalanceChanges);
        }
        return types;
    }
}
