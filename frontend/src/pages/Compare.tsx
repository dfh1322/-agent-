/**
 * Compare page — 多楼盘智能对比
 *
 * 优化要点：
 *   * 移除所有 emoji，替换为向量图标
 *   * CSS 变量驱动全部颜色
 *   * 毛玻璃卡片，统一 16px 圆角
 *   * 暗色模式原生支持
 *   * 触摸友好的选择控件
 */
import React, { useState, useEffect } from 'react';
import { Layout, Typography, Button, Card, Row, Col, Space, Tag, App, Select } from 'antd';
import {
  RobotOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '../services/api';
import { Navbar, PropertyCompareTable } from '../components';
import type { AdminProperty } from '../services/api';

const { Title, Text, Paragraph } = Typography;

const Compare: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [allProperties, setAllProperties] = useState<AdminProperty[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => { loadProperties(); }, []);

  const loadProperties = async () => {
    try {
      const result = await chatApi.getProperties();
      if (Array.isArray(result)) {
        setAllProperties(result);
        if (result.length >= 3) setSelectedIds(result.slice(0, 3).map(p => p.id!));
      }
    } catch (error) { console.error('加载楼盘失败:', error); }
  };

  const selectedProperties = allProperties.filter(p => selectedIds.includes(p.id!));

  const handleAnalysis = async () => {
    if (selectedIds.length < 2) { message.warning('请至少选择 2 个楼盘进行对比'); return; }
    if (selectedIds.length > 5) { message.warning('最多选择 5 个楼盘进行对比'); return; }
    setLoading(true);
    try {
      const result = await chatApi.compareProperties(selectedIds);
      if (result.success) { setAnalysis(result.analysis); message.success('AI分析完成'); }
      else message.error(result.error || '分析失败，请稍后重试');
    } catch { message.error('分析失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const compareColumns = [
    { title: '楼盘名称', dataIndex: 'name', key: 'name' },
    { title: '区域', dataIndex: 'district', key: 'district' },
    { title: '总价(万)', dataIndex: 'price', key: 'price', numeric: true, smallerIsBetter: true },
    { title: '单价(元/㎡)', dataIndex: 'pricePerSq', key: 'pricePerSq', numeric: true, smallerIsBetter: true },
    { title: '面积(㎡)', dataIndex: 'area', key: 'area' },
    { title: '绿化率(%)', dataIndex: 'green', key: 'green', numeric: true, smallerIsBetter: false },
    { title: '地铁距离(m)', dataIndex: 'metro', key: 'metro', numeric: true, smallerIsBetter: true },
    { title: '装修', dataIndex: 'decoration', key: 'decoration' },
    { title: '学区', dataIndex: 'school', key: 'school' },
  ];

  const compareData = selectedProperties.map(prop => ({
    key: prop.id,
    name: prop.name,
    district: prop.district,
    price: prop.total_price_min && prop.total_price_max ? `${prop.total_price_min}-${prop.total_price_max}` : '-',
    pricePerSq: prop.price_per_sqm ? `${prop.price_per_sqm}` : '-',
    area: prop.area_min && prop.area_max ? `${prop.area_min}-${prop.area_max}` : '-',
    green: prop.green_rate ? `${prop.green_rate}` : '-',
    metro: prop.metro_distance ? `${prop.metro_distance}` : '-',
    decoration: prop.decoration_status || '-',
    school: prop.school_district || '-',
  }));

  const sectionCard: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: 24,
  };

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="多楼盘智能对比" showBack onBack={() => navigate('/')} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
        {/* Selection */}
        <Card style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <SwapOutlined style={{ fontSize: 20, color: '#3b82f6' }} />
            <Title level={5} style={{ margin: 0, color: 'var(--color-ink)' }}>选择要对比的楼盘（2-5个）</Title>
          </div>
          <Space wrap style={{ width: '100%' }}>
            <Select mode="multiple" value={selectedIds} onChange={setSelectedIds}
              placeholder="点击选择楼盘" style={{ minWidth: 300 }}
              options={allProperties.map(p => ({ label: `${p.name} (${p.district})`, value: p.id! }))} />
            <Button type="primary" icon={<RobotOutlined />} onClick={handleAnalysis} loading={loading}
              style={{ borderRadius: 'var(--radius-md)', minHeight: 44 }}>
              获取AI分析
            </Button>
          </Space>
        </Card>

        {/* Property Cards */}
        {selectedProperties.length > 0 && (
          <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
            {selectedProperties.map(prop => (
              <Col xs={24} sm={12} lg={8} key={prop.id}>
                <Card hoverable className="glass-card" style={{ textAlign: 'center', border: '1px solid var(--color-border)' }}
                  cover={
                    <div style={{ height: 120, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#fff' }}>
                      <EnvironmentOutlined />
                    </div>
                  }>
                  <Title level={5} style={{ margin: '8px 0', color: 'var(--color-ink)' }}>{prop.name}</Title>
                  <Space wrap>
                    <Tag color="blue">{prop.district}</Tag>
                    {prop.school_district && <Tag color="green">学区</Tag>}
                    {prop.metro_distance && prop.metro_distance <= 1500 && <Tag color="cyan">近地铁</Tag>}
                  </Space>
                  <div style={{ marginTop: 8 }}>
                    <Text strong style={{ color: '#ef4444', fontSize: 18 }}>
                      {prop.total_price_min && prop.total_price_max ? `${prop.total_price_min}-${prop.total_price_max}万` : '价格面议'}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {/* Comparison Table */}
        {selectedProperties.length >= 2 && (
          <Card style={sectionCard}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <SwapOutlined style={{ fontSize: 20, color: '#3b82f6', marginRight: 8 }} />
              <Title level={5} style={{ margin: 0, display: 'inline', color: 'var(--color-ink)' }}>详细对比</Title>
            </div>
            <PropertyCompareTable properties={compareData} columns={compareColumns} aiRecommendation={analysis} />
          </Card>
        )}

        {/* AI Analysis */}
        {analysis && (
          <Card style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-muted)',
          }}>
            <Space style={{ width: '100%', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>
                <RobotOutlined />
              </div>
              <div>
                <Title level={5} style={{ margin: 0, color: 'var(--color-ink)' }}>AI智能分析</Title>
                <Text type="secondary">基于对比数据的深度分析</Text>
              </div>
            </Space>
            <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.8, color: 'var(--color-ink-secondary)' }}>
              {analysis}
            </Paragraph>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Compare;
