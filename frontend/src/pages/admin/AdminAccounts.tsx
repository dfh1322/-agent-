/**
 * AdminAccounts - 账户管理 v2
 *
 * 设计要点：
 *   * 顶部 3 个 KPI 分别针对 admin / landlord / user；
 *   * 按 role 切换 Tabs；表格 + 卡片视图切换；
 *   * 创建账号使用 Steps Modal 引导；
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Button, Form, Input, Select, Tag, Space, App, Popconfirm,
  Row, Col, Card, Typography, Tabs, Segmented, Steps, Table,
} from 'antd';
import {
  PlusOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined,
  ReloadOutlined, SearchOutlined, AppstoreOutlined, BarsOutlined,
  UserOutlined, TeamOutlined, CrownOutlined,
} from '@ant-design/icons';
import { adminApi, type AdminUser } from '../../services/api';
import PermissionControl from '../../components/PermissionControl';
import StatKpiCard from '../../components/StatKpiCard';
import EmptyChart from '../../components/EmptyChart';
import DraggableModal from '../../components/DraggableModal';
import { palette, radius, space, text } from '../../theme';

const { Title, Text } = Typography;

const ROLE_META: Record<string, { label: string; color: string; tone: string; icon: React.ReactNode }> = {
  admin: { label: '管理员', color: palette.role.admin, tone: 'accent', icon: <CrownOutlined /> },
  landlord: { label: '房产公司', color: palette.role.landlord, tone: 'primary', icon: <TeamOutlined /> },
  user: { label: '普通用户', color: palette.role.user, tone: 'success', icon: <UserOutlined /> },
};

const AdminAccounts: React.FC = () => {
  const [data, setData] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [roleTab, setRoleTab] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAccounts({
        page,
        page_size: 20,
        keyword: keyword || undefined,
        role_filter: roleTab === 'all' ? undefined : roleTab,
      });
      if (res.success) {
        setData(res.data);
        setTotal(res.pagination?.total ?? res.data.length);
      }
    } catch {
      message.error('获取账户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, roleTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (user: AdminUser) => {
    try {
      await adminApi.toggleAccount(user.id, !user.is_active);
      message.success(`用户 "${user.username}" 已${user.is_active ? '禁用' : '启用'}`);
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (u: AdminUser) => {
    try {
      await adminApi.deleteAccount(u.id);
      message.success(`用户 "${u.username}" 已删除`);
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await adminApi.createAccount(values);
      message.success('用户创建成功');
      setModalOpen(false);
      setCreateStep(0);
      form.resetFields();
      fetchData();
    } catch {
      /* validation */
    }
  };

  // ── KPIs ──
  const kpi = useMemo(() => {
    const out: Record<string, number> = { admin: 0, landlord: 0, user: 0 };
    data.forEach((u) => {
      if (out[u.role] !== undefined) out[u.role]++;
    });
    return out;
  }, [data]);

  const columns = [
    {
      title: '用户',
      key: 'user',
      width: 220,
      render: (_: unknown, r: AdminUser) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: ROLE_META[r.role]?.color || palette.primary,
              color: palette.inkInverse,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: text.subtitle.fontWeight,
              flexShrink: 0,
            }}
          >
            {r.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, minWidth: 0 }}>
            <Text strong style={{ fontSize: 13, color: palette.ink }}>{r.username}</Text>
            <Text style={{ fontSize: 11, color: palette.inkMuted }} ellipsis>
              {r.email}
            </Text>
          </div>
        </div>
      ),
    },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name', width: 110, render: (v?: string) => v || <Text type="secondary">—</Text> },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (r: string) => {
        const m = ROLE_META[r];
        return (
          <Tag
            style={{
              background: `${m?.color}1a`,
              color: m?.color,
              border: `1px solid ${m?.color}40`,
              borderRadius: radius.sm,
              padding: '1px 10px',
              fontWeight: text.subtitle.fontWeight,
            }}
          >
            {m?.label || r}
          </Tag>
        );
      },
    },
    { title: '公司', dataIndex: 'company_name', key: 'company_name', width: 150, render: (v?: string) => v || <Text type="secondary">—</Text> },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (v: boolean) => (
        <Tag
          style={{
            background: v ? palette.successLight : palette.surfaceMuted,
            color: v ? palette.successInk : palette.inkMuted,
            border: 'none',
            borderRadius: radius.pill,
            padding: '0 10px',
            fontWeight: text.subtitle.fontWeight,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 6, height: 6, borderRadius: '50%',
              background: v ? palette.success : palette.inkMuted,
              marginRight: 6,
            }}
          />
          {v ? '活跃' : '已禁用'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, r: AdminUser) => (
        <PermissionControl allowedRoles={['admin']}>
          <Space>
            <Button
              type="link"
              size="small"
              icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggle(r)}
              style={{ color: r.is_active ? palette.warning : palette.success }}
            >
              {r.is_active ? '禁用' : '启用'}
            </Button>
            <Popconfirm
              title={`确定删除 "${r.username}" 吗？此操作不可撤销`}
              onConfirm={() => handleDelete(r)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </PermissionControl>
      ),
    },
  ];

  return (
    <div>
      {/* ── 页面头 ── */}
      <div style={{ marginBottom: space.lg }}>
        <Title level={3} style={{ margin: 0, fontSize: text.heading.fontSize }}>
          <UserOutlined style={{ color: palette.primary, marginRight: space.sm }} />
          账户管理
        </Title>
        <Text style={{ color: palette.inkSecondary, marginTop: 4, display: 'block' }}>
          平台所有账户的统一管理，支持创建、禁用、角色分配
        </Text>
      </div>

      {/* ── KPI ── */}
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        {(['admin', 'landlord', 'user'] as const).map((role) => {
          const m = ROLE_META[role];
          return (
            <Col xs={24} sm={8} key={role}>
              <StatKpiCard
                title={m.label}
                value={kpi[role]}
                icon={m.icon}
                tone={m.tone as 'primary' | 'accent' | 'success'}
                hint={role === 'admin' ? '平台管理员' : role === 'landlord' ? '房产公司' : '普通用户'}
              />
            </Col>
          );
        })}
      </Row>

      {/* ── 主体卡片 ── */}
      <Card variant="borderless" style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm }} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: `${space.md}px ${space.lg}px`,
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: space.md,
          }}
        >
          <Tabs
            activeKey={roleTab}
            onChange={(k) => { setRoleTab(k); setPage(1); }}
            items={[
              { key: 'all', label: `全部 (${total})` },
              { key: 'admin', label: '管理员' },
              { key: 'landlord', label: '房产公司' },
              { key: 'user', label: '普通用户' },
            ]}
            tabBarStyle={{ margin: 0, borderBottom: 'none' }}
          />
          <Space size={space.sm} wrap>
            <Input
              placeholder="搜索用户名 / 邮箱 / 姓名"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              style={{ width: 240 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <PermissionControl allowedRoles={['admin']}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setModalOpen(true); setCreateStep(0); }}
                style={{ background: palette.primary, borderColor: palette.primary }}
              >
                创建账户
              </Button>
            </PermissionControl>
          </Space>
        </div>

        {/* 顶部 toolbar：视图模式 */}
        <div
          style={{
            padding: `${space.sm}px ${space.lg}px`,
            borderBottom: `1px solid ${palette.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 12, color: palette.inkMuted }}>
            共 {total} 个账户 · 当前显示 {data.length} 条
          </Text>
          <Segmented
            options={[
              { value: 'list', icon: <BarsOutlined /> },
              { value: 'grid', icon: <AppstoreOutlined /> },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as 'list' | 'grid')}
          />
        </div>

        <div style={{ padding: space.md }}>
          {data.length > 0 ? (
            viewMode === 'list' ? (
              <Table
                dataSource={data}
                columns={columns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1080 }}
                pagination={{
                  current: page,
                  pageSize: 20,
                  total,
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 条`,
                  onChange: (p) => setPage(p),
                }}
              />
            ) : (
              // Grid 视图：用户卡片
              <Row gutter={[space.md, space.md]}>
                {data.map((u) => {
                  const m = ROLE_META[u.role];
                  return (
                    <Col xs={24} sm={12} lg={8} xl={6} key={u.id}>
                      <Card hoverable style={{ borderRadius: radius.lg }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div
                            style={{
                              width: 44, height: 44, borderRadius: 22,
                              background: m?.color,
                              color: palette.inkInverse,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 16, fontWeight: text.subtitle.fontWeight,
                            }}
                          >
                            {u.username?.[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Text strong ellipsis style={{ display: 'block' }}>{u.username}</Text>
                            <Text style={{ fontSize: 11, color: palette.inkMuted }} ellipsis>{u.email}</Text>
                          </div>
                          <Tag color={m?.color}>{m?.label}</Tag>
                        </div>
                        <div style={{ marginTop: space.sm, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: u.is_active ? palette.successInk : palette.inkMuted,
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                                background: u.is_active ? palette.success : palette.inkMuted,
                                marginRight: 6,
                              }}
                            />
                            {u.is_active ? '活跃' : '已禁用'}
                          </span>
                          <PermissionControl allowedRoles={['admin']}>
                            <Space size={4}>
                              <Button type="link" size="small" onClick={() => handleToggle(u)}>
                                {u.is_active ? '禁用' : '启用'}
                              </Button>
                              <Popconfirm
                                title={`删除 "${u.username}"?`}
                                onConfirm={() => handleDelete(u)}
                                okButtonProps={{ danger: true }}
                              >
                                <Button type="link" size="small" danger>删除</Button>
                              </Popconfirm>
                            </Space>
                          </PermissionControl>
                        </div>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )
          ) : (
            <EmptyChart
              title="暂无账户"
              message={keyword ? '当前搜索条件下没有账户' : '当前角色分类下没有账户'}
              actionLabel={!keyword ? '创建账户' : undefined}
              onAction={!keyword ? () => setModalOpen(true) : undefined}
              height={180}
            />
          )}
        </div>
      </Card>

      {/* ── 创建账户 Modal（步骤式，可拖动） ── */}
      <DraggableModal
        title={
          <span style={{ fontSize: text.subtitle.fontSize, fontWeight: text.subtitle.fontWeight }}>
            创建新账户
          </span>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setCreateStep(0); form.resetFields(); }}
        onCloseModal={() => { setModalOpen(false); setCreateStep(0); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        width={620}
        initialOffset={{ x: 0, y: 40 }}
        style={{ top: 80 }}
      >
        <Steps
          current={createStep}
          size="small"
          style={{ marginBottom: space.lg }}
          items={[
            { title: '基本信息' },
            { title: '权限角色' },
            { title: '完成' },
          ]}
        />
        <Form form={form} layout="vertical" initialValues={{ role: 'user' }}>
          {createStep === 0 && (
            <>
              <Row gutter={space.md}>
                <Col span={12}>
                  <Form.Item name="username" label="用户名" rules={[{ required: true, min: 3 }]}>
                    <Input placeholder="如：zhangfangdong" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
                    <Input placeholder="example@housecodex.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                    <Input.Password placeholder="至少 6 位" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label="手机号">
                    <Input placeholder="选填" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="full_name" label="姓名">
                    <Input placeholder="选填" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
          {createStep === 1 && (
            <>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(ROLE_META).map(([value, m]) => ({
                    value,
                    label: `${m.label}`,
                  }))}
                />
              </Form.Item>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) =>
                  getFieldValue('role') === 'landlord' ? (
                    <Form.Item name="company_name" label="公司名称" rules={[{ required: true }]}>
                      <Input placeholder="如：绿城房产" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </>
          )}
          {createStep === 2 && (
            <div style={{ padding: space.md, color: palette.inkSecondary }}>
              <p>
                提交后将立即创建账户，并把密码以加密形式保存到数据库。新用户下次登录需使用配置的初始密码。
              </p>
              <p>
                如选择「房产公司」角色，记得填写公司名称，否则会在「房东工作台」显示为匿名。
              </p>
            </div>
          )}

          <div style={{ marginTop: space.lg, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={createStep === 0}
              onClick={() => setCreateStep((s) => Math.max(0, s - 1))}
            >
              上一步
            </Button>
            <Space>
              <Button onClick={() => { setModalOpen(false); setCreateStep(0); }}>取消</Button>
              {createStep < 2 ? (
                <Button
                  type="primary"
                  onClick={async () => {
                    try {
                      await form.validateFields();
                      setCreateStep((s) => s + 1);
                    } catch { /* validation */ }
                  }}
                >
                  下一步
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={handleCreate}
                  style={{ background: palette.primary, borderColor: palette.primary }}
                >
                  确认创建
                </Button>
              )}
            </Space>
          </div>
        </Form>
      </DraggableModal>
    </div>
  );
};

export default AdminAccounts;
