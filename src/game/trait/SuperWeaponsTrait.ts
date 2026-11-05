import { NotifyWarpChange } from "@/game/trait/interface/NotifyWarpChange";
import { SuperWeapon, SuperWeaponStatus } from "@/game/SuperWeapon";
import { SuperWeaponEffect, EffectStatus } from "@/game/superweapon/SuperWeaponEffect";
import { NotifyPower } from "@/game/trait/interface/NotifyPower";
import { NotifyTick } from "@/game/trait/interface/NotifyTick";
import { SuperWeaponType } from "@/game/type/SuperWeaponType";
import { NotifySuperWeaponActivate } from "@/game/trait/interface/NotifySuperWeaponActivate";
import { SuperWeaponActivateEvent } from "@/game/event/SuperWeaponActivateEvent";
import { ParadropEffect } from "@/game/superweapon/ParadropEffect";
import { NukeEffect } from "@/game/superweapon/NukeEffect";
import { LightningStormEffect } from "@/game/superweapon/LightningStormEffect";
import { IronCurtainEffect } from "@/game/superweapon/IronCurtainEffect";
import { ChronoSphereEffect } from "@/game/superweapon/ChronoSphereEffect";
import { NotifySuperWeaponDeactivate } from "@/game/trait/interface/NotifySuperWeaponDeactivate";
import { ObjectType } from "@/engine/type/ObjectType";
export class SuperWeaponsTrait {
    private effects: SuperWeaponEffect[] = [];
    [NotifyTick.onTick](t: any) {
        for (const e of t.getCombatants()) {
            for (const i of e.superWeaponsTrait.getAll()) {
                i.update(t);
            }
        }
        for (const r of this.effects) {
            if (r.status === EffectStatus.NotStarted) {
                r.onStart(t);
                r.status = EffectStatus.Running;
            }
            if (r.onTick(t)) {
                r.status = EffectStatus.Finished;
                t.traits
                    .filter(NotifySuperWeaponDeactivate)
                    .forEach((e) => {
                    e[NotifySuperWeaponDeactivate.onDeactivate](r.type, r.owner, t);
                });
            }
        }
        this.effects = this.effects.filter((e) => e.status !== EffectStatus.Finished);
    }
    [NotifyPower.onPowerLow](e: any, t: any) {
        e.superWeaponsTrait
            ?.getAll()
            ?.filter((e: any) => e.rules.isPowered)
            .forEach((e: any) => {
            this.updateTimer(e, false);
        });
    }
    [NotifyPower.onPowerRestore](e: any, t: any) {
        e.superWeaponsTrait
            ?.getAll()
            ?.filter((e: any) => e.rules.isPowered)
            .forEach((e: any) => {
            this.updateTimer(e, true);
        });
    }
    [NotifyPower.onPowerChange](e: any, t: any) { }
    [NotifyWarpChange.onChange](e: any, t: any) {
        let i: any;
        if (e.owner.powerTrait && e.isBuilding() && e.superWeaponTrait &&
            (i = e.superWeaponTrait.getSuperWeapon(e))) {
            this.updateTimer(i, !e.owner.powerTrait.isLowPower());
        }
    }
    private updateTimer(e: any, t: boolean) {
        const i = this.superWeaponHasValidBuilding(e);
        if (t && i) {
            e.resumeTimer();
        }
        else {
            e.pauseTimer();
        }
    }
    private superWeaponHasValidBuilding(t: any) {
        return [...t.owner.buildings].find((e: any) => !(e.superWeaponTrait?.getSuperWeapon(e) !== t ||
            (e.warpedOutTrait.isActive() && t.rules.isPowered)));
    }
    private addEffect(e: SuperWeaponEffect) {
        this.effects.push(e);
    }
    activateSuperWeapon(t: SuperWeaponType, e: any, i: any, r: any, s: any) {
        const a = e.superWeaponsTrait
            ?.getAll()
            .find((e: any) => e.rules.type === t);
        if (a && a.status === SuperWeaponStatus.Ready) {
            if (a.oneTimeOnly) {
                e.superWeaponsTrait.remove(a.name);
                for (const n of e.buildings) {
                    if (n.rules.superWeapon === a.name && n.superWeaponTrait) {
                        n.superWeaponTrait.addSuperWeaponToPlayerIfNeeded(e, i);
                    }
                }
            }
            else {
                a.resetTimer();
            }
            this.activateEffect(a.rules, e, i, r, s);
        }
    }
    private activateEffect(e: any, i: any, r: any, s: any, a: any, n: boolean = false) {
        const o = e.type;
        if (o !== undefined) {
            const t: SuperWeaponEffect[] = [];
            switch (o) {
                case SuperWeaponType.AmerParaDrop:
                    for (const [l, c] of r.rules.general.paradrop.amerParaDrop.entries()) {
                        if (r.rules.hasObject(c.inf, ObjectType.Infantry)) {
                            t.push(new ParadropEffect(o, i, s, c, l));
                        }
                        else {
                            console.warn(`Can't paradrop unknown infantry type "${c.inf}"`);
                        }
                    }
                    break;
                case SuperWeaponType.ParaDrop: {
                    const e = r.rules.general.paradrop.getParadropSquads(i.country.side);
                    for (const [h, u] of e.entries()) {
                        if (r.rules.hasObject(u.inf, ObjectType.Infantry)) {
                            t.push(new ParadropEffect(o, i, s, u, h));
                        }
                        else {
                            console.warn(`Can't paradrop unknown infantry type "${u.inf}"`);
                        }
                    }
                    break;
                }
                case SuperWeaponType.MultiMissile:
                    if (!e.weaponType) {
                        throw new Error("Missing WeaponType in super weapon rules");
                    }
                    t.push(new NukeEffect(o, i, s, e.weaponType));
                    break;
                case SuperWeaponType.LightningStorm:
                    t.push(new LightningStormEffect(o, i, s));
                    break;
                case SuperWeaponType.IronCurtain:
                    t.push(new IronCurtainEffect(o, i, s));
                    break;
                case SuperWeaponType.ChronoSphere:
                    if (!a) {
                        throw new Error("Missing tile2 action param");
                    }
                    t.push(new ChronoSphereEffect(o, i, s, a));
                    break;
            }
            for (const d of t) {
                this.addEffect(d);
            }
            r.traits.filter(NotifySuperWeaponActivate).forEach((e) => {
                e[NotifySuperWeaponActivate.onActivate](o, i, r, s, a);
            });
            r.events.dispatch(new SuperWeaponActivateEvent(o, i, s, a, n));
        }
    }
}
