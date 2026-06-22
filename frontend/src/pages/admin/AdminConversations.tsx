/**
 * AdminConversations - 对话审核 v2
 *
 * 设计要点：
 *   * 左侧会话列表，右侧聊天详情（Drawer 当屏宽够时使用双栏；屏宽不够或未选会话则单栏）；；
 *   * 详情面板展示 user/assistant/tool 消息；tool_call 用折叠面板展开；
 *   * 行级权限：admin 看全部，landlord 仅看与自己楼盘相关；
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Tag, Typography, Empty, Button, Input, Select, Row, Col,
  Space, Avatar, Divider, Collapse, Tooltip,
} from 'antd';
import {
  MessageOutlined, UserOutlined, SearchOutlined, ReloadOutlined,
  RobotOutlined, ToolOutlined, ClockCircleOutlined, ExportOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import StatKpiCard from '../../components/StatKpiCard';
import EmptyChart from '../../components/EmptyChart';
import type { ConversationMessage } from '../../types/message';
import { palette, radius, space, text } from '../../theme';

const { Title, Text } = Typography;

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

// 当 Conversation 模型启用后填充消息
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.listConversations();
        if (!cancelled && res?.success) {
          setData({
            summary: res.data?.summary,
            conversations: res.data?.conversations || [],
          });
        }
      } catch { /* noop */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const list = data?.conversations || [];
    return list.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (keyword && !(`${c.title || ''} ${c.user_name || ''} ${c.summary || ''}`).toLowerCase().includes(keyword.toLowerCase())) return false;
      return true;
    });
  }, [data, keyword, statusFilter]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const exportSelected = () => {
    if (!selected) return;
    const blob = new Blob(
      [JSON.stringify(selected, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${selected.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <StatKpiCard
            title="活跃用户"
            value={data?.summary?.total_users ?? '—'}
            icon={<UserOutlined />}
            tone="primary"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatKpiCard
            title="对话会话"
            value={data?.conversations?.length ?? 0}
            icon={<MessageOutlined />}
            tone="accent"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatKpiCard
            title="在售楼盘"
            value={data?.summary?.total_properties ?? '—'}
            icon={<FilterOutlined />}
            tone="success"
          />
        </Col>
        <Col xs={24} sm={6}>
          <StatKpiCard
            title="政策文档"
            value={data?.summary?.total_policies ?? '—'}
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
                onClick={() => null}
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
                placeholder="搜索会话/用户/摘要"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
              />
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
            </div>

            {filtered.length > 0 ? (
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
                            {new Date(c.created_at).toLocaleString('zh-CN')}
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
                      {(c.summary || c.last_message) && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: palette.inkSecondary,
                            marginTop: 4,
                            display: 'block',
                          }}
                          ellipsis={{ tooltip: c.summary || c.last_message }}
                        >
                          {c.summary || c.last_message}
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
                    · {selected.user_name}
                  </Text>
                )}
              </Space>
            }
            extra={
              selected && (
                <Space>
                  <Button icon={<ExportOutlined />} onClick={exportSelected}>导出</Button>
                </Space>
              )
            }
          >
            {selected ? (
              <div style={{ padding: space.lg }}>
                {/* 会话元信息 */}
                <Space size={space.md} wrap style={{ marginBottom: space.md }}>
                  <MetaItem label="会话 ID" value={`#${selected.id}`} />
                  <MetaItem label="用户 ID" value={`#${selected.user_id}`} />
                  <MetaItem label="消息数" value={String(selected.message_count ?? 0)} />
                  <MetaItem label="创建时间" value={new Date(selected.created_at).toLocaleString('zh-CN')} />
                </Space>
                <Divider style={{ margin: `${space.md}px 0` }} />

                {/* 消息预览占位（实际渲染需要 Conversation/Message 模型启用） */}
                <div
                  style={{
                    background: palette.surfaceMuted,
                    borderRadius: radius.md,
                    padding: space.md,
                    color: palette.inkSecondary,
                  }}
                >
                  <Text style={{ fontSize: 13, color: palette.ink, fontWeight: text.subtitle.fontWeight }}>
                    {selected.title || '会话'}
                  </Text>
                  <div style={{ marginTop: space.sm }}>
                    {selected.summary || selected.last_message || '(无摘要)'}
                  </div>
                </div>

                <AlertInfo />
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
    <Text style={{ fontSize: 12, ...text.number }}>{value}</Text>
  </span>
);

const AlertInfo: React.FC = () => (
  <div
    style={{
      marginTop: space.lg,
      padding: space.md,
      background: '#fffbe6',
      borderRadius: radius.md,
      border: '1px solid #ffe58f',
    }}
  >
    <Text style={{ fontSize: 12, color: '#874d00' }}>
      提示：完整对话内容（含 user / assistant / tool 消息、tool_calls / tool_responses）需启用 Conversation/Message 数据库模型后展示。当前页面展示的是基于 Redis 缓存摘要。
    </Text>
  </div>
);

export default AdminConversations;
