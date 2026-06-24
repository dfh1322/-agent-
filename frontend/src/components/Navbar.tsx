/**
 * Navbar — 柔和通透版
 *
 * 浅靛蓝透明毛玻璃顶栏，图标 / 文字深色，不再深紫。
 */
import React from 'react';
import { Layout, Space, Avatar, Button, Tag } from 'antd';
import {
  LogoutOutlined,
  UserOutlined,
  StarOutlined,
  CalendarOutlined,
  SettingOutlined,
  HomeOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import PermissionControl from './PermissionControl';

const { Header } = Layout;

interface NavbarProps {
  title?: string; showBack?: boolean; onBack?: () => void; extra?: React.ReactNode;
}

const Navbar: React.FC<NavbarProps> = ({ title = 'HouseCodex', showBack, onBack, extra }) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navLinkStyle = (path: string): React.CSSProperties => ({
    color: isActive(path) ? '#6366f1' : 'var(--color-ink-secondary)',
    cursor: 'pointer', fontSize: '0.875rem', padding: '4px 10px',
    borderRadius: 6, transition: 'color var(--motion-fast) var(--motion-easing)',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: isActive(path) ? 600 : 400,
  });

  const handleNavClick = (path: string) => {
    if (isAuthenticated && user) {
      navigate(path);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(path)}`);
    }
  };

  return (
    <Header style={{
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 60, position: 'sticky', top: 0, zIndex: 100,
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showBack && (
          <Button type="text" icon={<LeftOutlined style={{ color: 'var(--color-ink-secondary)', fontSize: 16 }} />}
            onClick={onBack || (() => navigate('/'))} style={{ marginLeft: -8 }} />
        )}
        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-ink)' }}>
          {title}
        </span>
      </div>

      <Space size={2}>
        {extra}
        <PermissionControl allowedRoles={['admin']}>
          <span onClick={() => handleNavClick('/admin/properties')} style={navLinkStyle('/admin')}><SettingOutlined /> 管理</span>
        </PermissionControl>
        <PermissionControl allowedRoles={['landlord']}>
          <span onClick={() => handleNavClick('/landlord')} style={navLinkStyle('/landlord')}><HomeOutlined /> 房东</span>
        </PermissionControl>
        <span onClick={() => handleNavClick('/favorites')} style={navLinkStyle('/favorites')}><StarOutlined /> 收藏</span>
        <span onClick={() => handleNavClick('/viewing-plans')} style={navLinkStyle('/viewing-plans')}><CalendarOutlined /> 看房</span>
        <span onClick={() => handleNavClick('/profile')} style={navLinkStyle('/profile')}><UserOutlined /> 我的</span>
      </Space>

      <Space size="small">
        {isAuthenticated && user ? (
          <>
            <Space style={{
              background: 'rgba(99,102,241,0.08)', padding: '6px 16px',
              borderRadius: 'var(--radius-pill)', gap: 8,
            }}>
              <Avatar size={28} style={{ background: '#6366f1', fontSize: 14 }} icon={<UserOutlined />} />
              <span style={{ color: 'var(--color-ink)', fontSize: '0.875rem', fontWeight: 500 }}>
                {user.full_name || user.username}
              </span>
              {user.role === 'landlord' && <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>房东</Tag>}
            </Space>
            <Button type="text" icon={<LogoutOutlined />}
              onClick={() => { logout(); navigate('/login'); }}
              style={{ color: 'var(--color-ink-muted)', borderRadius: 'var(--radius-pill)' }}>
              退出
            </Button>
          </>
        ) : (
          <Button type="primary" ghost
            onClick={() => navigate('/login')}
            style={{ borderRadius: 'var(--radius-pill)' }}>
            登录
          </Button>
        )}
      </Space>
    </Header>
  );
};

export default Navbar;
