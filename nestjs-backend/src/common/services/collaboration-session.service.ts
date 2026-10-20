import { Injectable, Logger } from '@nestjs/common';

export enum CollaborationRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export interface CollaborationUser {
  id: string;
  name: string;
  role: CollaborationRole;
  joinedAt: string;
  lastActiveAt: string;
  avatar?: string;
}

export interface SolutionStep {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  type: 'reasoning' | 'calculation' | 'result' | 'comment';
  status: 'draft' | 'confirmed' | 'rejected';
  reactions: { userId: string; emoji: string }[];
}

export interface CollaborationSession {
  id: string;
  problem: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'paused' | 'completed';
  users: CollaborationUser[];
  steps: SolutionStep[];
  maxUsers: number;
  allowLateJoin: boolean;
  requireApproval: boolean;
}

@Injectable()
export class CollaborationSessionService {
  private readonly logger = new Logger(CollaborationSessionService.name);
  private readonly sessions = new Map<string, CollaborationSession>();
  private readonly MAX_INACTIVE_MS = 30 * 60 * 1000;

  constructor() {
    this.startCleanupTimer();
  }

  createSession(
    problem: string,
    category: string,
    ownerId: string,
    ownerName: string,
    options: {
      maxUsers?: number;
      allowLateJoin?: boolean;
      requireApproval?: boolean;
    } = {},
  ): CollaborationSession {
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();

    const session: CollaborationSession = {
      id: sessionId,
      problem,
      category,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      users: [
        {
          id: ownerId,
          name: ownerName,
          role: CollaborationRole.OWNER,
          joinedAt: now,
          lastActiveAt: now,
        },
      ],
      steps: [],
      maxUsers: options.maxUsers ?? 5,
      allowLateJoin: options.allowLateJoin ?? true,
      requireApproval: options.requireApproval ?? false,
    };

    this.sessions.set(sessionId, session);
    this.logger.log(
      `协作会话创建: ${sessionId} (${problem}), 创建者: ${ownerName}`,
    );
    return session;
  }

  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  joinSession(
    sessionId: string,
    userId: string,
    userName: string,
    requestedRole: CollaborationRole = CollaborationRole.EDITOR,
  ): { success: boolean; message: string; role?: CollaborationRole } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    if (session.status !== 'active') {
      if (!session.allowLateJoin) {
        return { success: false, message: '会话已结束，不允许加入' };
      }
    }

    if (session.users.length >= session.maxUsers) {
      return {
        success: false,
        message: `会话已满 (最大${session.maxUsers}人)`,
      };
    }

    const existingUser = session.users.find((u) => u.id === userId);
    if (existingUser) {
      existingUser.lastActiveAt = new Date().toISOString();
      return {
        success: true,
        message: '已重新加入会话',
        role: existingUser.role,
      };
    }

    const roleHierarchy: Record<CollaborationRole, number> = {
      [CollaborationRole.OWNER]: 3,
      [CollaborationRole.EDITOR]: 2,
      [CollaborationRole.VIEWER]: 1,
    };

    const assignedRole = session.requireApproval
      ? CollaborationRole.VIEWER
      : roleHierarchy[requestedRole] > roleHierarchy[CollaborationRole.EDITOR]
        ? CollaborationRole.EDITOR
        : requestedRole;

    const newUser: CollaborationUser = {
      id: userId,
      name: userName,
      role: assignedRole,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    session.users.push(newUser);
    session.updatedAt = new Date().toISOString();

    this.logger.log(
      `用户 ${userName} 加入会话 ${sessionId}，角色: ${assignedRole}`,
    );
    return { success: true, message: '加入成功', role: assignedRole };
  }

  leaveSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const idx = session.users.findIndex((u) => u.id === userId);
    if (idx < 0) return false;

    session.users.splice(idx, 1);
    session.updatedAt = new Date().toISOString();

    if (session.users.length === 0) {
      session.status = 'completed';
      this.logger.log(`会话 ${sessionId} 因无用户而自动结束`);
    }

    return true;
  }

  addStep(
    sessionId: string,
    userId: string,
    content: string,
    type: SolutionStep['type'],
  ): { success: boolean; message: string; step?: SolutionStep } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    if (session.status !== 'active') {
      return { success: false, message: '会话已结束' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, message: '用户不在会话中' };
    }

    if (user.role === CollaborationRole.VIEWER) {
      return { success: false, message: '观察者不能添加解题步骤' };
    }

    const step: SolutionStep = {
      id: this.generateStepId(sessionId),
      content,
      authorId: userId,
      authorName: user.name,
      createdAt: new Date().toISOString(),
      type,
      status: session.requireApproval ? 'draft' : 'confirmed',
      reactions: [],
    };

    session.steps.push(step);
    session.updatedAt = new Date().toISOString();
    user.lastActiveAt = new Date().toISOString();

    return { success: true, message: '步骤已添加', step };
  }

  updateStep(
    sessionId: string,
    stepId: string,
    userId: string,
    content: string,
  ): { success: boolean; message: string; step?: SolutionStep } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const step = session.steps.find((s) => s.id === stepId);
    if (!step) {
      return { success: false, message: '步骤不存在' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, message: '用户不在会话中' };
    }

    if (user.role === CollaborationRole.VIEWER) {
      return { success: false, message: '观察者不能修改步骤' };
    }

    if (step.authorId !== userId && user.role !== CollaborationRole.OWNER) {
      return { success: false, message: '只能修改自己的步骤' };
    }

    step.content = content;
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '步骤已更新', step };
  }

  confirmStep(
    sessionId: string,
    stepId: string,
    userId: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const step = session.steps.find((s) => s.id === stepId);
    if (!step) {
      return { success: false, message: '步骤不存在' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user || user.role === CollaborationRole.VIEWER) {
      return { success: false, message: '无权限确认步骤' };
    }

    step.status = 'confirmed';
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '步骤已确认' };
  }

  addReaction(
    sessionId: string,
    stepId: string,
    userId: string,
    emoji: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const step = session.steps.find((s) => s.id === stepId);
    if (!step) {
      return { success: false, message: '步骤不存在' };
    }

    const existingIdx = step.reactions.findIndex(
      (r) => r.userId === userId && r.emoji === emoji,
    );
    if (existingIdx >= 0) {
      step.reactions.splice(existingIdx, 1);
      return { success: true, message: '反应已移除' };
    }

    step.reactions.push({ userId, emoji });
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '反应已添加' };
  }

  updateUserRole(
    sessionId: string,
    targetUserId: string,
    newRole: CollaborationRole,
    requesterId: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const requester = session.users.find((u) => u.id === requesterId);
    if (!requester || requester.role !== CollaborationRole.OWNER) {
      return { success: false, message: '只有会话创建者能修改角色' };
    }

    const target = session.users.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, message: '目标用户不在会话中' };
    }

    if (target.role === CollaborationRole.OWNER) {
      return { success: false, message: '不能修改创建者的角色' };
    }

    target.role = newRole;
    session.updatedAt = new Date().toISOString();

    return { success: true, message: `角色已更新为 ${newRole}` };
  }

  pauseSession(
    sessionId: string,
    userId: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user || user.role !== CollaborationRole.OWNER) {
      return { success: false, message: '只有创建者可以暂停会话' };
    }

    session.status = 'paused';
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '会话已暂停' };
  }

  resumeSession(
    sessionId: string,
    userId: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user || user.role === CollaborationRole.VIEWER) {
      return { success: false, message: '无权限恢复会话' };
    }

    session.status = 'active';
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '会话已恢复' };
  }

  completeSession(
    sessionId: string,
    userId: string,
  ): { success: boolean; message: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: '会话不存在' };
    }

    const user = session.users.find((u) => u.id === userId);
    if (!user || user.role !== CollaborationRole.OWNER) {
      return { success: false, message: '只有创建者可以结束会话' };
    }

    session.status = 'completed';
    session.updatedAt = new Date().toISOString();

    return { success: true, message: '会话已完成' };
  }

  getSessionHistory(sessionId: string): SolutionStep[] | undefined {
    const session = this.sessions.get(sessionId);
    return session?.steps;
  }

  getAllActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active',
    );
  }

  private startCleanupTimer(): void {
    setInterval(
      () => {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
          if (session.status === 'completed') {
            const updatedAt = new Date(session.updatedAt).getTime();
            if (now - updatedAt > 3600000) {
              this.sessions.delete(id);
              this.logger.log(`清理已完成的会话: ${id}`);
            }
            continue;
          }

          const activeUsers = session.users.filter(
            (u) =>
              now - new Date(u.lastActiveAt).getTime() < this.MAX_INACTIVE_MS,
          );

          if (activeUsers.length === 0 && session.users.length > 0) {
            session.status = 'completed';
            session.updatedAt = new Date().toISOString();
            this.logger.log(`会话 ${id} 因无活跃用户自动结束`);
          } else if (activeUsers.length < session.users.length) {
            session.users = activeUsers;
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  private generateSessionId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateStepId(sessionId: string): string {
    return `${sessionId}_step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
}
