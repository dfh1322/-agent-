/**
 * Register page — 柔和版
 *
 * 左侧品牌区 + SVG 智能体形象，右侧表单，全站统一 indigo 色系。
 */
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Alert, App, Row, Col, Radio } from 'antd';
import {
  UserOutlined, LockOutlined, MailOutlined, PhoneOutlined,
  PlusOutlined, CloseOutlined, HomeOutlined, RobotOutlined,
  EnvironmentOutlined, ClockCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';

const { Title, Text } = Typography;

const Register: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { message } = App.useApp();
  const [error, setError] = useState('');
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const registerRole = Form.useWatch('role', form) || 'user';

  useEffect(() => { if (isAuthenticated) navigate('/', { replace: true }); }, [isAuthenticated, navigate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    const phone = form.getFieldValue('phone');
    if (!phone) { message.warning('请先输入手机号'); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { message.error('请输入正确的手机号'); return; }
    setSendingCode(true);
    try {
      const result = await authApi.sendVerificationCode(phone);
      message.success('验证码已发送');
      if (result.code) message.info(`测试验证码: ${result.code}`);
      setCountdown(60);
    } catch (err: any) { message.error(err.response?.data?.detail || '发送失败'); }
    finally { setSendingCode(false); }
  };

  const onFinish = async (values: any) => {
    setLoading(true); setError('');
    try { await register(values); message.success('用户实例创建成功'); navigate('/login'); }
    catch (err: any) { setError(err.response?.data?.detail || '用户实例创建失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const features = [
    { icon: <RobotOutlined />, title: 'AI 精准匹配', desc: '智能 Agent 为您推荐心仪房源' },
    { icon: <ClockCircleOutlined />, title: '全天候服务', desc: '7x24 小时专业咨询在线' },
    { icon: <SafetyCertificateOutlined />, title: '安全可靠', desc: '数据加密，隐私无忧' },
  ];

  const inputBase: React.CSSProperties = {
    borderRadius: 12, height: 48, fontSize: 15,
    background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff', transition: 'all 0.25s ease',
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
      {/* 微点背景 */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle, #818cf8 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />

      {/* 关闭按钮 */}
      <button onClick={() => navigate('/login')} style={{
        position: 'absolute', top: 24, right: 24, width: 44, height: 44, borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease', zIndex: 100, fontSize: 18,
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
      ><CloseOutlined /></button>

      <Row style={{ width: '100%', minHeight: '100dvh', margin: 0 }}>

        {/* ── 左侧品牌区 ── */}
        <Col xs={0} lg={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 60, position: 'relative', overflow: 'hidden' }}>
          {/* 装饰光环 */}
          <div style={{ position: 'absolute', top: '-30%', left: '-30%', width: '160%', height: '160%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 60%)', animation: 'rotate 22s linear infinite' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: '140%', height: '140%', background: 'radial-gradient(circle, rgba(129,140,248,0.07) 0%, transparent 55%)', animation: 'rotate 18s linear infinite reverse' }} />

          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
            {/* Agent 形象 SVG */}
            <div style={{ margin: '0 auto 28px', animation: 'pulse 3.5s ease-in-out infinite' }}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ filter: 'drop-shadow(0 16px 44px rgba(99,102,241,0.35))' }}>
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                  <filter id="logoGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                {/* 外圈 */}
                <circle cx="60" cy="55" r="52" fill="none" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.3" />
                <circle cx="60" cy="55" r="44" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5" opacity="0.2" style={{ animation: 'spinReverse 10s linear infinite' }} />
                {/* 主体圆 */}
                <circle cx="60" cy="55" r="36" fill="url(#logoGrad)" />
                {/* 房屋 icon */}
                <g transform="translate(40, 42)">
                  <path d="M20,0 L40,18 L0,18 Z" fill="rgba(255,255,255,0.28)" />
                  <rect x="5" y="18" width="30" height="18" rx="3" fill="rgba(255,255,255,0.18)" />
                  <rect x="16" y="28" width="8" height="8" rx="1.5" fill="rgba(255,255,255,0.40)" />
                </g>
                {/* 顶部光点 */}
                <circle cx="60" cy="15" r="4" fill="#c4b5fd" filter="url(#logoGlow)" style={{ animation: 'antennaGlow 2s ease-in-out infinite' }} />
              </svg>
            </div>

            <Title style={{ color: '#fff', fontSize: 44, fontWeight: 800, marginBottom: 8, letterSpacing: '2px' }}>
              HouseCodex
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, display: 'block', marginBottom: 6, fontWeight: 600 }}>
              智能置业 Agent
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, display: 'block', marginBottom: 40 }}>
              Create Your Intelligent Real Estate Agent
            </Text>

            {/* 特性列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 380 }}>
              {features.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px',
                  background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)',
                  animation: 'fadeInUp 0.5s ease-out both', animationDelay: `${idx * 0.15}s`, textAlign: 'left',
                }}>
                  <span style={{ fontSize: 26, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
                    {item.icon}
                  </span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* ── 右侧表单区 ── */}
        <Col xs={24} lg={12} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 48px', position: 'relative' }}>
          <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 10 }}>
            <div style={{ marginBottom: 36, textAlign: 'left' }}>
              <Title level={2} style={{ color: '#fff', fontSize: 30, fontWeight: 700, marginBottom: 6 }}>
                创建账户
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
                加入我们，开启智能置业之旅
              </Text>
            </div>

            {error && (
              <Alert message={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 12, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#fff' }} />
            )}

            <Form form={form} name="register" onFinish={onFinish} autoComplete="off" layout="vertical" initialValues={{ role: 'user' }}>
              <Form.Item name="role" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>注册身份</Text>} rules={[{ required: true, message: '请选择注册身份' }]}>
                <Radio.Group>
                  <Radio value="user" style={{ color: '#fff' }}>普通用户（买房咨询）</Radio>
                  <Radio value="landlord" style={{ color: '#fff', marginLeft: 20 }}>房东（发布楼盘）</Radio>
                </Radio.Group>
              </Form.Item>

              {registerRole === 'landlord' && (
                <Form.Item name="company_name" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>公司/品牌名称</Text>} rules={[{ required: true, message: '房东请填写公司名称' }]}>
                  <Input placeholder="例如：绿城房产" prefix={<HomeOutlined style={{ color: '#a78bfa' }} />} style={inputBase} />
                </Form.Item>
              )}

              <Row gutter={14}>
                <Col xs={24} sm={12}>
                  <Form.Item name="username" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>用户唯一标识</Text>} rules={[{ required: true, message: '请输入' }, { min: 3, message: '至少3个字符' }]}>
                    <Input prefix={<UserOutlined style={{ color: '#a78bfa' }} />} placeholder="username" style={inputBase} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="full_name" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>显示名称 <span style={{ color: 'rgba(255,255,255,0.3)' }}>(可选)</span></Text>}>
                    <Input placeholder="Display Name" style={inputBase} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="email" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>电子邮箱</Text>} rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '格式不正确' }]}>
                <Input prefix={<MailOutlined style={{ color: '#a78bfa' }} />} placeholder="user@example.com" style={inputBase} />
              </Form.Item>

              <Row gutter={14}>
                <Col xs={24} sm={14}>
                  <Form.Item name="phone" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>手机号</Text>} rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '格式不正确' }]}>
                    <Input prefix={<PhoneOutlined style={{ color: '#a78bfa' }} />} placeholder="请输入手机号" style={inputBase} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10}>
                  <Form.Item name="verify_code" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>验证码</Text>} rules={[{ required: true, message: '请输入验证码' }]}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input placeholder="验证码" style={{ ...inputBase, flex: 1 }} />
                      <Button onClick={handleSendCode} disabled={countdown > 0 || sendingCode} loading={sendingCode}
                        style={{ borderRadius: 12, height: 48, fontSize: 13, fontWeight: 600, border: 'none', color: '#fff', whiteSpace: 'nowrap',
                          background: countdown > 0 ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
                        {countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </Button>
                    </div>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={14}>
                <Col xs={24} sm={12}>
                  <Form.Item name="password" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>密码</Text>} rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6个字符' }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: '#a78bfa' }} />} placeholder="请输入密码" style={inputBase} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="confirmPassword" label={<Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500, fontSize: 13 }}>确认密码</Text>} dependencies={['password']}
                    rules={[{ required: true, message: '请确认密码' }, ({ getFieldValue }) => ({ validator(_, value) {
                      if (!value || getFieldValue('password') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    } })]}>
                    <Input.Password prefix={<LockOutlined style={{ color: '#a78bfa' }} />} placeholder="请再次输入密码" style={inputBase} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: 28, marginBottom: 16 }}>
                <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}
                  style={{ width: '100%', height: 52, fontSize: 16, fontWeight: 700, borderRadius: 12,
                    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
                    border: 'none', boxShadow: '0 10px 30px rgba(99,102,241,0.35)', letterSpacing: '0.5px' }}>
                  创建用户实例
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>已有账户？</Text>
              <Link to="/login" style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: '#a78bfa' }}>立即登录</Link>
            </div>
          </div>
        </Col>
      </Row>

      <style>{`
        @keyframes rotate { 100%{transform:rotate(360deg)} }
        @keyframes spinReverse { 100%{transform:rotate(-360deg)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes antennaGlow { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes fadeInUp { 0%{opacity:0;transform:translateY(16px)} 100%{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
};

export default Register;
