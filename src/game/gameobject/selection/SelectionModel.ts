import { SelectionLevel } from './SelectionLevel';
import { GameObject } from '../GameObject';
export class SelectionModel {
    private selectionLevel: SelectionLevel;
    private maxSelectionLevel: SelectionLevel;
    private controlGroupNumber?: number;
    constructor(gameObject: GameObject) {
        this.selectionLevel = SelectionLevel.None;
        if (gameObject.isBuilding() && gameObject.rules.wall) {
            this.maxSelectionLevel = SelectionLevel.None;
        }
        else {
            this.maxSelectionLevel = gameObject.rules.selectable
                ? SelectionLevel.Selected | SelectionLevel.Hover
                : SelectionLevel.Hover;
        }
    }
    getSelectionLevel(): SelectionLevel {
        return this.selectionLevel;
    }
    setSelectionLevel(level: SelectionLevel): void {
        this.selectionLevel = Math.min(this.maxSelectionLevel, level);
    }
    setHover(hover: boolean): void {
        this.setSelectionLevel(hover
            ? this.selectionLevel | SelectionLevel.Hover
            : this.selectionLevel & ~SelectionLevel.Hover);
    }
    setSelected(selected: boolean): void {
        this.setSelectionLevel(selected
            ? this.selectionLevel | SelectionLevel.Selected
            : this.selectionLevel & ~SelectionLevel.Selected);
    }
    isHovered(): boolean {
        // 完善模拟层逻辑：bit-mask Hover, not a right-shift of the Hover enum value.
        return Boolean(this.selectionLevel & SelectionLevel.Hover);
    }
    isSelected(): boolean {
        return this.selectionLevel >= SelectionLevel.Selected;
    }
    getControlGroupNumber(): number | undefined {
        return this.controlGroupNumber;
    }
    setControlGroupNumber(number: number): void {
        this.controlGroupNumber = number;
    }
}
