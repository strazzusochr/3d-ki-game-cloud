
import { BehaviorNode, NodeStatus } from './BaseNodes';

export class FollowLeader extends BehaviorNode {
    tick(npc: any, blackboard: any): NodeStatus {
        const leader = blackboard.leader;
        if (!leader) return NodeStatus.FAILURE;
        
        const dx = leader.x - npc.x;
        const dz = leader.z - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 3.0) return NodeStatus.SUCCESS;
        
        // Folge dem Anführer mit leichtem Offset
        npc.targetX = leader.x + (Math.random() - 0.5) * 2;
        npc.targetZ = leader.z + (Math.random() - 0.5) * 2;
        return NodeStatus.RUNNING;
    }
}

export class MoveToTarget extends BehaviorNode {
    tick(npc: any, blackboard: any): NodeStatus {
        if (!npc.targetX) return NodeStatus.FAILURE;
        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        if (dist < 1.0) {
            npc.targetX = undefined;
            npc.targetZ = undefined;
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.RUNNING;
    }
}

export class RandomPatrol extends BehaviorNode {
    tick(npc: any, blackboard: any): NodeStatus {
        if (!npc.targetX) {
            // Patrouilliere nur innerhalb des Parks [-25, 25]
            npc.targetX = (Math.random() - 0.5) * 50;
            npc.targetZ = (Math.random() - 0.5) * 50;
        }
        return NodeStatus.SUCCESS;
    }
}

export class IdleWait extends BehaviorNode {
    private waitTime = Math.random() * 2000 + 1000;
    private start = performance.now();
    
    tick(npc: any, blackboard: any): NodeStatus {
        if (performance.now() - this.start > this.waitTime) {
            this.start = performance.now();
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.RUNNING;
    }
}
