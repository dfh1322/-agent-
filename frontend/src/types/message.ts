/* types/message.ts */
export type ChatRole = 'user' | 'assistant' | 'tool' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp?: string;
  toolCalls?: Array<{
    tool: string;
    input?: unknown;
    observation?: unknown;
  }>;
}

/** 后台对话审核用消息类型 */
export interface ConversationMessage {
  id: number;
  role: string;
  content: string;
  tool_calls?: unknown;
  tool_responses?: unknown;
  metadata?: unknown;
  created_at?: string;
}
