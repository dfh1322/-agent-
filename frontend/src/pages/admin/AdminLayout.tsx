/**
 * AdminLayout — 后台管理布局（v2）
 *
 * 三层结构：
 *   ├─ 左侧 sidebar：240px / 64px
 *   ├─ 顶部 header：64px
 *   └─ 主内容区
 *
 * 设计原则：
 *   * 角色感：sidebar 头部根据 isAdmin / isLandlord 显示不同的徽标 + 配色；
 *   * 数据感：顶部右侧增加"实时"快捷返回用户门户入口；
 *   * 微动效：菜单交互 150-250ms，无 layout-thrashing。
 *   * 完全复用 Ant Design 的 Layout/Avatar/Menu 原语，业务逻辑不侵入。
 */
import React, { useState, useMemo } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Typography,
  Space,
  Badge,
  Dropdown,
  Input,
  Button,
  Divider,
  Tooltip,
  Tag,
} from 'antd';
import {
  HomeOutlined,
  DatabaseOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  BellOutlined,
  LogoutOutlined,
  SettingOutlined,
  CompassOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { palette, space, radius, motion, layout, text } from '../../theme';
import type { MenuProps } from 'antd';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

interface MenuItemDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: number;
}

interface MenuGroupDef {
  title: string;
  items: MenuItemDef[];
}

/**
 * 为什么这样分组：
 *   * 数据管理 = 业务核心（楼盘、知识库、对话）
 *   * 系统配置 = 治理相关（合规、账户）
 *   * 数据统计 = 监控面板
 * 分组能让管理员一眼看清"业务 / 治理 / 监控"三类任务。
 */
const MENU_GROUPS: MenuGroupDef[] = [
  {
    title: '业务数据',
    items: [
      { key: '/admin/properties', label: '楼盘管理', icon: <HomeOutlined />, roles: ['admin', 'landlord'] },
      { key: '/admin/knowledge', label: '知识库', icon: <DatabaseOutlined />, roles: ['admin'] },
      { key: '/admin/conversations', label: '对话审核', icon: <MessageOutlined />, roles: ['admin', 'landlord'] },
    ],
  },
  {
    title: '治理与权限',
    items: [
      { key: '/admin/compliance', label: '合规配置', icon: <SafetyCertificateOutlined />, roles: ['admin'] },
      { key: '/admin/accounts', label: '账户管理', icon: <UserOutlined />, roles: ['admin'] },
    ],
  },
  {
    title: '可视化监控',
    items: [
      { key: '/admin/statistics', label: '统计面板', icon: <BarChartOutlined />, roles: ['admin', 'landlord'] },
    ],
  },
];

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([MENU_GROUPS.map((_, i) => String(i))[0]]);

  const isAdmin = user?.role === 'admin' && user?.is_admin;
  const isLandlord = user?.role === 'landlord';

  // 根据角色过滤菜单
  const visibleGroups = useMemo(() => {
    return MENU_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (it) => !it.roles || it.roles.includes(user?.role || 'user'),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [user?.role]);

  const flatItems = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups],
  );

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => navigate(key);

  const toggleCollapse = () => setCollapsed((c) => !c);

  // ─── 下拉菜单 ─────────────────────────────────────────────
  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: '个人资料' },
    { key: 'password', icon: <SettingOutlined />, label: '修改密码' },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  // ─── 面包屑 ──────────────────────────────────────────────
  const breadcrumbItems = useMemo(() => {
    const path = location.pathname;
    const item = flatItems.find((i) => i.key === path);
    if (!item) return [{ title: '管理后台' }];
    const group = visibleGroups.find((g) => g.items.some((i) => i.key === path));
    return [
      { title: '管理后台', href: '/admin' },
      { title: group?.title || '' },
      { title: item.label },
    ];
  }, [location.pathname, flatItems, visibleGroups]);

  return (
    <Layout style={{ minHeight: '100vh', background: palette.surfaceMuted }}>
      {/* ========== Sidebar ========== */}
      <Sider
        width={layout.siderExpanded}
        collapsedWidth={layout.siderCollapsed}
        collapsed={collapsed}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          overflow: 'hidden',
          background: palette.surface,
          borderRight: `1px solid ${palette.border}`,
          zIndex: 100,
        }}
      >
        {/* Logo 区 */}
        <div
          style={{
            height: layout.headerHeight,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: collapsed ? '0' : '0 16px 0 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              background: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.accent} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: palette.inkInverse,
              fontSize: 18,
              boxShadow: `0 4px 12px ${palette.primaryLight}`,
              flexShrink: 0,
            }}
          >
            <RocketOutlined />
          </div>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <Text strong style={{ fontSize: text.titleSm.fontSize, color: palette.ink }}>
                HouseCodex
              </Text>
              <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                {isAdmin ? '管理员后台' : isLandlord ? '房东工作台' : '用户工作台'}
              </Text>
            </div>
          )}
        </div>

        {/* 菜单 */}
        <div
          style={{
            padding: `${space.md}px 0`,
            height: 'calc(100vh - 64px - 72px)',
            overflowY: 'auto',
          }}
        >
          {visibleGroups.map((group, gIdx) => {
            const expanded = expandedKeys.includes(String(gIdx)) || collapsed;
            return (
              <div key={gIdx} style={{ marginBottom: space.md }}>
                {!collapsed && (
                  <div
                    onClick={() => {
                      setExpandedKeys((prev) =>
                        prev.includes(String(gIdx))
                          ? prev.filter((k) => k !== String(gIdx))
                          : [...prev, String(gIdx)],
                      );
                    }}
                    style={{
                      padding: `6px 24px`,
                      fontSize: 11,
                      fontWeight: text.subtitle.fontWeight,
                      letterSpacing: '0.06em',
                      color: palette.inkMuted,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    {group.title}
                  </div>
                )}
                {expanded && (
                  <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    onClick={handleMenuClick}
                    style={{
                      borderInlineEnd: 'none',
                      background: 'transparent',
                    }}
                    items={group.items.map((it) => ({
                      key: it.key,
                      icon: it.icon,
                      label: it.label,
                    }))}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 底部用户浮岛 */}
        {!collapsed ? (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: space.md,
              background: palette.surfaceMuted,
              borderTop: `1px solid ${palette.border}`,
            }}
          >
            <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: radius.md,
                  transition: `background ${motion.fast} ${motion.easing}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = palette.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  style={{
                    background: isAdmin ? palette.role.admin : palette.role.landlord,
                    color: palette.inkInverse,
                    fontWeight: text.subtitle.fontWeight,
                  }}
                  size={36}
                >
                  {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <Text
                    strong
                    ellipsis
                    style={{ display: 'block', fontSize: 13, color: palette.ink }}
                  >
                    {user?.full_name || user?.username}
                  </Text>
                  <Tag
                    style={{
                      margin: 0,
                      padding: '0 6px',
                      fontSize: 10,
                      border: 'none',
                      background: isAdmin ? palette.role.admin : palette.role.landlord,
                      color: palette.inkInverse,
                    }}
                  >
                    {isAdmin ? '管理员' : isLandlord ? '房东' : '用户'}
                  </Tag>
                </div>
              </div>
            </Dropdown>
          </div>
        ) : (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={collapsed ? '展开' : '收起'} placement="right">
              <Button
                type="text"
                size="small"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapse}
                style={{ color: palette.inkMuted }}
              />
            </Tooltip>
          </div>
        )}
      </Sider>

      {/* ========== 右侧内容 ========== */}
      <Layout
        style={{
          marginLeft: collapsed ? layout.siderCollapsed : layout.siderExpanded,
          transition: `margin-left ${motion.normal} ${motion.easing}`,
          background: palette.surfaceMuted,
        }}
      >
        {/* ── Header ── */}
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 99,
            height: layout.headerHeight,
            padding: `0 ${space.lg}px 0 ${space.lg}px`,
            background: palette.surface,
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'saturate(180%) blur(12px)',
          }}
        >
          {/* 面包屑 */}
          <Space size={space.sm} align="center">
            <Tooltip title="收起侧边栏">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapse}
                style={{ color: palette.inkSecondary }}
                aria-label="toggle sidebar"
              />
            </Tooltip>

            <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {breadcrumbItems.map((bc, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <Text style={{ color: palette.inkMuted, margin: '0 4px' }}>/</Text>
                  )}
                  {bc.href ? (
                    <a
                      href={bc.href}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(bc.href!);
                      }}
                      style={{
                        color: palette.inkSecondary,
                        textDecoration: 'none',
                        fontSize: text.body.fontSize,
                        fontWeight: idx === breadcrumbItems.length - 1
                          ? text.subtitle.fontWeight
                          : text.body.fontWeight,
                      }}
                    >
                      {bc.title}
                    </a>
                  ) : (
                    <Text
                      style={{
                        color: idx === breadcrumbItems.length - 1
                          ? palette.ink
                          : palette.inkSecondary,
                        fontWeight: idx === breadcrumbItems.length - 1
                          ? text.subtitle.fontWeight
                          : text.body.fontWeight,
                        fontSize: text.body.fontSize,
                      }}
                    >
                      {bc.title}
                    </Text>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </Space>

          {/* 右侧 */}
          <Space size={space.md}>
            {/* 全局搜索 */}
            <Input
              placeholder="搜索楼盘、政策、文档..."
              prefix={<SearchOutlined style={{ color: palette.inkMuted }} />}
              allowClear
              style={{
                width: 280,
                background: palette.surfaceMuted,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.md,
              }}
            />

            {/* 通知 */}
            <Tooltip title="通知">
              <Badge count={3} offset={[-2, 4]} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined style={{ fontSize: 18, color: palette.inkSecondary }} />}
                  aria-label="notifications"
                />
              </Badge>
            </Tooltip>

            <Divider orientation="vertical" style={{ height: 24, margin: 0 }} />

            {/* 切换到门户 */}
            <Tooltip title="返回用户门户首页">
              <Button
                icon={<CompassOutlined />}
                onClick={() => navigate('/')}
              >
                门户首页
              </Button>
            </Tooltip>
            <Tooltip title="进入智能咨询对话">
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => navigate('/chat')}
                style={{
                  background: palette.primary,
                  borderColor: palette.primary,
                  boxShadow: `0 4px 12px ${palette.primaryLight}`,
                }}
              >
                智能咨询
              </Button>
            </Tooltip>

            <Divider orientation="vertical" style={{ height: 24, margin: 0 }} />

            {/* 顶部用户菜单 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: `4px 10px`,
                  borderRadius: radius.md,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = palette.surfaceHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  style={{
                    background: isAdmin ? palette.role.admin : palette.role.landlord,
                    color: palette.inkInverse,
                  }}
                  size={30}
                >
                  {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase()}
                </Avatar>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <Text strong style={{ fontSize: 13 }}>
                    {user?.full_name || user?.username}
                  </Text>
                  <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                    {isAdmin ? '平台管理员' : isLandlord ? '房产公司' : '普通用户'}
                  </Text>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* ── Content ── */}
        <Content
          style={{
            padding: space.lg,
            minHeight: `calc(100vh - ${layout.headerHeight}px)`,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
