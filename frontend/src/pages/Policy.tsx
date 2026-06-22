/**
 * Policy page — 政策科普问答
 *
 * 优化要点：
 *   * 移除所有 emoji，替换为向量图标
 *   * CSS 变量驱动所有颜色，暗色模式自动适配
 *   * 毛玻璃卡片 + 统一圆角
 *   * 使用 Navbar 组件保持一致导航
 *   * 触摸友好的分类筛选按钮
 */
import React, { useEffect, useState } from 'react';
import { Layout, Typography, Input, Button, Card, Row, Col, Space, Tag, Collapse, App } from 'antd';
import {
  QuestionCircleOutlined,
  SearchOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { chatApi } from '../services/api';
import { Navbar } from '../components';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

interface Policy {
  id: number;
  title: string;
  policy_type?: string;
  content: string;
  source?: string;
  effective_date?: string;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category?: string;
  tags?: Record<string, unknown>;
}

const Policy: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [policiesRes, faqsRes] = await Promise.all([chatApi.getPolicies(), chatApi.getFaqs()]);
        setPolicies(Array.isArray(policiesRes) ? policiesRes : []);
        setFaqs(Array.isArray(faqsRes) ? faqsRes : []);
      } catch { message.error('获取政策数据失败'); }
      finally { setDataLoading(false); }
    };
    fetchData();
  }, []);

  const categoryNames: Record<string, string> = {
    '限购': '限购政策', '贷款': '贷款政策', '税费': '税费政策',
    '落户': '落户政策', '公积金': '公积金政策', 'default': '其他政策',
  };

  const getCategoryLabel = (policy: Policy): string => {
    if (policy.policy_type) return policy.policy_type;
    if (policy.title.includes('限购')) return '限购';
    if (policy.title.includes('贷款') || policy.title.includes('利率')) return '贷款';
    if (policy.title.includes('税费') || policy.title.includes('契税')) return '税费';
    if (policy.title.includes('公积')) return '公积金';
    return 'default';
  };

  const filteredPolicies = policies.filter(policy => {
    const matchSearch = policy.title.includes(searchText) || policy.content.includes(searchText);
    const category = getCategoryLabel(policy);
    const matchCategory = !activeCategory || category === activeCategory;
    return matchSearch && matchCategory;
  });

  const categories = Array.from(new Set(policies.map(getCategoryLabel)));

  const handleGetExplanation = async () => {
    if (!question.trim()) { message.warning('请输入您的问题'); return; }
    setLoading(true);
    try {
      const result = await chatApi.explainPolicy(question);
      if (result.success) { setExplanation(result.explanation); message.success('AI解读完成'); }
      else message.error(result.error || '解读失败，请稍后重试');
    } catch { message.error('解读失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="政策科普问答" showBack onBack={() => navigate('/')} />

      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* AI Policy Q&A */}
          <Card style={{ ...cardStyle, marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>
                  <RobotOutlined />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0, color: 'var(--color-ink)' }}>AI政策解读</Title>
                  <Text type="secondary">有问题问AI，专业解读房产政策</Text>
                </div>
              </div>
              <TextArea
                placeholder="例如：公积金贷款最多能贷多少？或者：我是外地人，能在杭州买房吗？"
                value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
                style={{ borderRadius: 'var(--radius-md)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" size="large" icon={<RobotOutlined />}
                  onClick={handleGetExplanation} loading={loading}
                  style={{ borderRadius: 'var(--radius-md)', height: 44, padding: '0 32px' }}>
                  让AI解读
                </Button>
              </div>
              {explanation && (
                <Card style={{ background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--color-ink-secondary)' }}>
                    {explanation}
                  </Paragraph>
                </Card>
              )}
            </Space>
          </Card>

          {/* Search & Categories */}
          <Card style={{ ...cardStyle, marginBottom: 24 }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Input placeholder="搜索政策关键词" prefix={<SearchOutlined />}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)} size="large"
                  style={{ borderRadius: 'var(--radius-md)' }} />
              </Col>
              <Col xs={24} md={12}>
                <Space wrap>
                  <Button type={!activeCategory ? 'primary' : 'default'} onClick={() => setActiveCategory('')} style={{ minHeight: 40 }}>
                    全部
                  </Button>
                  {categories.map(cat => (
                    <Button key={cat} type={activeCategory === cat ? 'primary' : 'default'} onClick={() => setActiveCategory(cat)} style={{ minHeight: 40 }}>
                      {categoryNames[cat] || cat}
                    </Button>
                  ))}
                </Space>
              </Col>
            </Row>
          </Card>

          <Row gutter={[24, 24]}>
            {/* Policy List */}
            <Col xs={24} md={16}>
              <Card loading={dataLoading} style={cardStyle}
                title={<Space><BookOutlined style={{ color: '#3b82f6' }} />政策列表（{filteredPolicies.length} 条）</Space>}>
                {filteredPolicies.length > 0 ? (
                  <Collapse accordion>
                    {filteredPolicies.map(policy => (
                      <Panel header={
                        <Space>
                          <Tag color="blue">{getCategoryLabel(policy)}</Tag>
                          <Text strong style={{ color: 'var(--color-ink)' }}>{policy.title}</Text>
                        </Space>
                      } key={policy.id}>
                        <Paragraph style={{ whiteSpace: 'pre-wrap', color: 'var(--color-ink-secondary)' }}>{policy.content}</Paragraph>
                        {policy.source && <Text type="secondary" style={{ fontSize: 12 }}>来源：{policy.source}</Text>}
                        {policy.effective_date && <Text type="secondary" style={{ fontSize: 12 }}> | 生效日期：{policy.effective_date}</Text>}
                        <br />
                        <Button type="primary" ghost style={{ marginTop: 16, borderRadius: 'var(--radius-md)' }}
                          onClick={() => navigate('/chat')}>咨询AI顾问，了解更多</Button>
                      </Panel>
                    ))}
                  </Collapse>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-ink-muted)' }}>暂无匹配的政策数据</div>
                )}
              </Card>
            </Col>

            {/* Sidebar: FAQ + Quick Links */}
            <Col xs={24} md={8}>
              {faqs.length > 0 && (
                <Card style={{ ...cardStyle, marginBottom: 24 }}
                  title={<Space><QuestionCircleOutlined style={{ color: '#3b82f6' }} />常见问题</Space>}>
                  <Collapse accordion>
                    {faqs.map(faq => (
                      <Panel header={
                        <Space>
                          {faq.category && <Tag>{faq.category}</Tag>}
                          <Text strong style={{ color: 'var(--color-ink)' }}>{faq.question}</Text>
                        </Space>
                      } key={faq.id}>
                        <Paragraph style={{ whiteSpace: 'pre-wrap', color: 'var(--color-ink-secondary)' }}>{faq.answer}</Paragraph>
                      </Panel>
                    ))}
                  </Collapse>
                </Card>
              )}

              <Card style={cardStyle}
                title={<Space><SafetyCertificateOutlined style={{ color: '#3b82f6' }} />快捷入口</Space>}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {[
                    { icon: <BankOutlined />, title: '房贷计算器', desc: '月供、首付、利息一键计算', path: '/calculator', color: '#3b82f6' },
                    { icon: <SearchOutlined />, title: '楼盘对比', desc: '多维度对比，选择更清楚', path: '/properties/compare', color: '#10b981' },
                    { icon: <BookOutlined />, title: '找房源', desc: '发现合适您的楼盘', path: '/properties', color: '#8b5cf6' },
                  ].map(item => (
                    <Card key={item.path} size="small" hoverable
                      style={{ cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                      onClick={() => navigate(item.path)}>
                      <Space>
                        <span style={{ fontSize: 20, color: item.color, display: 'flex' }}>{item.icon}</span>
                        <div>
                          <Text strong style={{ color: 'var(--color-ink)' }}>{item.title}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                        </div>
                      </Space>
                    </Card>
                  ))}
                  <Button type="primary" size="large" block
                    style={{ marginTop: 8, height: 48, fontSize: 16, borderRadius: 'var(--radius-md)' }}
                    onClick={() => navigate('/chat')}>立即咨询AI顾问</Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
};

export default Policy;
