
export enum NodeStatus {
    RUNNING = 'RUNNING',
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE'
}

export abstract class BehaviorNode {
    abstract tick(npc: any, blackboard?: any): NodeStatus;
}

export class Sequence extends BehaviorNode {
    constructor(private children: BehaviorNode[]) { super(); }
    tick(npc: any, blackboard?: any): NodeStatus {
        for (const child of this.children) {
            const status = child.tick(npc, blackboard);
            if (status !== NodeStatus.SUCCESS) return status;
        }
        return NodeStatus.SUCCESS;
    }
}

export class Selector extends BehaviorNode {
    constructor(private children: BehaviorNode[]) { super(); }
    tick(npc: any, blackboard?: any): NodeStatus {
        for (const child of this.children) {
            const status = child.tick(npc, blackboard);
            if (status !== NodeStatus.FAILURE) return status;
        }
        return NodeStatus.FAILURE;
    }
}
