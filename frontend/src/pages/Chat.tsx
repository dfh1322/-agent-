/**
 * Chat.tsx — AI 智能房产顾问（v3 · 数据库驱动推荐版）
 *
 * 优化要点：
 *   - 从数据库获取用户偏好和真实楼盘，智能生成推荐快捷回复
 *   - 统一使用 chatApi 服务层，不再裸调 fetch
 *   - 两栏布局：左侧会话列表（常驻）+ 右侧对话区
 *   - 毛玻璃输入区 + CSS 变量全配色
 *   - 发送按钮圆形、渐变色、带阴影
 *   - 流式状态动画指示器
 *   - 触摸友好 44px+ tap area
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Layout, Button, Typography, App, Tooltip, Empty } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Navbar, ChatBubble } from '../components';
import { chatApi, settingsApi } from '../services/api';
import {
  HistoryOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  StarOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  HomeOutlined,
  BankOutlined,
  CompassOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';

const { Content, Sider } = Layout;
const { Text } = Typography;

/* ──────────── 类型 ──────────── */
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  properties?: any[];
  detectedMode?: 'general' | 'property';
  toolCalls?: Array<{ tool: string; input: string; observation?: string }>;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  backendId?: number;
}

interface DbSuggestion {
  label: string;
  icon: React.ReactNode;
  prompt: string;
  color: string;
}

/* ──────────── 欢迎语 ──────────── */
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: '您好！我是智能房产顾问 Agent\n\n我可以帮您：\n• 智能搜索匹配房源\n• 计算房贷月供和税费\n• 查询购房政策\n• 对比多个楼盘\n• 主动追问需求，帮您理清购房思路\n\n有什么想了解的？',
  timestamp: new Date(),
};

/* ──────────── 加载动画文案 ──────────── */
const LOADING_TEXTS = [
  '正在分析您的需求...',
  '匹配房源数据库中...',
  '整理推荐结果...',
  '马上就好...',
];

/* ──────────── 通用快捷回复（兜底） ──────────── */
const FALLBACK_QUICK_REPLIES: string[] = [
  '杭州西湖区3室，预算500万',
  '余杭区近地铁有什么盘',
  '杭州公积金贷款政策',
  '帮我算一下月供',
];

/**
 * 从 DB 真实数据生成智能推荐建议。
 * 来源优先级：用户偏好 > 热门楼盘 > 通用兜底
 */
async function fetchDbSuggestions(): Promise<DbSuggestion[]> {
  const suggestions: DbSuggestion[] = [];

  try {
    /* 1. 用户购房偏好 */
    const prefRes: any = await settingsApi.getPreference();
    if (prefRes?.success && prefRes.data) {
      const p = prefRes.data;
      const parts: string[] = [];
      if (p.budget_min && p.budget_max) {
        parts.push(`${p.budget_min}-${p.budget_max}万`);
      }
      if (p.preferred_districts?.length) {
        parts.push(p.preferred_districts.slice(0, 2).join('、'));
      }
      if (parts.length > 0) {
        suggestions.push({
          label: '按我的偏好找房',
          icon: <StarOutlined />,
          prompt: `帮我找${parts.join('')}的房源`,
          color: '#f59e0b',
        });
      }
      if (p.need_school) {
        suggestions.push({
          label: '学区房推荐',
          icon: <BankOutlined />,
          prompt: '推荐带学区的房源',
          color: '#8b5cf6',
        });
      }
      if (p.need_metro) {
        suggestions.push({
          label: '近地铁房源',
          icon: <EnvironmentOutlined />,
          prompt: '推荐靠近地铁的房源',
          color: '#0ea5e9',
        });
      }
    }

    /* 2. 热门楼盘（从在售列表中取前几个） */
    const propsRes: any = await chatApi.getProperties();
    if (Array.isArray(propsRes) && propsRes.length > 0) {
      /* 按区域去重取标签 */
      const seenDistricts = new Set<string>();
      const districtSuggestions: DbSuggestion[] = [];
      for (const prop of propsRes) {
        const dist = prop.district;
        if (dist && !seenDistricts.has(dist)) {
          seenDistricts.add(dist);
          districtSuggestions.push({
            label: `${dist}在售楼盘`,
            icon: <HomeOutlined />,
            prompt: `${dist}有什么在售楼盘`,
            color: '#6366f1',
          });
          if (districtSuggestions.length >= 3) break;
        }
      }
      suggestions.push(...districtSuggestions);

      /* 价格区间推荐 */
      const prices = propsRes
        .map((p: any) => p.total_price_min)
        .filter((v: any) => v != null) as number[];
      if (prices.length > 0) {
        const minPrice = Math.floor(Math.min(...prices) / 50) * 50;
        suggestions.push({
          label: '预算计算工具',
          icon: <DollarOutlined />,
          prompt: `帮我计算${minPrice > 0 ? minPrice : 200}万房子的月供`,
          color: '#10b981',
        });
      }
    }

    /* 3. 政策相关 */
    suggestions.push({
      label: '查看购房政策',
      icon: <CompassOutlined />,
      prompt: '杭州最新的购房政策有哪些',
      color: '#ef4444',
    });
  } catch {
    /* DB 不可用时降级，不阻塞 UI */
  }

  return suggestions;
}

/* ════════════════════════════════════════════════════════════════
   Chat 组件
   ════════════════════════════════════════════════════════════════ */
const Chat: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { message } = App.useApp();

  /* ── 状态 ── */
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [dbSuggestions, setDbSuggestions] = useState<DbSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  /* ── Refs ── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const newestAssistantIdRef = useRef<string | null>(null);
  const hasSentPrefilled = useRef(false);

  /* ── 滚动到底 ── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, scrollToBottom]);

  /* ── 预填楼盘分析 ── */
  const propertyContext = (location.state as { propertyName?: string; propertyId?: number } | null);
  useEffect(() => {
    if (propertyContext?.propertyName && !hasSentPrefilled.current) {
      hasSentPrefilled.current = true;
      setInput(`请帮我详细分析一下「${propertyContext.propertyName}」这个楼盘`);
      window.history.replaceState({}, document.title);
    }
  }, [propertyContext]);

  /* ── 会话管理 ── */
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const loadBackendConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations(1, 50) as any;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const backendSessions: ChatSession[] = res.data.map((c: any) => ({
          id: `backend_${c.id}`,
          title: c.title || '新对话',
          messages: [],
          createdAt: new Date(c.created_at).getTime(),
          updatedAt: new Date(c.updated_at).getTime(),
          backendId: c.id,
        }));
        setSessions(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const merged = [...prev];
          for (const bs of backendSessions) {
            if (!existingIds.has(bs.id)) merged.push(bs);
          }
          return merged.sort((a, b) => b.updatedAt - a.updatedAt);
        });
        // 自动恢复最近的对话
        const latest = backendSessions[0];
        if (latest && latest.backendId) {
          try {
            const msgRes = await chatApi.getConversationMessages(latest.backendId) as any;
            if (msgRes.success && Array.isArray(msgRes.data)) {
              const loaded: Message[] = [WELCOME_MESSAGE];
              for (const m of msgRes.data) {
                if (m.role === 'user' || m.role === 'assistant') {
                  loaded.push({
                    id: `msg_${m.id}`,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                  });
                }
              }
              setMessages(loaded);
              // 更新会话的 messages 缓存
              setSessions(prev => prev.map(s =>
                s.id === latest.id ? { ...s, messages: loaded } : s
              ));
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }, []);

  /** 加载数据库驱动的建议 */
  const loadDbSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    const items = await fetchDbSuggestions();
    setDbSuggestions(items);
    setSuggestionsLoading(false);
  }, []);

  useEffect(() => {
    loadBackendConversations();
    loadDbSuggestions();
  }, [loadBackendConversations, loadDbSuggestions]);

  const extractTitle = (msgs: Message[]): string => {
    const userMsg = msgs.find(m => m.role === 'user');
    if (!userMsg) return '新对话';
    const t = userMsg.content.trim();
    return t.length > 20 ? t.slice(0, 20) + '...' : t;
  };

  const createNewSession = useCallback(() => {
    const id = generateSessionId();
    const now = Date.now();
    const newSession: ChatSession = { id, title: '新对话', messages: [WELCOME_MESSAGE], createdAt: now, updatedAt: now };
    setSessions(prev => [newSession, ...prev]);
    setMessages([WELCOME_MESSAGE]);
    setStreamingContent('');
    setLoading(false);
    newestAssistantIdRef.current = null;
  }, []);

  const switchToSession = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if (session.backendId && session.messages.length === 0) {
      try {
        const res = await chatApi.getConversationMessages(session.backendId) as any;
        if (res.success && Array.isArray(res.data)) {
          const loaded: Message[] = [WELCOME_MESSAGE];
          for (const m of res.data) {
            if (m.role === 'user' || m.role === 'assistant') {
              loaded.push({
                id: `msg_${m.id}`,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                timestamp: new Date(m.created_at),
              });
            }
          }
          session.messages = loaded;
          setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: loaded } : s));
        }
      } catch {
        session.messages = [WELCOME_MESSAGE, { id: 'load-error', role: 'system', content: '加载历史消息失败', timestamp: new Date() }];
      }
    }

    if (session) {
      setMessages(session.messages);
      setStreamingContent('');
      setLoading(false);
      newestAssistantIdRef.current = null;
    }
  }, [sessions]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      if (next.length === 0) {
        const id = generateSessionId();
        const now = Date.now();
        next.push({ id, title: '新对话', messages: [WELCOME_MESSAGE], createdAt: now, updatedAt: now });
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRename = useCallback((session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  }, []);

  const confirmRename = useCallback(() => {
    if (editingSessionId && editTitle.trim()) {
      setSessions(prev =>
        prev.map(s => s.id === editingSessionId ? { ...s, title: editTitle.trim(), updatedAt: Date.now() } : s)
      );
    }
    setEditingSessionId(null);
    setEditTitle('');
  }, [editingSessionId, editTitle]);

  /* ── 发送消息 ── */
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setLoadingStatus(LOADING_TEXTS[0]);
    setStreamingContent('');

    let statusIdx = 0;
    statusTimerRef.current = setInterval(() => {
      statusIdx = (statusIdx + 1) % LOADING_TEXTS.length;
      setLoadingStatus(LOADING_TEXTS[statusIdx]);
    }, 2000);

    /* 同步到会话列表 */
    setSessions(prev => {
      if (prev.length === 0) {
        const now = Date.now();
        return [{
          id: generateSessionId(),
          title: extractTitle([userMessage]),
          messages: [WELCOME_MESSAGE, userMessage],
          createdAt: now,
          updatedAt: now,
        }];
      }
      return prev.map((s, i) =>
        i === 0
          ? { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now() }
          : s
      );
    });

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      apiMessages.push({ role: 'user', content: userMessage.content });

      const response: any = await chatApi.sendMessage(
        apiMessages,
        sessions[0]?.id,
        undefined, // model
      );

      const assistantContent =
        typeof response?.content === 'string'
          ? response.content
          : (response?.success === false
            ? response?.error || '请求有误'
            : JSON.stringify(response ?? ''));
      const assistantProps = response?.properties || undefined;
      const detectedMode = response?.detected_mode || undefined;

      const newAssistantId = (Date.now() + 1).toString();
      newestAssistantIdRef.current = newAssistantId;
      const assistantMsg: Message = {
        id: newAssistantId,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        properties: assistantProps,
        detectedMode,
      };

      setMessages(prev => [...prev, assistantMsg]);

      setSessions(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          messages: [...updated[0].messages, assistantMsg],
          updatedAt: Date.now(),
          ...(response?.conversation_id
            ? { backendId: response.conversation_id }
            : {}),
        };
        return updated;
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const detail =
        typeof error?.response?.data?.detail === 'string'
          ? error.response.data.detail
          : error?.message || '未知错误';
      let content: string;
      if (status === 401) {
        try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch { /* ignore */ }
        content = '您的登录已过期，已自动退出登录。请重新登录后继续咨询。';
      } else if (status === 400) {
        content = `请求有误：${detail}`;
      } else if (status === 404 || status === 503) {
        content = '智能体暂时不可达，请稍后再试。';
      } else {
        content = `AI 助手暂时无法回复（${status || '网络错误'}：${detail}）`;
      }
      setMessages(prev => [
        ...prev,
        { id: `error-${Date.now()}`, role: 'system', content, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      setStreamingContent('');
      if (statusTimerRef.current) {
        clearInterval(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    }
  };

  /* ── 快捷回复点击：填入输入框并自动发送 ── */
  const handleQuickReply = (prompt: string) => {
    setInput(prompt);
    /* 使用 requestAnimationFrame 确保 input state 更新后再发 */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        /* 直接构造消息并发送 */
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: prompt,
          timestamp: new Date(),
        };
        setInput('');
        /* 内联发送逻辑 — 复用 handleSend 太复杂，直接内联 */
        (async () => {
          setMessages(prev => [...prev, userMessage]);
          setLoading(true);
          setLoadingStatus(LOADING_TEXTS[0]);
          let statusIdx = 0;
          const timer = setInterval(() => {
            statusIdx = (statusIdx + 1) % LOADING_TEXTS.length;
            setLoadingStatus(LOADING_TEXTS[statusIdx]);
          }, 2000);

          try {
            const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
            apiMessages.push({ role: 'user', content: prompt });
            const response: any = await chatApi.sendMessage(apiMessages, sessions[0]?.id);

            const assistantContent = typeof response?.content === 'string'
              ? response.content
              : (response?.success === false ? response?.error || '请求有误' : JSON.stringify(response ?? ''));
            const newAssistantId = (Date.now() + 1).toString();
            newestAssistantIdRef.current = newAssistantId;
            const assistantMsg: Message = {
              id: newAssistantId, role: 'assistant', content: assistantContent,
              timestamp: new Date(), properties: response?.properties, detectedMode: response?.detected_mode,
            };
            setMessages(prev => [...prev, assistantMsg]);
            setSessions(prev => {
              if (prev.length === 0) return prev;
              const updated = [...prev];
              updated[0] = {
                ...updated[0],
                messages: [...updated[0].messages, assistantMsg],
                updatedAt: Date.now(),
                ...(updated[0].id.startsWith('session_') && response?.conversation_id
                  ? { id: `backend_${response.conversation_id}`, backendId: response.conversation_id }
                  : {}),
              };
              return updated;
            });
          } catch (error: any) {
            const detail = typeof error?.response?.data?.detail === 'string'
              ? error.response.data.detail : error?.message || '未知错误';
            setMessages(prev => [...prev, { id: `error-${Date.now()}`, role: 'system', content: `AI 助手暂时无法回复：${detail}`, timestamp: new Date() }]);
          } finally {
            setLoading(false);
            clearInterval(timer);
          }
        })();
      });
    });
  };

  /* ── 上下文相关的文本快捷回复（对话中） ── */
  const contextualQuickReplies = useMemo((): string[] => {
    if (messages.length <= 2) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== 'assistant') return [];
    if (lastMsg.content.includes('楼盘') || lastMsg.content.includes('房源')) {
      return ['帮我推荐学区房', '有地铁附近的吗', '这个价格还能谈吗'];
    }
    if (lastMsg.content.includes('贷款') || lastMsg.content.includes('利率') || lastMsg.content.includes('月供')) {
      return ['公积金能贷多少', '商贷利率是多少', '贷款30年月供多少'];
    }
    if (lastMsg.content.includes('政策') || lastMsg.content.includes('限购') || lastMsg.content.includes('税')) {
      return ['杭州购房条件', '二套房首付比例', '契税怎么算'];
    }
    return [];
  }, [messages]);

  /* ── 会话侧边栏宽度 ── */
  const sidebarWidth = sidebarOpen ? 300 : 0;

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      {/* ── 顶部导航 ── */}
      <Navbar
        title="智能房产顾问"
        showBack
        extra={
          <Tooltip title={sidebarOpen ? '收起侧边栏' : '展开会话'}>
            <Button
              type="text"
              icon={sidebarOpen
                ? <MenuFoldOutlined style={{ color: 'var(--color-ink)', fontSize: 18 }} />
                : <MenuUnfoldOutlined style={{ color: 'var(--color-ink)', fontSize: 18 }} />
              }
              onClick={() => setSidebarOpen(o => !o)}
            />
          </Tooltip>
        }
      />

      <Layout style={{ background: 'transparent' }}>
        {/* ── 左侧会话列表（常驻） ── */}
        <Sider
          width={300}
          collapsedWidth={0}
          collapsed={!sidebarOpen}
          style={{
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            transition: `all var(--motion-normal) var(--motion-easing)`,
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
          }}>
            <Text strong style={{ fontSize: 14, color: 'var(--color-ink)' }}>
              <HistoryOutlined style={{ marginRight: 8 }} />会话历史
            </Text>
            <Tooltip title="新建对话">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={createNewSession}
                style={{ borderRadius: 'var(--radius-md)' }}
              >
                新建
              </Button>
            </Tooltip>
          </div>

          <div style={{
            height: 'calc(100dvh - 125px)',
            overflowY: 'auto',
            padding: '8px',
          }}>
            {sessions.length === 0 ? (
              <Empty description="暂无会话历史" style={{ marginTop: 60 }} />
            ) : (
              sessions.map(session => {
                const isActive = messages.length > 0
                  && session.messages.length > 0
                  && session.messages[session.messages.length - 1]?.id === messages[messages.length - 1]?.id;
                return (
                  <div
                    key={session.id}
                    onClick={() => switchToSession(session.id)}
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 4,
                      border: 'none',
                      background: isActive ? 'var(--color-primary-light)' : 'transparent',
                      transition: `background var(--motion-fast)`,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {editingSessionId === session.id ? (
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={confirmRename}
                        onKeyDown={e => e.key === 'Enter' && confirmRename()}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', padding: '4px 8px',
                          border: '1px solid var(--color-border)', borderRadius: 6,
                          fontSize: 13, background: 'var(--color-surface)',
                          color: 'var(--color-ink)',
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: 13, fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--color-primary)' : 'var(--color-ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1,
                        }}>
                          {session.title}
                        </span>
                        <div
                          style={{ display: 'flex', gap: 2, marginLeft: 6, flexShrink: 0, opacity: 0.6 }}
                          onClick={e => e.stopPropagation()}
                        >
                          <Button
                            type="text" size="small"
                            icon={<EditOutlined style={{ fontSize: 12 }} />}
                            onClick={(e) => { e.stopPropagation(); startRename(session); }}
                          />
                          <Button
                            type="text" size="small" danger
                            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.id);
                              message.success('会话已删除');
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <span style={{
                      fontSize: 11, color: 'var(--color-ink-muted)',
                      display: 'block', marginTop: 4,
                    }}>
                      {new Date(session.updatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Sider>

        {/* ── 右侧对话区 ── */}
        <Content style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 64px)',
          padding: 0,
          background: 'var(--color-bg)',
        }}>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-lg)',
            background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface-muted) 100%)',
          }}>
            {messages.map(msg => (
              <ChatBubble
                key={msg.id}
                role={msg.role === 'system' ? 'assistant' : msg.role as 'user' | 'assistant'}
                content={msg.content}
                timestamp={msg.timestamp}
                properties={msg.properties}
                toolCalls={msg.toolCalls}
                typeSpeed={msg.role === 'assistant' && msg.id === newestAssistantIdRef.current ? 35 : 0}
              />
            ))}
            {streamingContent && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
                <ChatBubble role="assistant" content={streamingContent} timestamp={new Date()} />
              </div>
            )}
            {loading && !streamingContent && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                justifyContent: 'flex-start', marginBottom: 24,
                padding: '10px 18px',
              }}>
                <ChatBubble role="assistant" content="" isTyping />
                <span className="status-text">{loadingStatus}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── 推荐建议区 ── */}
          {!loading && !streamingContent && (
            <div style={{
              padding: '10px 20px',
              display: 'flex', flexWrap: 'wrap',
              gap: 8, justifyContent: 'center',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-muted)',
            }}>
              {/* 数据库驱动的建议（首次加载时展示） */}
              {messages.length <= 2 && dbSuggestions.length > 0 && dbSuggestions.map((s, i) => (
                <button
                  key={`db-${i}`}
                  onClick={() => handleQuickReply(s.prompt)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: `1px solid ${s.color}30`,
                    borderRadius: 'var(--radius-pill)',
                    background: `${s.color}0D`,
                    color: 'var(--color-ink)',
                    padding: '8px 16px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    minHeight: 40,
                    fontWeight: 500,
                    transition: 'all var(--motion-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = s.color;
                    e.currentTarget.style.background = `${s.color}18`;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${s.color}30`;
                    e.currentTarget.style.background = `${s.color}0D`;
                    e.currentTarget.style.transform = '';
                  }}
                >
                  <span style={{ color: s.color, fontSize: 15 }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}

              {/* 降级：通用快捷回复 */}
              {messages.length <= 2 && dbSuggestions.length === 0 && !suggestionsLoading && FALLBACK_QUICK_REPLIES.map((reply, i) => (
                <button
                  key={`fb-${i}`}
                  onClick={() => setInput(reply)}
                  style={{
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-ink-secondary)',
                    padding: '8px 18px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    minHeight: 40,
                    transition: 'all var(--motion-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.color = 'var(--color-ink-secondary)';
                  }}
                >
                  {reply}
                </button>
              ))}

              {/* 上下文快捷回复 */}
              {contextualQuickReplies.map((reply, i) => (
                <button
                  key={`ctx-${i}`}
                  onClick={() => setInput(reply)}
                  style={{
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-ink-secondary)',
                    padding: '8px 18px',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    minHeight: 40,
                    transition: 'all var(--motion-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.color = 'var(--color-ink-secondary)';
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* ── 输入区 ── */}
          <div style={{
            padding: '16px 20px',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            borderTop: '1px solid var(--glass-border)',
          }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 900, margin: '0 auto', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (!e.shiftKey && e.key === 'Enter') { e.preventDefault(); handleSend(); }
                }}
                placeholder="输入您的问题，按回车发送，Shift+回车换行..."
                style={{
                  flex: 1,
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  padding: '12px 18px',
                  border: '1px solid var(--color-border-strong)',
                  outline: 'none',
                  resize: 'none',
                  minHeight: 48,
                  maxHeight: 120,
                  fontFamily: 'inherit',
                  background: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                  lineHeight: 1.5,
                  transition: 'border-color var(--motion-fast), box-shadow var(--motion-fast)',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-light)';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                aria-label="消息输入"
              />
              <Button
                type="primary"
                onClick={handleSend}
                loading={loading}
                disabled={!input.trim()}
                icon={<SendOutlined style={{ fontSize: 20 }} />}
                style={{
                  borderRadius: '50%',
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--gradient-primary)',
                  border: 'none',
                  boxShadow: 'var(--shadow-md)',
                  flexShrink: 0,
                }}
                aria-label="发送消息"
              />
            </div>
            <Text style={{
              display: 'block', textAlign: 'center',
              fontSize: 11, color: 'var(--color-ink-muted)',
              marginTop: 8,
            }}>
              <ThunderboltOutlined style={{ marginRight: 4 }} />
              AI 智能房产顾问 · 基于真实楼盘数据 · 回答仅供参考
            </Text>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Chat;
