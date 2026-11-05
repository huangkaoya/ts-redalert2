import { EventDispatcher } from '@/util/event';
export enum QueueType {
    Structures = 0,
    Armory = 1,
    Infantry = 2,
    Vehicles = 3,
    Aircrafts = 4,
    Ships = 5
}
export enum QueueStatus {
    Idle = 0,
    Active = 1,
    OnHold = 2,
    Ready = 3
}
interface QueueItem {
    rules: any;
    quantity: number;
    creditsEach: number;
    creditsSpent: number;
    creditsSpentLeftover: number;
    progress: number;
}
export class ProductionQueue {
    public readonly type: QueueType;
    private _maxSize: number;
    private maxItemQuantity: number;
    private items: QueueItem[];
    private size: number;
    private _status: QueueStatus;
    private _onUpdate: EventDispatcher<ProductionQueue>;
    get onUpdate() {
        return this._onUpdate.asEvent();
    }
    constructor(type: QueueType, maxSize: number, maxItemQuantity: number) {
        this.type = type;
        this._maxSize = maxSize;
        this.maxItemQuantity = maxItemQuantity;
        this.items = [];
        this.size = 0;
        this._status = QueueStatus.Idle;
        this._onUpdate = new EventDispatcher();
    }
    get status(): QueueStatus {
        return this._status;
    }
    set status(value: QueueStatus) {
        const oldStatus = this._status;
        this._status = value;
        if (value !== oldStatus) {
            this._onUpdate.dispatch(this);
        }
    }
    get maxSize(): number {
        return this._maxSize;
    }
    set maxSize(value: number) {
        const oldSize = this.size;
        this.size = Math.min(value, this.size);
        let totalQuantity = 0;
        let itemIndex = 0;
        while (totalQuantity <= this.size && itemIndex < this.items.length) {
            const item = this.items[itemIndex];
            totalQuantity += item.quantity;
            if (totalQuantity > this.size) {
                item.quantity -= totalQuantity - this.size;
            }
            if (item.quantity > 0) {
                itemIndex++;
            }
        }
        this._maxSize = value;
        if (this.items[itemIndex]) {
            this.items.splice(itemIndex);
        }
        if (oldSize !== this.size) {
            if (!this.size) {
                this._status = QueueStatus.Idle;
            }
            this._onUpdate.dispatch(this);
        }
    }
    get currentSize(): number {
        return this.size;
    }
    find(rules: any): QueueItem[] {
        return this.items.filter(item => item.rules === rules);
    }
    getFirst(): QueueItem | undefined {
        return this.items[0];
    }
    getAll(): QueueItem[] {
        return [...this.items];
    }
    push(rules: any, quantity: number, creditsEach: number) {
        quantity = Math.min(this.maxSize - this.size, quantity);
        const existingQuantity = this.find(rules).reduce((sum, item) => sum + item.quantity, 0);
        quantity = Math.min(this.maxItemQuantity - existingQuantity, quantity);
        if (!quantity) {
            return;
        }
        const lastItem = this.items[this.items.length - 1];
        if (lastItem?.rules === rules) {
            lastItem.quantity += quantity;
        }
        else {
            this.items.push({
                rules,
                quantity,
                creditsEach,
                creditsSpent: 0,
                creditsSpentLeftover: 0,
                progress: 0
            });
        }
        this.size += quantity;
        if (this._status === QueueStatus.Idle) {
            this._status = QueueStatus.Active;
        }
        this._onUpdate.dispatch(this);
    }
    insertAfterFirst(rules: any, quantity: number, creditsEach: number) {
        quantity = Math.min(this.maxSize - this.size, quantity);
        const existingQuantity = this.find(rules).reduce((sum, item) => sum + item.quantity, 0);
        quantity = Math.min(this.maxItemQuantity - existingQuantity, quantity);
        if (!quantity) {
            return;
        }
        if (!this.items.length) {
            this.push(rules, quantity, creditsEach);
            return;
        }
        const first = this.items[0];
        const firstRemainingQuantity = Math.max(0, first.quantity - 1);
        first.quantity = 1;
        const items = [first];
        const tail = this.items.slice(1);
        items.push({
            rules,
            quantity,
            creditsEach,
            creditsSpent: 0,
            creditsSpentLeftover: 0,
            progress: 0,
        });
        if (firstRemainingQuantity > 0) {
            items.push({
                rules: first.rules,
                quantity: firstRemainingQuantity,
                creditsEach: first.creditsEach,
                creditsSpent: 0,
                creditsSpentLeftover: 0,
                progress: 0,
            });
        }
        items.push(...tail);
        this.items = items;
        this.size += quantity;
        if (this._status === QueueStatus.Idle) {
            this._status = QueueStatus.Active;
        }
        this._onUpdate.dispatch(this);
    }
    pop(rules: any, quantity: number) {
        this.remove(rules, quantity, false);
    }
    shift(rules: any, quantity: number) {
        this.remove(rules, quantity, true);
    }
    private remove(rules: any, quantity: number, fromStart: boolean) {
        const matchingItems = this.find(rules);
        if (!matchingItems.length) {
            throw new Error(`Can't remove non-existent item ${rules.name} from queue ${QueueType[this.type]}`);
        }
        const totalQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantity < quantity) {
            throw new Error(`Attempted to remove a quantity larger than the one in queue (${rules.name})`);
        }
        let remainingQuantity = quantity;
        while (remainingQuantity > 0) {
            const item = fromStart ? matchingItems.shift() : matchingItems.pop();
            if (item!.quantity <= remainingQuantity) {
                const wasFirst = this.getFirst() === item;
                this.items.splice(this.items.indexOf(item!), 1);
                if (wasFirst) {
                    this._status = QueueStatus.Active;
                }
                remainingQuantity -= item!.quantity;
            }
            else {
                item!.quantity -= remainingQuantity;
                remainingQuantity = 0;
            }
        }
        this.size -= quantity;
        if (quantity) {
            if (!this.size) {
                this._status = QueueStatus.Idle;
            }
            this._onUpdate.dispatch(this);
        }
    }
    notifyUpdated() {
        this._onUpdate.dispatch(this);
    }
}
