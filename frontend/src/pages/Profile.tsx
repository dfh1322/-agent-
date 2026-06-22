/**
 * ProfilePage — 个人中心（v3 · 角色感知版）
 *
 * 三套角色布局：
 *   - user（普通用户）：购房偏好为主，收藏/看房快捷入口
 *   - landlord（房东）：楼盘统计 + 公司信息
 *   - admin（管理员）：平台概览 + 管理入口
 *
 * 设计要点：
 *   - 渐变 Hero 头部，展示用户身份
 *   - 统计数据卡片行（角色差异化）
 *   - CSS 变量驱动，暗色模式自适应
 *   - 玻璃拟态卡片
 *   - 触控友好（44px+ 交互区）
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserOutlined, MailOutlined, PhoneOutlined, EditOutlined,
  LockOutlined, LogoutOutlined, StarOutlined, CalendarOutlined,
  HomeOutlined, CheckCircleOutlined, BarChartOutlined,
  SettingOutlined, SafetyCertificateOutlined, MessageOutlined,
  RocketOutlined, TeamOutlined, DatabaseOutlined, ThunderboltOutlined,
  CrownOutlined, ShopOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { authApi, settingsApi, favoriteApi, viewingPlanApi, landlordApi, adminApi } from '../services/api';
import { Navbar } from '../components';
import type { User } from '../types/user';
import type { FavoriteItem, ViewingPlanItem } from '../services/favorites';

/* ──────────── 角色标签 ──────────── */
type ProfileRole = 'user' | 'landlord' | 'admin';

function resolveRole(user: User | null): ProfileRole {
  if (!user) return 'user';
  if (user.role === 'admin' || user.is_admin) return 'admin';
  if (user.role === 'landlord') return 'landlord';
  return 'user';
}

const ROLE_LABEL: Record<ProfileRole, string> = {
  user: '普通用户',
  landlord: '房产公司',
  admin: '平台管理员',
};

const ROLE_COLOR: Record<ProfileRole, string> = {
  user: '#10b981',
  landlord: '#6366f1',
  admin: '#8b5cf6',
};

const ROLE_GRADIENT: Record<ProfileRole, string> = {
  user: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  landlord: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  admin: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
};

/* ──────────── 样式 Token ──────────── */
const heroGradient = 'linear-gradient(135deg, #667eea 0%, #818cf8 100%)';

const sectionCard: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  marginBottom: 20,
  boxShadow: 'var(--shadow-sm)',
  border: '1px solid var(--color-border)',
};

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 20,
  paddingBottom: 14,
  borderBottom: '1px solid var(--color-border)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--color-ink)',
};

const labelCss: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  color: 'var(--color-ink-secondary)',
  fontWeight: 500,
};

const inputCss: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  transition: 'border-color var(--motion-fast), box-shadow var(--motion-fast)',
  boxSizing: 'border-box',
  background: 'var(--color-bg)',
  color: 'var(--color-ink)',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--gradient-primary)',
  color: '#fff',
  border: 'none',
  padding: '10px 24px',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  transition: 'opacity var(--motion-fast), transform var(--motion-fast)',
};

const btnDanger: React.CSSProperties = {
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  padding: '10px 24px',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
};

/* ════════════════════════════════════════════════════════════════
   快速统计卡片 (小号, 可点击)
   ════════════════════════════════════════════════════════════════ */
const QuickStat: React.FC<{
  icon: React.ReactNode; label: string; value: string | number;
  color?: string; onClick?: () => void;
}> = ({ icon, label, value, color = '#6366f1', onClick }) => (
  <div
    onClick={onClick}
    style={{
      flex: '1 1 140px',
      minWidth: 140,
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform var(--motion-fast), box-shadow var(--motion-fast)',
    }}
    onMouseEnter={(e) => { (e.currentTarget.style.transform = 'translateY(-2px)'); (e.currentTarget.style.boxShadow = 'var(--shadow-md)'); }}
    onMouseLeave={(e) => { (e.currentTarget.style.transform = ''); (e.currentTarget.style.boxShadow = 'var(--shadow-sm)'); }}
  >
    <div style={{
      width: 42, height: 42, borderRadius: 'var(--radius-md)',
      background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 20, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 2 }}>{label}</div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   ProfilePage — 主组件
   ════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const role = resolveRole(user);
  const roleLabel = ROLE_LABEL[role];
  const roleColor = ROLE_COLOR[role];

  /* ── 通用字段 ── */
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  /* ── 购房偏好（普通用户） ── */
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [needSchool, setNeedSchool] = useState(false);
  const [needMetro, setNeedMetro] = useState(false);
  const [hasFund, setHasFund] = useState(false);
  const [familyMembers, setFamilyMembers] = useState('');
  const [isFirstHome, setIsFirstHome] = useState(true);
  const [prefSaved, setPrefSaved] = useState(false);

  /* ── 角色特定数据 ── */
  const [favCount, setFavCount] = useState(0);
  const [planCount, setPlanCount] = useState(0);
  const [propertyCount, setPropertyCount] = useState(0);
  const [activePropertyCount, setActivePropertyCount] = useState(0);
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);
  const [adminPropertyTotal, setAdminPropertyTotal] = useState<number | null>(null);

  /* ──────────── 数据加载 ──────────── */
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [profile, pref] = await Promise.all([
        settingsApi.getProfile(),
        settingsApi.getPreference(),
      ]);
      if (profile.success && profile.data) {
        setUser(profile.data);
        setFullName(profile.data.full_name || '');
        setPhone(profile.data.phone || '');
      }
      if (pref.success && pref.data) {
        setBudgetMin(pref.data.budget_min?.toString() || '');
        setBudgetMax(pref.data.budget_max?.toString() || '');
        setNeedSchool(!!pref.data.need_school);
        setNeedMetro(!!pref.data.need_metro);
        setHasFund(!!pref.data.has_provident_fund);
        setFamilyMembers(pref.data.family_members?.toString() || '');
        setIsFirstHome(pref.data.is_first_home ?? true);
      }
    } catch { /* fallback */ }

    // 加载角色特定统计数据
    try {
      if (role === 'user' || role === 'landlord') {
        const favRes: any = await favoriteApi.list();
        if (favRes?.success) {
          setFavCount(Array.isArray(favRes.data) ? favRes.data.length : 0);
        }
        const planRes: any = await viewingPlanApi.list();
        if (planRes?.success) {
          setPlanCount(Array.isArray(planRes.data) ? planRes.data.length : 0);
        }
      }
      if (role === 'landlord') {
        const res: any = await landlordApi.getMyProperties();
        const list = res?.properties || [];
        setPropertyCount(list.length);
        setActivePropertyCount(list.filter((p: any) => p.status === '在售').length);
      }
      if (role === 'admin') {
        try {
          const stats: any = await adminApi.getStatistics();
          if (stats?.data) {
            setAdminUserCount(stats.data.total_users ?? null);
            setAdminPropertyTotal(stats.data.total_properties ?? null);
          }
        } catch { /* admin stats optional */ }
      }
    } catch { /* stats optional */ }
    finally { setLoading(false); }
  };

  /* ──────────── 保存操作 ──────────── */
  const handleSaveProfile = async () => {
    setSaving(true);
    try { await settingsApi.updateProfile({ full_name: fullName, phone }); alert('资料已更新'); }
    catch (err: any) { alert(err.response?.data?.detail || '保存失败'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || newPw !== confirmPw) { setPwMsg('请检查密码输入'); return; }
    try {
      await settingsApi.changePassword(oldPw, newPw);
      setPwMsg('密码修改成功');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) { setPwMsg(err.response?.data?.detail || '修改失败'); }
  };

  const handleSavePrefs = async () => {
    try {
      await settingsApi.updatePreference({
        budget_min: budgetMin ? parseFloat(budgetMin) : undefined,
        budget_max: budgetMax ? parseFloat(budgetMax) : undefined,
        need_school: needSchool, need_metro: needMetro,
        has_provident_fund: hasFund,
        family_members: familyMembers ? parseInt(familyMembers) : undefined,
        is_first_home: isFirstHome,
      });
      setPrefSaved(true); setTimeout(() => setPrefSaved(false), 2000);
    } catch { /* fail silent */ }
  };

  const handleLogout = () => { authApi.logout(); navigate('/login'); };

  /* ──────────── 加载态 ──────────── */
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
        <Navbar title="个人中心" showBack onBack={() => navigate('/')} />
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ ...sectionCard, height: 200 }} className="skeleton" />
          <div style={{ ...sectionCard, height: 300 }} className="skeleton" />
        </div>
      </div>
    );
  }

  /* ──────────── 渲染 ──────────── */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="个人中心" showBack onBack={() => navigate('/')} />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* ═══════════ Hero 头部 ═══════════ */}
        <div style={{
          background: role === 'admin' ? ROLE_GRADIENT.admin : role === 'landlord' ? ROLE_GRADIENT.landlord : ROLE_GRADIENT.user,
          borderRadius: 'var(--radius-xl)',
          padding: '28px 32px',
          marginBottom: 24,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          boxShadow: role === 'admin'
            ? '0 8px 32px rgba(139, 92, 246, 0.25)'
            : role === 'landlord'
              ? '0 8px 32px rgba(99, 102, 241, 0.25)'
              : '0 8px 32px rgba(16, 185, 129, 0.25)',
        }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, flexShrink: 0,
            border: '3px solid rgba(255,255,255,0.35)',
          }}>
            {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase() || <UserOutlined />}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {user?.full_name || user?.username}
            </div>
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
              {user?.email}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(255,255,255,0.22)',
                padding: '4px 14px', borderRadius: 'var(--radius-pill)',
                fontSize: 13, fontWeight: 500,
              }}>
                {roleLabel}
              </span>
              {user?.company_name && (
                <span style={{
                  background: 'rgba(255,255,255,0.18)',
                  padding: '4px 14px', borderRadius: 'var(--radius-pill)',
                  fontSize: 13,
                }}>
                  {user.company_name}
                </span>
              )}
            </div>
          </div>
          {/* Edit shortcut */}
          <button
            onClick={() => document.getElementById('edit-section')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff', borderRadius: 'var(--radius-pill)',
              padding: '10px 22px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background var(--motion-fast)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <EditOutlined /> 编辑资料
          </button>
        </div>

        {/* ═══════════ 统计数据行 ═══════════ */}

        {/* ── 普通用户 stats ── */}
        {role === 'user' && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <QuickStat icon={<StarOutlined />} label="我的收藏" value={favCount} color="#f59e0b" onClick={() => navigate('/favorites')} />
            <QuickStat icon={<CalendarOutlined />} label="看房计划" value={planCount} color="#0ea5e9" onClick={() => navigate('/viewing-plans')} />
            <QuickStat icon={<MessageOutlined />} label="智能咨询" value="进入" color="#6366f1" onClick={() => navigate('/chat')} />
          </div>
        )}

        {/* ── 房东 stats ── */}
        {role === 'landlord' && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <QuickStat icon={<HomeOutlined />} label="我的楼盘" value={propertyCount} color="#6366f1" onClick={() => navigate('/landlord')} />
            <QuickStat icon={<CheckCircleOutlined />} label="在售中" value={activePropertyCount} color="#10b981" />
            <QuickStat icon={<StarOutlined />} label="我的收藏" value={favCount} color="#f59e0b" onClick={() => navigate('/favorites')} />
            <QuickStat icon={<ThunderboltOutlined />} label="智能咨询" value="进入" color="#6366f1" onClick={() => navigate('/chat')} />
          </div>
        )}

        {/* ── 管理员 stats ── */}
        {role === 'admin' && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <QuickStat icon={<TeamOutlined />} label="平台用户" value={adminUserCount ?? '—'} color="#8b5cf6" onClick={() => navigate('/admin/accounts')} />
            <QuickStat icon={<HomeOutlined />} label="平台楼盘" value={adminPropertyTotal ?? '—'} color="#6366f1" onClick={() => navigate('/admin/properties')} />
            <QuickStat icon={<DatabaseOutlined />} label="知识库" value="管理" color="#059669" onClick={() => navigate('/admin/knowledge')} />
            <QuickStat icon={<SafetyCertificateOutlined />} label="合规配置" value="管理" color="#f59e0b" onClick={() => navigate('/admin/compliance')} />
          </div>
        )}

        {/* ═══════════ 管理员专属：快速管理入口 ═══════════ */}
        {role === 'admin' && (
          <div style={sectionCard}>
            <div style={sectionHeader}>
              <SettingOutlined style={{ color: '#8b5cf6', fontSize: 18 }} />
              管理后台快捷入口
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { label: '楼盘管理', icon: <HomeOutlined />, path: '/admin/properties', color: '#6366f1' },
                { label: '对话审核', icon: <MessageOutlined />, path: '/admin/conversations', color: '#0ea5e9' },
                { label: '统计面板', icon: <BarChartOutlined />, path: '/admin/statistics', color: '#10b981' },
                { label: '账户管理', icon: <TeamOutlined />, path: '/admin/accounts', color: '#8b5cf6' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    color: 'var(--color-ink)',
                    transition: 'background var(--motion-fast), border-color var(--motion-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.borderColor = item.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  <span style={{ color: item.color, fontSize: 18 }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ 购房偏好（普通用户专属） ═══════════ */}
        {role === 'user' && (
          <div style={sectionCard}>
            <div style={sectionHeader}>
              <RocketOutlined style={{ color: '#10b981', fontSize: 18 }} />
              购房偏好设置
              <span style={{ fontSize: 12, color: 'var(--color-ink-muted)', fontWeight: 400, marginLeft: 'auto' }}>
                完善偏好可获得更精准的楼盘推荐
              </span>
            </div>

            {/* Budget row */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...labelCss, fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>预算范围</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <input type="number" value={budgetMin} onChange={e => setBudgetMin(e.target.value)}
                    placeholder="最低（万元）" style={inputCss} />
                </div>
                <span style={{ color: 'var(--color-ink-muted)', fontSize: 14 }}>—</span>
                <div style={{ flex: '1 1 160px' }}>
                  <input type="number" value={budgetMax} onChange={e => setBudgetMax(e.target.value)}
                    placeholder="最高（万元）" style={inputCss} />
                </div>
              </div>
            </div>

            {/* Family + Fund */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelCss}>家庭人数</label>
                <input type="number" value={familyMembers} onChange={e => setFamilyMembers(e.target.value)}
                  placeholder="如：3" style={inputCss} />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
              {([
                [needSchool, setNeedSchool, '学区房', '🏫'],
                [needMetro, setNeedMetro, '近地铁', '🚇'],
                [hasFund, setHasFund, '有公积金', '💰'],
                [isFirstHome, setIsFirstHome, '首套房', '🏠'],
              ] as [boolean, Function, string, string][]).map(([checked, setter, text, emoji], i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-pill)',
                    background: checked ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg)',
                    border: checked ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--color-border)',
                    cursor: 'pointer', fontSize: 14, color: 'var(--color-ink)',
                    transition: 'all var(--motion-fast)',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setter(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer', margin: 0 }}
                  />
                  <span style={{ fontSize: 16 }}>{emoji}</span>
                  {text}
                </label>
              ))}
            </div>

            <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}
              onClick={handleSavePrefs}>
              {prefSaved ? '✓ 已保存' : '保存偏好'}
            </button>
          </div>
        )}

        {/* ═══════════ 编辑资料 ═══════════ */}
        <div id="edit-section" style={sectionCard}>
          <div style={sectionHeader}>
            <EditOutlined style={{ color: 'var(--color-primary)', fontSize: 18 }} />
            编辑个人资料
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelCss}>显示名称</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="请输入显示名称" style={inputCss}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-light)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={labelCss}>手机号</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="请输入手机号" style={inputCss}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-light)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
          </div>
          <button style={btnPrimary} onClick={handleSaveProfile} disabled={saving}>
            {saving ? '保存中...' : '保存资料'}
          </button>
        </div>

        {/* ═══════════ 修改密码 ═══════════ */}
        <div style={sectionCard}>
          <div style={sectionHeader}>
            <LockOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
            修改密码
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              [oldPw, setOldPw, '旧密码'],
              [newPw, setNewPw, '新密码'],
              [confirmPw, setConfirmPw, '确认新密码'],
            ].map(([val, setter, placeholder], i) => (
              <div key={i} style={{ flex: '1 1 180px' }}>
                <input type="password" value={val as string} onChange={e => (setter as Function)(e.target.value)}
                  placeholder={placeholder as string} style={inputCss} />
              </div>
            ))}
          </div>
          {pwMsg && (
            <div style={{ marginBottom: 12, fontSize: 13, color: pwMsg.includes('成功') ? '#10b981' : '#ef4444', fontWeight: 500 }}>
              {pwMsg}
            </div>
          )}
          <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}
            onClick={handleChangePassword}>
            修改密码
          </button>
        </div>

        {/* ═══════════ 退出登录 ═══════════ */}
        <div style={{ ...sectionCard, textAlign: 'center', padding: '16px 24px' }}>
          <button onClick={handleLogout} style={{
            ...btnDanger, background: 'transparent', color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <LogoutOutlined /> 退出登录
          </button>
        </div>

      </div>
    </div>
  );
}
