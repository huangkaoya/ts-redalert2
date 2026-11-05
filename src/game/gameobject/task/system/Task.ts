import { TaskStatus } from "./TaskStatus";
export class Task {
    public status: TaskStatus;
    public children: Task[];
    public cancellable: boolean;
    public useChildTargetLines: boolean;
    public blocking: boolean;
    public waitingForChildrenToFinish: boolean;
    public preventOpportunityFire: boolean;
    public preventLanding: boolean;
    public isAttackMove: boolean;
    constructor() {
        this.status = TaskStatus.NotStarted;
        this.children = [];
        this.cancellable = true;
        this.useChildTargetLines = false;
        this.blocking = true;
        this.waitingForChildrenToFinish = false;
        this.preventOpportunityFire = true;
        this.preventLanding = true;
        this.isAttackMove = false;
    }
    isRunning(): boolean {
        return this.status === TaskStatus.Running;
    }
    isCancelling(): boolean {
        return this.status === TaskStatus.Cancelling;
    }
    setCancellable(value: boolean): this {
        this.cancellable = value;
        return this;
    }
    setBlocking(value: boolean): this {
        this.blocking = value;
        return this;
    }
    onStart(object: any): void { }
    onEnd(object: any): void { }
    cancel(): void {
        if (this.cancellable) {
            if (this.status === TaskStatus.Running) {
                this.status = TaskStatus.Cancelling;
                if (this.children.length) {
                    this.children.forEach(child => child.cancel());
                }
            }
            else if (this.status === TaskStatus.NotStarted) {
                // 完善模拟层逻辑：always mark Cancelled first; only throw if children already exist.
                this.status = TaskStatus.Cancelled;
                if (this.children.length) {
                    throw new Error("Should't have any children before starting a task");
                }
            }
        }
    }
    getTargetLinesConfig(object: any): any { }
}
