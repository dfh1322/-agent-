/**
 * Login page — 流线变体版
 *
 * 动画流程：一条数据流线从左侧流入 → 在中间区域自动绘制出房屋形状
 * 和 AI 机器人形象 → 两个形体溶解回线条继续向右流去。无限循环。
 *
 * 移除所有 emoji，使用 SVG 向量图标和 CSS 动画。
 */
import React, { useState, useEffect, useRef } from 'react';
import { App, Typography, Input, Button, Form } from 'antd';
import {
  UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone,
  CloseOutlined, HomeOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

/* ── 品牌色 ── */
const BRAND = { primary: '#6366f1', glow: '#818cf8', soft: '#a78bfa', dark: '#312e81', teal: '#0d9488' };

const Login: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return <LoginContent isAuthenticated={isAuthenticated} />;
};

const LoginContent: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form] = Form.useForm();
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const { message } = App.useApp();

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleLogin = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    try {
      await login(values.username, values.password);
      const token = localStorage.getItem('token');
      if (!token || token === 'undefined') throw new Error('登录响应未返回 token');
      message.success('身份核验成功');
      setIsLoginModalVisible(false);
      const user = useAuthStore.getState().user;
      if (user?.role === 'admin' && user?.is_admin) navigate('/admin/properties', { replace: true });
      else if (user?.role === 'landlord') navigate('/landlord', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: any) {
      message.error(`验证失败：${err.response?.data?.detail || err?.message || '用户名或密码错误'}`);
    } finally { setIsLoading(false); }
  };

  const closeModal = () => { setIsLoginModalVisible(false); form.resetFields(); };

  return (
    <div style={styles.page}>
      {/* Subtle dot pattern */}
      <div style={styles.dotPattern} />

      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.brand}>
          <HomeOutlined style={{ fontSize: 24, color: BRAND.primary }} />
          HouseCodex
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type="text" style={styles.navBtn} onClick={() => setIsLoginModalVisible(true)}>登录</Button>
          <Link to="/register">
            <Button type="primary" style={styles.navPrimaryBtn}>注册</Button>
          </Link>
        </div>
      </nav>

      {/* Hero — animated morphing SVG */}
      <div style={styles.hero}>
        <div style={styles.svgStage}>
          {/* ================================================================
              Animated SVG: Flowing Line → House + Robot → Flowing Line
              ================================================================ */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* ── 主渐变 (靛蓝→紫) ── */}
              <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={BRAND.primary} stopOpacity="0" />
                <stop offset="15%" stopColor={BRAND.primary} stopOpacity="0.9" />
                <stop offset="40%" stopColor={BRAND.glow} stopOpacity="1" />
                <stop offset="60%" stopColor={BRAND.soft} stopOpacity="1" />
                <stop offset="85%" stopColor={BRAND.primary} stopOpacity="0.9" />
                <stop offset="100%" stopColor={BRAND.primary} stopOpacity="0" />
              </linearGradient>

              {/* ── 房屋绘制渐变 ── */}
              <linearGradient id="houseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={BRAND.glow} />
                <stop offset="100%" stopColor={BRAND.primary} />
              </linearGradient>

              {/* ── 机器人绘制渐变 ── */}
              <linearGradient id="robotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={BRAND.soft} />
                <stop offset="100%" stopColor={BRAND.glow} />
              </linearGradient>

              {/* ── 辉光滤镜 ── */}
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="glowSoft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="particleGlow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ═══════════════════════════════════════════════════════
                Layer 1 — 背景微弱的静态引导线 (subtle guide lines)
                ═══════════════════════════════════════════════════════ */}
            <path
              d="M0,110 Q200,100 400,110 Q600,120 800,110"
              stroke={BRAND.primary}
              strokeWidth="0.8"
              strokeOpacity="0.08"
              fill="none"
            />
            <path
              d="M0,115 Q200,125 400,115 Q600,105 800,115"
              stroke={BRAND.primary}
              strokeWidth="0.5"
              strokeOpacity="0.05"
              fill="none"
            />

            {/* ═══════════════════════════════════════════════════════
                Layer 2 — 主流动线 (左→右, 无限循环 dash 动画)
                ═══════════════════════════════════════════════════════ */}
            <path
              d="M-50,110 C80,100 160,125 270,110 C340,100 380,80 430,110 C510,140 580,90 700,110 C750,118 790,108 850,110"
              stroke="url(#flowGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="flow-main-line"
              filter="url(#glow)"
            />

            {/* 辅助流线 (偏移相位, 增加层次感) */}
            <path
              d="M-50,105 C80,95 160,120 270,105 C340,95 380,75 430,105 C510,135 580,85 700,105 C750,113 790,103 850,105"
              stroke="url(#flowGrad)"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              className="flow-sub-line"
              opacity="0.45"
            />

            {/* ═══════════════════════════════════════════════════════
                Layer 3 — 房屋轮廓 (中心偏左, 线条自动绘制)
                ═══════════════════════════════════════════════════════ */}
            <g filter="url(#glow)">
              {/* 屋顶左坡 */}
              <path
                d="M310,100 L345,55"
                stroke="url(#houseGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                className="house-roof-left"
              />
              {/* 屋顶右坡 */}
              <path
                d="M345,55 L380,100"
                stroke="url(#houseGrad)"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                className="house-roof-right"
              />
              {/* 左墙 */}
              <path
                d="M312,100 L312,134"
                stroke={BRAND.glow}
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
                className="house-wall-left"
              />
              {/* 右墙 */}
              <path
                d="M378,100 L378,134"
                stroke={BRAND.glow}
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
                className="house-wall-right"
              />
              {/* 地板 */}
              <path
                d="M312,134 L378,134"
                stroke={BRAND.soft}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                className="house-floor"
              />
              {/* 门 */}
              <path
                d="M335,134 L335,113 L355,113 L355,134"
                stroke={BRAND.glow}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="house-door"
              />
              {/* 烟囱 */}
              <path
                d="M362,90 L362,72"
                stroke={BRAND.soft}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                className="house-chimney"
              />
              {/* 窗户 */}
              <rect
                x="320" y="108" width="10" height="10" rx="2"
                stroke={BRAND.soft}
                strokeWidth="1.5"
                fill="none"
                className="house-window"
              />
            </g>

            {/* ═══════════════════════════════════════════════════════
                Layer 4 — AI 机器人轮廓 (中心偏右, 线条自动绘制)
                ═══════════════════════════════════════════════════════ */}
            <g filter="url(#glow)">
              {/* 天线杆 */}
              <path
                d="M490,60 L490,38"
                stroke={BRAND.soft}
                strokeWidth="2" strokeLinecap="round" fill="none"
                className="robot-antenna-shaft"
              />
              {/* 天线球 */}
              <circle cx="490" cy="35" r="5"
                stroke={BRAND.soft} strokeWidth="1.8" fill="none"
                className="robot-antenna-ball"
              />
              {/* 头部 */}
              <path
                d="M455,60 L455,88 L525,88 L525,60 Z"
                stroke="url(#robotGrad)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                className="robot-head"
              />
              {/* 左眼 */}
              <rect x="466" y="68" width="16" height="10" rx="3"
                stroke={BRAND.glow} strokeWidth="1.6" fill="none"
                className="robot-eye-l"
              />
              {/* 右眼 */}
              <rect x="498" y="68" width="16" height="10" rx="3"
                stroke={BRAND.glow} strokeWidth="1.6" fill="none"
                className="robot-eye-r"
              />
              {/* 嘴巴 / 声波 */}
              <path
                d="M475,83 L490,88 L505,83"
                stroke={BRAND.soft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                className="robot-mouth"
              />
              {/* 身体 */}
              <path
                d="M462,96 L462,136 L518,136 L518,96 Z"
                stroke="url(#robotGrad)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"
                className="robot-body"
              />
              {/* 身体横线 */}
              <path
                d="M462,114 L518,114"
                stroke={BRAND.glow} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"
                className="robot-body-line"
              />
              {/* 左右臂 */}
              <path
                d="M455,105 L440,125"
                stroke={BRAND.soft} strokeWidth="2" strokeLinecap="round" fill="none"
                className="robot-arm-l"
              />
              <path
                d="M525,105 L540,125"
                stroke={BRAND.soft} strokeWidth="2" strokeLinecap="round" fill="none"
                className="robot-arm-r"
              />
              {/* 数据环 */}
              <circle cx="440" cy="74" r="3.5"
                stroke={BRAND.glow} strokeWidth="1.2" fill="none" opacity="0.5"
                className="robot-ring"
              />
              <circle cx="540" cy="74" r="3.5"
                stroke={BRAND.glow} strokeWidth="1.2" fill="none" opacity="0.5"
                className="robot-ring-r"
              />
            </g>

            {/* ═══════════════════════════════════════════════════════
                Layer 5 — 旅行粒子 (沿主线移动的发光圆点)
                ═══════════════════════════════════════════════════════ */}
            <circle r="4.5" fill={BRAND.glow} filter="url(#particleGlow)">
              <animateMotion
                path="M-50,110 C80,100 160,125 270,110 C340,100 380,80 430,110 C510,140 580,90 700,110 C750,118 790,108 850,110"
                dur="6s" repeatCount="indefinite"
              />
            </circle>
            <circle r="3" fill="#c4b5fd" filter="url(#particleGlow)">
              <animateMotion
                path="M-50,110 C80,100 160,125 270,110 C340,100 380,80 430,110 C510,140 580,90 700,110 C750,118 790,108 850,110"
                dur="6s" repeatCount="indefinite" begin="-2s"
              />
            </circle>
            <circle r="2.5" fill="#a5b4fc" filter="url(#particleGlow)">
              <animateMotion
                path="M-50,110 C80,100 160,125 270,110 C340,100 380,80 430,110 C510,140 580,90 700,110 C750,118 790,108 850,110"
                dur="6s" repeatCount="indefinite" begin="-4s"
              />
            </circle>

            {/* ═══════════════════════════════════════════════════════
                Layer 6 — 过渡流光节点 (房屋 ↔ 机器人连接处)
                ═══════════════════════════════════════════════════════ */}
            <path
              d="M380,110 C400,100 410,100 430,110"
              stroke={BRAND.glow}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
              className="bridge-line"
            />
          </svg>
        </div>

        {/* Title */}
        <div style={styles.titles}>
          <Title level={1} style={styles.mainTitle}>
            HouseCodex
          </Title>
          <Text style={styles.subtitle}>
            智能置业 Agent
          </Text>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={styles.bottom}>
        <div style={styles.ctaCard}>
          <Input
            placeholder="输入账号、密码完成身份核验"
            readOnly
            onClick={() => setIsLoginModalVisible(true)}
            style={styles.ctaInput}
          />
          <div style={{ display: 'flex', gap: 16 }}>
            <Button type="default" size="large" style={styles.ctaBtn} onClick={() => setIsLoginModalVisible(true)}>
              表单登录
            </Button>
            <Link to="/register" style={{ flex: 1 }}>
              <Button type="primary" size="large" style={styles.ctaPrimaryBtn}>
                创建用户实例
              </Button>
            </Link>
          </div>
        </div>
        <div style={styles.footerTech}>
          FastAPI · LangChain · React · Python · VectorDB
        </div>
      </div>

      {/* Login Modal */}
      {isLoginModalVisible && (
        <>
          <div onClick={closeModal} style={styles.overlay} />
          <div style={styles.modalWrapper}>
            <div style={styles.modal}>
              <div style={styles.modalTopBar} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '28px 28px 0' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <LockOutlined style={{ fontSize: 22, color: BRAND.primary }} />
                    <span style={{ color: 'var(--color-ink)', fontSize: 20, fontWeight: 700 }}>身份核验</span>
                  </div>
                  <Text style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>请输入账号和密码以访问系统</Text>
                </div>
                <button onClick={closeModal} style={styles.closeBtn}><CloseOutlined /></button>
              </div>
              <div style={{ padding: '24px 28px 28px' }}>
                <Form form={form} onFinish={handleLogin} layout="vertical" initialValues={{ username: '', password: '' }}>
                  <Form.Item name="username" label={<span style={styles.fieldLabel}>账号</span>} rules={[{ required: true, message: '请输入账号' }]}>
                    <Input placeholder="请输入账号" prefix={<UserOutlined style={{ color: BRAND.primary }} />} size="large" style={styles.fieldInput} />
                  </Form.Item>
                  <Form.Item name="password" label={<span style={styles.fieldLabel}>密码</span>} rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password placeholder="请输入密码" prefix={<LockOutlined style={{ color: BRAND.primary }} />} iconRender={(v) => v ? <EyeTwoTone /> : <EyeInvisibleOutlined />} size="large" style={styles.fieldInput} />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 16 }}>
                    <Button type="primary" htmlType="submit" loading={isLoading} block size="large" style={styles.submitBtn}>
                      {isLoading ? '登录中...' : '登录'}
                    </Button>
                  </Form.Item>
                </Form>
                <div style={styles.modalFooter}>
                  <Text style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>
                    还没有账号？ <Link to="/register" style={{ color: BRAND.primary, fontWeight: 600 }}>立即注册</Link>
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Animation Keyframes
          ═══════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── 主流动线 (持续 dash 流动) ── */
        .flow-main-line {
          stroke-dasharray: 200 600;
          animation: flowDash 4s linear infinite;
        }
        .flow-sub-line {
          stroke-dasharray: 150 500;
          animation: flowDash 4s linear infinite -1.3s;
        }
        @keyframes flowDash {
          0%   { stroke-dashoffset: 800; }
          100% { stroke-dashoffset: -800; }
        }

        /* ── 过渡桥接线 ── */
        .bridge-line {
          stroke-dasharray: 60;
          animation: bridgePulse 4s ease-in-out infinite;
        }
        @keyframes bridgePulse {
          0%, 100% { stroke-dashoffset: 0; opacity: 0.3; }
          50%      { stroke-dashoffset: -60; opacity: 0.8; }
        }

        /* ═══════════════ 房屋绘制 ═══════════════ */
        /* 从左下角开始逆时针: 左墙→屋顶左→屋顶右→右墙→地板→门→烟囱→窗 */
        .house-roof-left   { stroke-dasharray: 55;  animation: drawHouseA 8s ease-in-out infinite; }
        .house-roof-right  { stroke-dasharray: 55;  animation: drawHouseA 8s ease-in-out infinite 0.15s; }
        .house-wall-left   { stroke-dasharray: 38;  animation: drawHouseA 8s ease-in-out infinite 0.3s; }
        .house-wall-right  { stroke-dasharray: 38;  animation: drawHouseA 8s ease-in-out infinite 0.45s; }
        .house-floor       { stroke-dasharray: 70;  animation: drawHouseA 8s ease-in-out infinite 0.6s; }
        .house-door        { stroke-dasharray: 80;  animation: drawHouseA 8s ease-in-out infinite 0.8s; }
        .house-chimney     { stroke-dasharray: 22;  animation: drawHouseA 8s ease-in-out infinite 1.0s; }
        .house-window      { stroke-dasharray: 44;  animation: drawHouseA 8s ease-in-out infinite 1.15s; }

        @keyframes drawHouseA {
          0%, 15%  { stroke-dashoffset: var(--d); opacity: 0; }
          20%, 40% { stroke-dashoffset: 0; opacity: 1; }
          65%, 85% { stroke-dashoffset: 0; opacity: 1; }
          90%, 100%{ stroke-dashoffset: var(--d); opacity: 0; }
        }

        /* 给每个房屋路径设置自定义 dasharray offset */
        .house-roof-left   { --d: 55; }
        .house-roof-right  { --d: 55; }
        .house-wall-left   { --d: 38; }
        .house-wall-right  { --d: 38; }
        .house-floor       { --d: 70; }
        .house-door        { --d: 80; }
        .house-chimney     { --d: 22; }
        .house-window      { --d: 44; }

        /* ═══════════════ 机器人绘制 (稍晚于房屋) ═══════════════ */
        .robot-antenna-shaft { stroke-dasharray: 26;  animation: drawRobot 8s ease-in-out infinite 1.2s; }
        .robot-antenna-ball  { stroke-dasharray: 35;  animation: drawRobot 8s ease-in-out infinite 1.3s; }
        .robot-head          { stroke-dasharray: 132; animation: drawRobot 8s ease-in-out infinite 1.4s; }
        .robot-eye-l         { stroke-dasharray: 56;  animation: drawRobot 8s ease-in-out infinite 1.55s; }
        .robot-eye-r         { stroke-dasharray: 56;  animation: drawRobot 8s ease-in-out infinite 1.6s; }
        .robot-mouth         { stroke-dasharray: 40;  animation: drawRobot 8s ease-in-out infinite 1.7s; }
        .robot-body          { stroke-dasharray: 152; animation: drawRobot 8s ease-in-out infinite 1.8s; }
        .robot-body-line     { stroke-dasharray: 58;  animation: drawRobot 8s ease-in-out infinite 1.9s; }
        .robot-arm-l         { stroke-dasharray: 26;  animation: drawRobot 8s ease-in-out infinite 2.0s; }
        .robot-arm-r         { stroke-dasharray: 26;  animation: drawRobot 8s ease-in-out infinite 2.05s; }
        .robot-ring          { stroke-dasharray: 24;  animation: drawRobot 8s ease-in-out infinite 2.1s; }
        .robot-ring-r        { stroke-dasharray: 24;  animation: drawRobot 8s ease-in-out infinite 2.15s; }

        @keyframes drawRobot {
          0%, 25%  { stroke-dashoffset: var(--dr); opacity: 0; }
          30%, 50% { stroke-dashoffset: 0; opacity: 1; }
          65%, 80% { stroke-dashoffset: 0; opacity: 1; }
          85%, 100%{ stroke-dashoffset: var(--dr); opacity: 0; }
        }

        .robot-antenna-shaft { --dr: 26; }
        .robot-antenna-ball  { --dr: 35; }
        .robot-head          { --dr: 132; }
        .robot-eye-l         { --dr: 56; }
        .robot-eye-r         { --dr: 56; }
        .robot-mouth         { --dr: 40; }
        .robot-body          { --dr: 152; }
        .robot-body-line     { --dr: 58; }
        .robot-arm-l         { --dr: 26; }
        .robot-arm-r         { --dr: 26; }
        .robot-ring          { --dr: 24; }
        .robot-ring-r        { --dr: 24; }

        /* ── 柔和呼吸辉光 (房屋+机器人整体) ── */
        @keyframes shapesGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(99,102,241,0.3)); }
          50%      { filter: drop-shadow(0 0 16px rgba(129,140,248,0.6)); }
        }
      `}</style>
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════
   Styles
   ═════════════════════════════════════════════════════════════ */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #eef2ff 50%, #f0f9ff 100%)',
    position: 'relative', overflow: 'hidden',
  },
  dotPattern: {
    position: 'absolute', inset: 0, opacity: 0.12,
    backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
    backgroundSize: '32px 32px', pointerEvents: 'none',
  },

  /* Nav */
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    padding: '18px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(14px)',
    borderBottom: '1px solid var(--color-border)',
  },
  brand: {
    fontSize: 20, fontWeight: 700, color: 'var(--color-ink)',
    letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: 10,
  },
  navBtn: {
    color: 'var(--color-ink-secondary)', fontSize: 14, fontWeight: 500,
    borderRadius: 'var(--radius-md)',
  },
  navPrimaryBtn: {
    fontSize: 14, fontWeight: 500, borderRadius: 'var(--radius-md)',
    height: 36, padding: '0 20px',
  },

  /* Hero */
  hero: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingBottom: 24,
  },
  svgStage: {
    width: '100%', maxWidth: 720, height: 200,
    margin: '0 auto',
  },
  titles: {
    textAlign: 'center', marginTop: 16,
    animation: 'titleFadeIn 1.5s ease-out 0.5s both',
  },
  mainTitle: {
    color: 'var(--color-ink)', fontSize: 48, fontWeight: 800,
    marginBottom: 6, letterSpacing: '2px',
  },
  subtitle: {
    color: 'var(--color-ink-muted)', fontSize: 18,
    display: 'block', letterSpacing: '4px',
  },

  /* Bottom */
  bottom: {
    padding: '0 20px 80px', marginTop: -8, display: 'flex', flexDirection: 'column',
    alignItems: 'center', animation: 'bottomFadeIn 1s ease-out 1s both',
  },
  ctaCard: {
    width: '100%', maxWidth: 560,
    background: 'var(--color-surface)', backdropFilter: 'blur(16px)',
    borderRadius: 'var(--radius-xl)', padding: 32,
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-lg)',
  },
  ctaInput: {
    borderRadius: 'var(--radius-md)', height: 48, fontSize: 15,
    cursor: 'pointer', marginBottom: 16,
  },
  ctaBtn: {
    flex: 1, borderRadius: 'var(--radius-md)', height: 48,
    fontSize: 15, fontWeight: 600,
  },
  ctaPrimaryBtn: {
    width: '100%', borderRadius: 'var(--radius-md)', height: 48,
    fontSize: 15, fontWeight: 600,
  },
  footerTech: {
    marginTop: 24, color: 'var(--color-ink-muted)', fontSize: 12,
    fontFamily: 'monospace', letterSpacing: '2px',
  },

  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
    backdropFilter: 'blur(6px)', zIndex: 9998,
    animation: 'fadeIn 0.2s ease-out',
  },
  modalWrapper: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)', zIndex: 9999,
    width: 420, maxWidth: '90vw',
    animation: 'modalSlideIn 0.3s ease-out',
  },
  modal: {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
  },
  modalTopBar: {
    height: 3,
    background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.glow}, ${BRAND.soft}, ${BRAND.glow}, ${BRAND.primary})`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 3s linear infinite',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-muted)',
    color: 'var(--color-ink-muted)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, padding: 0,
  },
  fieldLabel: { color: 'var(--color-ink-secondary)', fontSize: 13, fontWeight: 500 },
  fieldInput: { borderRadius: 'var(--radius-md)', height: 46 },
  submitBtn: { borderRadius: 'var(--radius-md)', height: 48, fontSize: 16, fontWeight: 600 },
  modalFooter: {
    textAlign: 'center', padding: 14,
    background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
  },
};

export default Login;
