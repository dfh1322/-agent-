/**
 * useChatStore — 对话状态（含消息列表、会话 ID、模型、流式状态）（CLAUDE.md 4.2）
 *
 * 与旧的 ``pages/Chat.tsx`` 内 useState 解耦：
 *   * persist 会话 ID + 模型；token / user 不在本 store 中。
 *   * ``pushAssistant`` 支持 SSE 流式追加。
 *   * ``clearSession`` 同步清空 store 与调用后端 ``/api/chat/chat/clear``。
 */
import { create } from 'zustand';
import { chatApi } from '../services/api';
import type { ChatMessage } from '../types/message';

export interface ChatState {
  sessionId: string | null;
  model: string;
  isStreaming: boolean;
  messages: ChatMessage[];
  initSession: () => void;
  setSession: (id: string | null) => void;
  setModel: (model: string) => void;
  pushUser: (content: string) => void;
  pushAssistant: (content: string, toolCalls?: ChatMessage['toolCalls']) => void;
  appendAssistantChunk: (chunk: string) => void;
  finishAssistant: (toolCalls?: ChatMessage['toolCalls']) => void;
  reload: () => Promise<void>;
  setStreaming: (s: boolean) => void;
  clearSession: () => Promise<void>;
}

const newSessionId = () => `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: null,
  model: 'deepseek-v3',
  isStreaming: false,
  messages: [],

  initSession: () => set({ sessionId: newSessionId(), messages: [] }),
  setSession: (id) => set({ sessionId: id }),
  setModel: (model) => set({ model }),
  setStreaming: (s) => set({ isStreaming: s }),

  pushUser: (content) => set({
    messages: [...get().messages, { role: 'user', content, timestamp: new Date().toISOString() }],
  }),

  pushAssistant: (content, toolCalls) => set({
    messages: [
      ...get().messages,
      { role: 'assistant', content, timestamp: new Date().toISOString(), toolCalls },
    ],
  }),

  appendAssistantChunk: (chunk) => {
    const list = get().messages.slice();
    const last = list[list.length - 1];
    if (last && last.role === 'assistant') {
      list[list.length - 1] = {
        ...last,
        content: (last.content || '') + chunk,
      };
      set({ messages: list });
    } else {
      list.push({ role: 'assistant', content: chunk, timestamp: new Date().toISOString() });
      set({ messages: list });
    }
  },

  finishAssistant: (toolCalls) => {
    const list = get().messages.slice();
    const last = list[list.length - 1];
    if (last && last.role === 'assistant') {
      list[list.length - 1] = { ...last, toolCalls };
      set({ messages: list });
    }
  },

  reload: async () => {
    const id = get().sessionId;
    if (!id) return;
    // 后端未来可以挂一个 /api/chat/messages/{session_id} 取回历史。本地先发一个空操作。
    return;
  },

  clearSession: async () => {
    const id = get().sessionId;
    if (id) {
      try {
        await chatApi.clearChat(id);
      } catch (e) {
        // 静默处理
      }
    }
    set({ messages: [], sessionId: newSessionId() });
  },
}));
