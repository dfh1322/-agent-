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
