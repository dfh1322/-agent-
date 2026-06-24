/**
 * AdminConversations - 对话审核
 *
 * 左侧会话列表（支持关键词/用户/状态筛选），右侧聊天详情。
 * 管理员可查看任意用户的完整对话内容、工具调用链，并可关闭或删除对话。
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Card, Tag, Typography, Empty, Button, Input, Select, Row, Col,
  Space, Avatar, Divider, Collapse, Tooltip, Popconfirm, message, Spin,
} from 'antd';
import {
  MessageOutlined, UserOutlined, SearchOutlined, ReloadOutlined,
  RobotOutlined, ToolOutlined, ClockCircleOutlined, ExportOutlined,
  FilterOutlined, DeleteOutlined, StopOutlined, CopyOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import StatsKpiCard from '../../components/StatKpiCard';
import type { ConversationMessage } from '../../types/message';
import { palette, radius, space, text } from '../../theme';

const { Title, Text } = Typography;
const { Panel } = Collapse;

interface ConversationRecord {
  id: number;
  user_id: number;
  user_name: string;
  title: string;
  status: string;
  created_at: string;
  summary?: string;
  last_message?: string;
  message_count?: number;
}

const AdminConversations: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' && user?.is_admin;

  const [data, setData] = useState<{
    summary?: { total_users: number; total_properties: number; total_policies: number };
    conversations: ConversationRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [userIdFilter, setUserIdFilter] = useState<number | undefined>();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 消息详情
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (userIdFilter) params.user_id = userIdFilter;
      if (statusFilter) params.include_closed = true;
      const res = await adminApi.listConversations(params);
      if ((res as any)?.success) {
        setData({
          summary: (res as any).data?.summary,
          conversations: (res as any).data?.conversations || [],
        });
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [userIdFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.listConversations();
        if (!cancelled && (res as any)?.success) {
          setData({
            summary: (res as any).data?.summary,
            conversations: (res as any).data?.conversations || [],
          });
        }
      } catch { /* noop */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // 选中会话后加载消息
  useEffect(() => {
    if (!selectedId || !isAdmin) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMessagesLoading(true);
      try {
        const res = await adminApi.getConversationMessages(selectedId);
        if (!cancelled && (res as any)?.success) {
          setMessages((res as any).data || []);
        }
      } catch { setMessages([]); }
      finally { if (!cancelled) setMessagesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedId, isAdmin]);

  const filtered = useMemo(() => {
    const list = data?.conversations || [];
    return list.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (keyword && !(`${c.title || ''} ${c.user_name || ''}`).toLowerCase().includes(keyword.toLowerCase())) return false;
      return true;
    });
  }, [data, keyword, statusFilter]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const handleClose = async (id: number) => {
    try {
      await adminApi.closeConversation(id);
      message.success('对话已关闭');
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await adminApi.deleteConversation(id);
      message.success('对话已删除');
      if (selectedId === id) {
        setSelectedId(null);
        setMessages([]);
      }
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const exportMessages = () => {
    if (!selected || !messages.length) return;
    const transcript = messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      created_at: m.created_at,
    }));
    const blob = new Blob([JSON.stringify(transcript, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${selected.id}-transcript.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制'),
      () => message.error('复制失败'),
    );
  };

  return (
    <div>
      <div style={{ marginBottom: space.lg }}>
        <Title level={3} style={{ margin: 0, fontSize: text.heading.fontSize }}>
          <MessageOutlined style={{ color: palette.primary, marginRight: space.sm }} />
          对话审核
        </Title>
        <Text style={{ color: palette.inkSecondary, marginTop: 4, display: 'block' }}>
          {isAdmin ? '查看全部用户对话与工具调用链，辅助合规审计' : '查看与您名下楼盘相关的对话摘要'}
        </Text>
      </div>

      {/* KPI */}
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        <Col xs={24} sm={6}>
          <StatsKpiCard
            title="活跃用户"
            value={data?.summary?.total_users ?? '-'}
            icon={<UserOutlined />}
            tone="primary"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatsKpiCard
            title="对话会话"
            value={data?.conversations?.length ?? 0}
            icon={<MessageOutlined />}
            tone="accent"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatsKpiCard
            title="在售楼盘"
            value={data?.summary?.total_properties ?? '-'}
            icon={<FilterOutlined />}
            tone="success"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatsKpiCard
            title="政策文档"
            value={data?.summary?.total_policies ?? '-'}
            icon={<ClockCircleOutlined />}
            tone="warning"
          />
        </Col>
      </Row>

      {/* 主区 */}
      <Row gutter={[space.md, space.md]}>
        {/* 左侧会话列表 */}
        <Col xs={24} lg={9} xl={8}>
          <Card
            variant="borderless"
            style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm }}
            styles={{ body: { padding: 0, height: 'calc(100vh - 360px)', minHeight: 480, overflow: 'auto' } }}
            title={
              <Space>
                <Text strong>会话列表</Text>
                <Text style={{ fontSize: 12, color: palette.inkMuted }}>({filtered.length})</Text>
              </Space>
            }
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={fetchList}
                aria-label="refresh"
              />
            }
          >
            {/* 筛选 */}
            <div
              style={{
                padding: `${space.sm}px ${space.md}px`,
                borderBottom: `1px solid ${palette.divider}`,
                display: 'flex',
                flexDirection: 'column',
                gap: space.sm,
                position: 'sticky', top: 0, background: palette.surface, zIndex: 1,
              }}
            >
              <Input
                placeholder="搜索会话标题/用户名"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
              />
              <Row gutter={[space.sm, 0]}>
                <Col span={12}>
                  <Select
                    placeholder="状态"
                    allowClear
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: 'active', label: '进行中' },
                      { value: 'closed', label: '已结束' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <Input
                    placeholder="用户 ID"
                    value={userIdFilter !== undefined ? String(userIdFilter) : ''}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setUserIdFilter(v ? Number(v) : undefined);
                    }}
                    type="number"
                    allowClear
                  />
                </Col>
              </Row>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: space.xl }}><Spin /></div>
            ) : filtered.length > 0 ? (
              <div role="list">
                {filtered.map((c) => {
                  const active = (selected?.id ?? filtered[0]?.id) === c.id;
                  return (
                    <div
                      role="listitem"
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        padding: `${space.sm}px ${space.md}px`,
                        borderBottom: `1px solid ${palette.divider}`,
                        background: active ? palette.primaryLight : 'transparent',
                        borderLeft: active ? `3px solid ${palette.primary}` : '3px solid transparent',
                        cursor: 'pointer',
                        transition: `background 180ms cubic-bezier(0.2,0,0.2,1)`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar
                          style={{
                            background: c.status === 'active' ? palette.success : palette.inkMuted,
                            color: palette.inkInverse,
                          }}
                          size={32}
                          icon={<UserOutlined />}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                            {c.title || c.user_name || `会话 #${c.id}`}
                          </Text>
                          <Text style={{ fontSize: 11, color: palette.inkMuted }} ellipsis>
                            {c.user_name || `用户 ${c.user_id}`} ·{' '}
                            {new Date(c.created_at).toLocaleString('zh-CN')} · {c.message_count ?? 0} 条消息
                          </Text>
                        </div>
                        <Tag
                          style={{
                            background: c.status === 'active' ? palette.successLight : palette.surfaceMuted,
                            color: c.status === 'active' ? palette.successInk : palette.inkMuted,
                            border: 'none',
                            margin: 0,
                          }}
                        >
                          {c.status === 'active' ? '进行中' : '已结束'}
                        </Tag>
                      </div>
                      {c.last_message && (
                        <Text
                          style={{ fontSize: 12, color: palette.inkSecondary, marginTop: 4, display: 'block' }}
                          ellipsis={{ tooltip: c.last_message }}
                        >
                          {c.last_message}
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="暂无符合条件的会话" style={{ padding: space.xl }} />
            )}
          </Card>
        </Col>

        {/* 右侧详情 */}
        <Col xs={24} lg={15} xl={16}>
          <Card
            variant="borderless"
            style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm, height: 'calc(100vh - 360px)', minHeight: 480 }}
            styles={{ body: { padding: 0, height: '100%', overflow: 'auto' } }}
            title={
              <Space>
                <Text strong>
                  {selected ? selected.title || `会话 #${selected.id}` : '请选择会话'}
                </Text>
                {selected?.user_name && (
                  <Text style={{ fontSize: 12, color: palette.inkMuted }}>
                    · {selected.user_name} (UID: {selected.user_id})
                  </Text>
                )}
              </Space>
            }
            extra={
              selected && isAdmin && (
                <Space>
                  <Button icon={<ExportOutlined />} onClick={exportMessages} disabled={!messages.length}>
                    导出
                  </Button>
                  {selected.status === 'active' && (
                    <Popconfirm title="确定关闭此对话？用户将不能再继续。" onConfirm={() => handleClose(selected.id)}>
                      <Button icon={<StopOutlined />}>关闭</Button>
                    </Popconfirm>
                  )}
                  <Popconfirm title="确定删除此对话及所有消息？此操作不可恢复。" onConfirm={() => handleDelete(selected.id)}>
                    <Button danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              )
            }
          >
            {selected ? (
              <div style={{ padding: space.md, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* 会话元信息 */}
                <Space size={space.md} wrap style={{ marginBottom: space.sm, flexShrink: 0 }}>
                  <MetaItem label="会话 ID" value={`#${selected.id}`} />
                  <MetaItem label="用户" value={selected.user_name || `UID ${selected.user_id}`} />
                  <MetaItem label="消息数" value={String(selected.message_count ?? 0)} />
                  <MetaItem label="创建时间" value={new Date(selected.created_at).toLocaleString('zh-CN')} />
                </Space>
                <Divider style={{ margin: `${space.sm}px 0`, flexShrink: 0 }} />

                {/* 消息列表 */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {messagesLoading ? (
                    <div style={{ textAlign: 'center', padding: space.xl }}><Spin /></div>
                  ) : messages.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                      {messages.map((msg) => (
                        <ChatBubble key={msg.id} msg={msg} onCopy={copyContent} />
                      ))}
                    </div>
                  ) : (
                    !isAdmin ? (
                      <div style={{ textAlign: 'center', padding: space.xl, color: palette.inkMuted }}>
                        暂无消息数据
                      </div>
                    ) : (
                      <Empty description="暂无消息" style={{ padding: space.xl }} />
                    )
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty description="选择左侧会话查看详情" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const MetaItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span>
    <Text style={{ fontSize: 11, color: palette.inkMuted }}>{label}: </Text>
    <Text style={{ ...text.number }}>{value}</Text>
  </span>
);

/** 对话气泡 */
const ChatBubble: React.FC<{ msg: ConversationMessage; onCopy: (text: string) => void }> = ({ msg, onCopy }) => {
  const isUser = msg.role === 'user';
  const isTool = msg.role === 'tool';

  const bubbleBg = isUser ? palette.primaryLight
    : isTool ? palette.surfaceMuted
    : palette.surface;
  const avatarIcon = isUser ? <UserOutlined />
    : isTool ? <ToolOutlined />
    : <RobotOutlined />;
  const avatarBg = isUser ? palette.primary
    : isTool ? palette.inkMuted
    : palette.accent;

  const timestamp = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  const rawToolCalls = msg.tool_calls as any[] | undefined;
  const rawToolResponses = msg.tool_responses as any[] | undefined;
  const hasToolCalls = rawToolCalls && rawToolCalls.length > 0;
  const hasToolResponses = rawToolResponses && rawToolResponses.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '100%',
      }}
    >
      {/* 角色指示 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <Avatar size={20} icon={avatarIcon} style={{ background: avatarBg, color: palette.inkInverse }} />
        <Text style={{ fontSize: 11, color: palette.inkMuted }}>
          {isUser ? '用户' : isTool ? '工具' : '助手'}
          {timestamp ? ` · ${timestamp}` : ''}
        </Text>
      </div>

      {/* 内容气泡 */}
      <div
        style={{
          background: bubbleBg,
          borderRadius: radius.md,
          padding: `${space.sm}px ${space.md}px`,
          maxWidth: '85%',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          lineHeight: 1.6,
          border: isTool ? `1px solid ${palette.divider}` : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 13, color: palette.ink }}>
            {msg.content || '(无内容)'}
          </Text>
          {msg.content && (
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={() => onCopy(msg.content)}
                style={{ flexShrink: 0, marginTop: -2 }}
              />
            </Tooltip>
          )}
        </div>

        {/* tool_calls 折叠面板 */}
        {hasToolCalls && (
          <Collapse
            ghost
            size="small"
            style={{ marginTop: space.sm }}
            expandIconPosition="end"
          >
            <Panel
              header={
                <Text style={{ fontSize: 11, color: palette.accent }}>
                  <ToolOutlined style={{ marginRight: 4 }} />
                  {(msg.tool_calls as any[]).length} 次工具调用
                </Text>
              }
              key="tool_calls"
            >
              {(msg.tool_calls as any[]).map((tc: any, idx: number) => (
                <div key={idx} style={{ marginBottom: space.sm }}>
                  <Text style={{ fontSize: 11, color: palette.inkMuted, display: 'block' }}>
                    {typeof tc === 'object' ? (tc.name || tc.tool || `调用 #${idx + 1}`) : `调用 #${idx + 1}`}
                  </Text>
                  <pre style={{
                    fontSize: 11,
                    background: palette.surfaceMuted,
                    padding: `${space.xs}px ${space.sm}px`,
                    borderRadius: radius.sm,
                    overflow: 'auto',
                    maxHeight: 200,
                    margin: '4px 0 0 0',
                  }}>
                    {JSON.stringify(tc, null, 2)}
                  </pre>
                </div>
              ))}
            </Panel>
          </Collapse>
        )}

        {/* tool_responses */}
        {hasToolResponses && (
          <Collapse
            ghost
            size="small"
            style={{ marginTop: 2 }}
            expandIconPosition="end"
          >
            <Panel
              header={
                <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                  工具响应 ({(msg.tool_responses as any[]).length})
                </Text>
              }
              key="tool_responses"
            >
              {(msg.tool_responses as any[]).map((tr: any, idx: number) => (
                <pre key={idx} style={{
                  fontSize: 11,
                  background: palette.surfaceMuted,
                  padding: `${space.xs}px ${space.sm}px`,
                  borderRadius: radius.sm,
                  overflow: 'auto',
                  maxHeight: 200,
                  margin: '4px 0 0 0',
                }}>
                  {typeof tr === 'string' ? tr : JSON.stringify(tr, null, 2)}
                </pre>
              ))}
            </Panel>
          </Collapse>
        )}
      </div>
    </div>
  );
};

export default AdminConversations;
