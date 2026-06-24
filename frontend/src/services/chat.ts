/**
 * services/chat.ts — 智能对话、模型选择、推荐/对比/政策/贷款。
 */
import api from './http';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  session_id?: string;
  model?: string;
}

export interface CommunitySummary {
  id: number;
  name: string;
  district: string;
  price_range: string;
  area_range: string;
  decoration: string;
  green_rate?: string;
  metro?: string;
  school?: string;
}

export interface ChatResponse {
  content: string;
  communities?: CommunitySummary[];
  properties?: CommunitySummary[];
  session_id: string;
  conversation_id?: number;
  used_model?: string;
  detected_mode?: 'general' | 'property';
}

export interface ModelInfo {
  name: string;
  description: string;
  model_id: string;
}

export interface ModelsResponse {
  success: boolean;
  models: ModelInfo[];
  current_model: ModelInfo;
}

export interface SetModelRequest {
  model: string;
}

export interface SetModelResponse {
  success: boolean;
  message: string;
  model: string;
  description: string;
}

export interface StreamEvent {
  type: string;
  token?: string;
  content?: string;
  tool?: string;
  error?: string;
  end?: boolean;
}

export interface CommunitySearchParams {
  district?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
}

export interface CalculatorAdviceParams {
  price: number;
  down_payment_ratio: number;
  loan_term: number;
  interest_rate: number;
  is_second_home?: boolean;
  has_provident_fund?: boolean;
}

export const chatApi = {
  sendMessage: async (
    messages: ChatMessage[],
    sessionId?: string,
    model?: string,
  ): Promise<ChatResponse> => {
    const request: ChatRequest = { messages };
    if (sessionId) request.session_id = sessionId;
    if (model) request.model = model;
    const response = await api.post<ChatResponse>('/chat/chat', request);
    return response.data;
  },

  sendMessageStream: async (
    messages: ChatMessage[],
    onEvent: (event: StreamEvent) => void,
    sessionId?: string,
    model?: string,
  ): Promise<void> => {
    const request: ChatRequest = { messages };
    if (sessionId) request.session_id = sessionId;
    if (model) request.model = model;

    const response = await api.post('/chat/chat/agent/stream', request, {
      responseType: 'stream',
      headers: { Accept: 'text/event-stream' },
    });

    const reader = response.data.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as StreamEvent;
            onEvent(data);
          } catch {
            /* ignore malformed lines */
          }
        }
      }
    }
  },

  clearChat: async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; message: string }>(
      '/chat/clear',
      null,
      { params: { session_id: sessionId } },
    );
    return response.data;
  },

  getModels: async (): Promise<ModelsResponse> => {
    const response = await api.get<ModelsResponse>('/chat/models');
    return response.data;
  },

  setModel: async (model: string): Promise<SetModelResponse> => {
    const response = await api.post<SetModelResponse>('/chat/models/set', { model });
    return response.data;
  },

  getCommunities: async (params?: CommunitySearchParams): Promise<CommunitySummary[]> => {
    const response = await api.get<CommunitySummary[]>('/chat/properties', { params });
    return response.data;
  },

  getCommunityDetail: async (id: number): Promise<CommunitySummary & Record<string, unknown>> => {
    const response = await api.get(`/chat/properties/${id}`);
    return response.data;
  },

  recommendProperties: async (preference: string): Promise<unknown> => {
    const response = await api.post('/chat/properties/recommend', { preference });
    return response.data;
  },

  compareProperties: async (communityIds: number[]): Promise<unknown> => {
    const response = await api.post('/chat/properties/compare', { community_ids: communityIds });
    return response.data;
  },

  getConversations: async (page = 1, pageSize = 50): Promise<unknown> => {
    const response = await api.get('/chat/conversations', { params: { page, page_size: pageSize } });
    return response.data;
  },

  getConversationMessages: async (conversationId: number): Promise<unknown> => {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`);
    return response.data;
  },

  deleteConversation: async (conversationId: number): Promise<unknown> => {
    const response = await api.delete(`/chat/conversations/${conversationId}`);
    return response.data;
  },

  getPolicies: async (): Promise<unknown[]> => {
    const response = await api.get('/chat/policies');
    return response.data;
  },

  getFaqs: async (): Promise<unknown[]> => {
    const response = await api.get('/chat/faqs');
    return response.data;
  },

  explainPolicy: async (question: string): Promise<unknown> => {
    const response = await api.post('/chat/policy/explain', { question });
    return response.data;
  },

  getCalculatorAdvice: async (params: CalculatorAdviceParams): Promise<{
    success: boolean;
    calculation?: Record<string, unknown>;
    advice?: string;
    error?: string;
  }> => {
    const response = await api.post('/chat/calculator/advice', params);
    return response.data;
  },

  generatePlan: async (params: {
    district?: string;
    max_price?: number;
    min_price?: number;
    bedrooms?: number;
    down_payment_ratio?: number;
    loan_term?: number;
    has_provident_fund?: boolean;
    is_second_home?: boolean;
    need_metro?: boolean;
    need_school?: boolean;
    budget?: number;
  }): Promise<{
    success: boolean;
    report?: Record<string, unknown>;
    error?: string;
  }> => {
    const response = await api.post('/chat/plan/generate', params);
    return response.data;
  },
};
