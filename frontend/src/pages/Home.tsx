/**
 * Home page — 柔和通透版
 */
import React from 'react';
import { Layout, Row, Col, Button, Space } from 'antd';
import {
  RobotOutlined, EnvironmentOutlined, DollarOutlined, SwapOutlined,
  ReadOutlined, FileTextOutlined,
  SettingOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Navbar, FeatureCard } from '../components';

const { Content } = Layout;

const Home: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    if (isAuthenticated && user) {
      navigate(path);
    } else {
      navigate(`/login?redirect=${encodeURIComponent(path)}`);
    }
  };

  const features = [
    { icon: <RobotOutlined />, title: '智能需求挖掘', description: 'AI Agent 主动与您交互，精准挖掘购房需求', gradient: 'var(--gradient-card1)', tag: 'AI', path: '/chat' },
    { icon: <EnvironmentOutlined />, title: '楼盘智能匹配', description: '多条件复合筛选，优先级权重匹配，找到最合适的房源', gradient: 'var(--gradient-card2)', tag: '推荐', path: '/properties' },
    { icon: <DollarOutlined />, title: '金融测算一体化', description: '首付、月供、总利息实时计算，支持多种贷款方案', gradient: 'var(--gradient-card3)', tag: '计算', path: '/calculator' },
    { icon: <SwapOutlined />, title: '多楼盘智能对比', description: '输入多个楼盘，Agent 自动生成对比维度和综合推荐', gradient: 'var(--gradient-card4)', tag: '对比', path: '/properties/compare' },
    { icon: <ReadOutlined />, title: '政策科普问答', description: '本地限购、落户、公积金提取、二套认定规则查询', gradient: 'var(--gradient-card5)', tag: '知识', path: '/policy' },
    { icon: <FileTextOutlined />, title: '个性化方案生成', description: '整合全部需求，生成完整看房报告和置业建议', gradient: 'var(--gradient-card6)', tag: '方案', path: '/plan' },
  ];

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar
        title="HouseCodex"
        extra={
          <Space>
            {user?.role === 'admin' && user?.is_admin && (
              <Button type="primary" icon={<SettingOutlined />}
                onClick={() => handleNavigate('/admin/properties')}
                style={{ borderRadius: 'var(--radius-pill)' }}>管理后台</Button>
            )}
            {user?.role === 'landlord' && (
              <Button icon={<HomeOutlined />}
                onClick={() => handleNavigate('/landlord')}
                style={{ borderRadius: 'var(--radius-pill)' }}>房东中心</Button>
            )}
          </Space>
        }
      />

      <Content style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>

          {/* ── Hero (浅色渐变背景，深色文字) ────────────────── */}
          <section style={{
            textAlign: 'center', marginBottom: 'var(--space-2xl)',
            padding: '64px 40px', borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, #eef2ff 0%, #f0f9ff 50%, #ecfdf5 100%)',
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{
              display: 'inline-block', padding: '6px 20px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(99,102,241,0.10)',
              color: '#6366f1', fontSize: '0.875rem', fontWeight: 600,
              marginBottom: 24, letterSpacing: '0.03em',
            }}>
              AI-Powered Real Estate Consulting
            </div>
            <h1 style={{
              color: 'var(--color-ink)', fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              fontWeight: 700, marginBottom: 12, lineHeight: 1.2,
            }}>
              基于 Agent 的楼房咨询系统
            </h1>
            <p style={{
              fontSize: '1.1rem', color: 'var(--color-ink-secondary)',
              maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6,
            }}>
              智能、专业、高效的房产咨询，Agent 驱动需求挖掘，为您找到理想的家
            </p>
            <Button type="primary" size="large" onClick={() => handleNavigate('/chat')}
              style={{
                height: 48, fontSize: 16, fontWeight: 600,
                borderRadius: 'var(--radius-pill)', padding: '0 40px',
                boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
              }}>
              开始咨询
            </Button>
          </section>

          {/* ── Features ─────────────────────────────────────── */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ color: 'var(--color-ink)' }}>核心功能</h2>
            <p style={{ color: 'var(--color-ink-muted)', marginTop: 8 }}>
              六大模块，覆盖从选房到签约全流程
            </p>
          </div>

          <Row gutter={[20, 20]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <FeatureCard {...feature} onClick={() => handleNavigate(feature.path)} index={index} />
              </Col>
            ))}
          </Row>
        </div>
      </Content>
    </Layout>
  );
};

export default Home;
