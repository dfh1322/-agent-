/**
 * 会话历史管理 Hook
 * 管理多个聊天会话的切换、创建、删除、重命名
 */
import { useState, useCallback } from 'react';

export interface ChatSession {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: number;
  updatedAt: number;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractTitle(messages: string): string {
  // 从用户的第一条消息中提取标题（前20个字符）
  const trimmed = messages.trim();
  if (trimmed.length <= 20) return trimmed || '新对话';
  return trimmed.slice(0, 20) + '...';
}

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // 创建新会话
  const createSession = useCallback((initialMessage?: string): string => {
    const id = generateSessionId();
    const now = Date.now();
    const newSession: ChatSession = {
      id,
      title: initialMessage ? extractTitle(initialMessage) : '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(id);
    return id;
  }, []);

  // 删除会话
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [activeSessionId]);

  // 重命名会话
  const renameSession = useCallback((sessionId: string, title: string) => {
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
      )
    );
  }, []);

  // 获取当前活跃会话
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // 添加消息到当前会话
  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const now = Date.now();
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSessionId) return s;
        return {
          ...s,
          messages: [...s.messages, { role, content }],
          updatedAt: now,
          title: s.messages.length === 0 && role === 'user' ? extractTitle(content) : s.title,
        };
      })
    );
  }, [activeSessionId]);

  // 切换会话
  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  // 清空当前会话消息
  const clearMessages = useCallback(() => {
    setSessions(prev =>
      prev.map(s =>
        s.id === activeSessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
      )
    );
  }, [activeSessionId]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    deleteSession,
    renameSession,
    switchSession,
    addMessage,
    clearMessages,
  };
}
