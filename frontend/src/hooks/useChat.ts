import { useState, useCallback, useRef } from 'react';
import { chatApi } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  properties?: any[];
  detectedMode?: 'general' | 'property';
  toolCalls?: Array<{ tool: string; input: string; observation?: string }>;
}

export function useChat(initialSessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [detectedMode, setDetectedMode] = useState<'general' | 'property' | undefined>();

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: 'user', content: content.trim() });

      const response = await chatApi.sendMessage(apiMessages, sessionId);

      if (response.detected_mode) {
        setDetectedMode(response.detected_mode);
      }
      if (response.session_id && response.session_id !== sessionId) {
        setSessionId(response.session_id);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        properties: response.properties,
        detectedMode: response.detected_mode,
      };

      setMessages(prev => [...prev, assistantMsg]);
      return assistantMsg;
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      return errorMsg;
    } finally {
      setLoading(false);
    }
  }, [messages, sessionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId('');
    setDetectedMode(undefined);
  }, []);

  return {
    messages,
    loading,
    sessionId,
    detectedMode,
    sendMessage,
    clearMessages,
    setMessages,
  };
}
