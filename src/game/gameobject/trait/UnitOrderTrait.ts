import { TaskRunner } from "@/game/gameobject/task/system/TaskRunner";
import { TaskStatus } from "@/game/gameobject/task/system/TaskStatus";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { WaitTicksTask } from "@/game/gameobject/task/system/WaitTicksTask";
import { NotifyOwnerChange } from "@/game/gameobject/trait/interface/NotifyOwnerChange";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { NotifyTeleport } from "@/game/gameobject/trait/interface/NotifyTeleport";
import { NotifyOrder } from "@/game/gameobject/trait/interface/NotifyOrder";
interface GameObject {
    isSpawned: boolean;
    resetGuardModeToIdle(): void;
    traits: {
        filter(type: any): any[];
    };
    unitOrderTrait: UnitOrderTrait;
}
interface Task {
    isCancelling(): boolean;
    cancel(): void;
    status: TaskStatus;
    useChildTargetLines?: boolean;
    children?: Task[];
    getTargetLinesConfig?(gameObject: GameObject): any;
}
interface Order {
    isValid(): boolean;
    isAllowed(): boolean;
    process(): Task[] | null;
    onAdd(tasks: Task[], queued: boolean): boolean | void;
    orderType: string;
}
interface Waypoint {
    next?: Waypoint;
}
interface WaypointPath {
    waypoints: Waypoint[];
    units: GameObject[];
}
export class UnitOrderTrait implements NotifyTick, NotifyOwnerChange, NotifyTeleport {
    private gameObject: GameObject;
    private orders: Order[] = [];
    private queuedOrders = new Set<Order>();
    private tasks: Task[] = [];
    private taskRunner = new TaskRunner();
    private waypointPath?: WaypointPath;
    private currentWaypoint?: Waypoint;
    private targetLinesTask?: Task;
    private targetLinesConfig?: any;
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
    }
    [NotifyTick.onTick](gameObject: GameObject, deltaTime: number): void {
        if (!gameObject.isSpawned)
            return;
        const hasTasks = this.hasTasks();
        const currentTask = this.tasks.find(task => !task.isCancelling());
        if (hasTasks) {
            this.taskRunner.tick(this.tasks as any, gameObject);
        }
        if (!gameObject.isSpawned)
            return;
        const orderCount = this.orders.length;
        if (orderCount && (!hasTasks || !currentTask)) {
            let processedOrder = false;
            while (this.orders.length > 0) {
                const order = this.orders[0];
                if (order.isValid() && order.isAllowed()) {
                    const newTasks = order.process();
                    if (newTasks) {
                        if (this.queuedOrders.has(order)) {
                            this.tasks.push(new WaitTicksTask(5) as any);
                            this.tasks.push(new CallbackTask(() => {
                                gameObject.resetGuardModeToIdle();
                            }) as any);
                        }
                        this.tasks.push(...newTasks);
                        if (!hasTasks) {
                            this.taskRunner.tick(this.tasks as any, gameObject);
                        }
                    }
                    processedOrder = true;
                }
                this.orders.shift();
                this.queuedOrders.delete(order);
                if (!gameObject.isSpawned)
                    return;
                if (this.waypointPath) {
                    if (this.currentWaypoint) {
                        this.cleanupWaypoint(this.currentWaypoint, this.waypointPath);
                        this.currentWaypoint = this.currentWaypoint.next;
                    }
                    else {
                        this.currentWaypoint = this.waypointPath.waypoints[0];
                    }
                    if (!this.currentWaypoint) {
                        this.cleanupWaypointPath();
                    }
                }
                if (processedOrder)
                    break;
            }
        }
        if (!orderCount && !hasTasks && this.waypointPath && this.currentWaypoint) {
            this.cleanupWaypoint(this.currentWaypoint, this.waypointPath);
            this.cleanupWaypointPath();
        }
        let targetTask = currentTask;
        while (targetTask?.useChildTargetLines) {
            const childTask = targetTask.children.find(child => !child.isCancelling());
            if (!childTask)
                break;
            targetTask = childTask;
        }
        if (this.targetLinesTask !== targetTask) {
            this.targetLinesTask = targetTask;
            this.targetLinesConfig = targetTask?.getTargetLinesConfig(this.gameObject);
        }
    }
    [NotifyOwnerChange.onChange](): void {
        this.clearOrders();
        this.cancelAllTasks();
    }
    [NotifyTeleport.onBeforeTeleport](gameObject: GameObject, fromPos: any, toPos: any, crossRealm: boolean): void {
        if (toPos && !crossRealm) {
            this.clearOrders();
            this.tasks.length = 0;
        }
    }
    addOrder(order: Order, queued = false): void {
        const addResult = order.onAdd(this.tasks, queued);
        if (addResult === false) {
            this.targetLinesTask = undefined;
            return;
        }
        if (!queued) {
            this.clearOrders();
            this.tasks = this.tasks.filter(task => task.status !== TaskStatus.NotStarted);
            this.tasks.forEach(task => task.cancel());
        }
        this.orders.push(order);
        if (queued) {
            this.queuedOrders.add(order);
        }
        this.gameObject.traits
            .filter(NotifyOrder)
            .forEach(trait => {
            trait[NotifyOrder.onPush](this.gameObject, order.orderType);
        });
    }
    clearOrders(): void {
        this.orders.length = 0;
        this.queuedOrders.clear();
        if (this.currentWaypoint && this.waypointPath) {
            this.cleanupWaypoint(this.currentWaypoint, this.waypointPath);
        }
        this.cleanupWaypointPath();
        this.gameObject.resetGuardModeToIdle();
    }
    unmarkNextQueuedOrder(): void {
        if (this.orders.length > 0) {
            this.queuedOrders.delete(this.orders[0]);
        }
    }
    hasTasks(): boolean {
        return this.tasks.length > 0;
    }
    isIdle(): boolean {
        return this.orders.length === 0 && this.tasks.length === 0;
    }
    getCurrentTask(): Task | undefined {
        return this.tasks[0];
    }
    cancelAllTasks(): void {
        this.tasks.forEach(task => task.cancel());
    }
    addTask(task: Task): void {
        this.tasks.push(task);
    }
    addTasks(...tasks: Task[]): void {
        tasks.forEach(task => this.addTask(task));
    }
    addTaskToFront(task: Task): void {
        this.tasks.unshift(task);
    }
    addTaskNext(task: Task): void {
        this.tasks.splice(1, 0, task);
    }
    getTasks(): Task[] {
        return [...this.tasks];
    }
    dispose(): void {
        this.clearOrders();
        this.tasks.length = 0;
        this.gameObject = undefined as any;
    }
    private cleanupWaypointPath(): void {
        // 完善模拟层逻辑：always splice(indexOf(...), 1) with no -1 guard.
        if (this.waypointPath) {
            this.waypointPath.units.splice(
                this.waypointPath.units.indexOf(this.gameObject),
                1,
            );
            if (!this.waypointPath.units.length) {
                this.waypointPath.waypoints.forEach((waypoint) => {
                    waypoint.next = undefined;
                });
                this.waypointPath.waypoints.length = 0;
            }
            this.waypointPath = undefined;
        }
        this.currentWaypoint = undefined;
    }
    private cleanupWaypoint(waypoint: Waypoint, waypointPath: WaypointPath): void {
        const isWaypointInUse = waypointPath.units.find(unit => {
            if (unit === this.gameObject)
                return false;
            const otherCurrentWaypoint = unit.unitOrderTrait.currentWaypoint ??
                unit.unitOrderTrait.waypointPath?.waypoints[0];
            return otherCurrentWaypoint === waypoint;
        });
        const isReferencedAsNext = waypointPath.waypoints.find(wp => wp.next === waypoint);
        if (!isWaypointInUse && !isReferencedAsNext) {
            const waypointIndex = waypointPath.waypoints.indexOf(waypoint);
            if (waypointIndex === -1) {
                throw new Error("Given waypoint not found in waypoint path");
            }
            waypointPath.waypoints.splice(waypointIndex, 1);
        }
    }
}
