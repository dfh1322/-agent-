/**
 * Calculator page — 金融测算中心
 *
 * 优化要点：
 *   * 移除 emoji，CSS 变量驱动
 *   * 毛玻璃卡片包裹
 */
import React from 'react';
import { Layout, Typography } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import LoanCalculatorView from '../components/LoanCalculatorView';
import { Navbar } from '../components';

const { Title, Text } = Typography;
const { Content } = Layout;

const Calculator: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="金融测算一体化" showBack onBack={() => navigate('/')} />
      <Content style={{ padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-card3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>
              <CalculatorOutlined />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: 'var(--color-ink)' }}>金融测算一体化</Title>
              <Text type="secondary">首付、月供、总利息实时计算，支持多种贷款方案</Text>
            </div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: 24 }}>
          <LoanCalculatorView />
        </div>
      </Content>
    </Layout>
  );
};

export default Calculator;
