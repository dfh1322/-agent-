/**
 * Policy page — 政策科普问答（内容型重设计）
 *
 * 1. 顶部统计横幅 — 政策数 / 分类数 / FAQ 数
 * 2. 吸顶搜索栏 — 搜索框 + 分类标签，滚动时固定
 * 3. 政策卡片列表 — 独立卡片替代折叠面板，分类色标 + 正文预览
 * 4. FAQ 侧栏 — 分类图标 + 折叠面板 + CTA
 * 5. AI 解读区 — 增大输入框 + 快捷问题标签
 */
import React, { useEffect, useState } from 'react';
import { Layout, Typography, Input, Button, Card, Row, Col, Space, Tag, Collapse, App } from 'antd';
import {
  QuestionCircleOutlined,
  SearchOutlined,
  BookOutlined,
  RobotOutlined,
  AppstoreOutlined,
  MessageOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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

const PRESET_QUESTIONS = [
  { label: '公积金贷款额度', icon: <QuestionCircleOutlined /> },
  { label: '杭州限购政策', icon: <QuestionCircleOutlined /> },
  { label: '二套房首付比例', icon: <QuestionCircleOutlined /> },
];

const CATEGORY_COLORS: Record<string, string> = {
  '限购': '#f59e0b',
  '贷款': '#3b82f6',
  '税费': '#10b981',
  '落户': '#8b5cf6',
  '公积金': '#06b6d4',
  'default': '#94a3b8',
};

const CARD_PREVIEW_LEN = 100;

const PolicyCard: React.FC<{ policy: Policy; category: string; navigate: (path: string) => void }> = ({ policy, category, navigate }) => {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  const needsTruncation = policy.content.length > CARD_PREVIEW_LEN;

  return (
    <Card
      hoverable
      onClick={() => setExpanded(v => !v)}
      style={{
        marginBottom: 16,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'box-shadow var(--motion-normal) var(--motion-easing)',
        overflow: 'hidden',
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex' }}>
        {/* color bar */}
        <div style={{ width: 4, flexShrink: 0, background: color, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }} />
        <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
          <Space style={{ marginBottom: 8 }}>
            <Tag color={color} style={{ borderRadius: 'var(--radius-sm)', margin: 0 }}>{category}</Tag>
            <Text strong style={{ color: 'var(--color-ink)', fontSize: 15 }}>{policy.title}</Text>
            {needsTruncation && (
              <span style={{ color: 'var(--color-ink-muted)', fontSize: 13, marginLeft: 4 }}>
                {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
            )}
          </Space>
          <Paragraph
            style={{
              whiteSpace: 'pre-wrap',
              color: 'var(--color-ink-secondary)',
              margin: 0,
              lineHeight: 1.7,
              maxHeight: expanded ? undefined : 48,
              overflow: 'hidden',
            }}
          >
            {expanded || !needsTruncation ? policy.content : policy.content.slice(0, CARD_PREVIEW_LEN) + '…'}
          </Paragraph>
          {expanded && needsTruncation && (
            <Button type="primary" ghost size="small"
              style={{ marginTop: 12, borderRadius: 'var(--radius-md)' }}
              onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}>
              咨询AI顾问，了解更多
            </Button>
          )}
          {(policy.source || policy.effective_date) && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-ink-muted)', display: 'flex', gap: 12 }}>
              {policy.source && <span>来源：{policy.source}</span>}
              {policy.effective_date && <span>生效：{policy.effective_date}</span>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const Policy: React.FC = () => {
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
        setPolicies((Array.isArray(policiesRes) ? policiesRes : []) as any[]);
        setFaqs((Array.isArray(faqsRes) ? faqsRes : []) as any[]);
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
      if ((result as any).success) { setExplanation((result as any).explanation); message.success('AI解读完成'); }
      else message.error((result as any).error || '解读失败，请稍后重试');
    } catch { message.error('解读失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  };

  const statCards = [
    { label: '收录政策', value: policies.length, icon: <BookOutlined />, color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' },
    { label: '覆盖分类', value: categories.length, icon: <AppstoreOutlined />, color: '#8b5cf6', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' },
    { label: '常见问题', value: faqs.length, icon: <MessageOutlined />, color: '#10b981', bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' },
  ];

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="政策科普问答" showBack onBack={() => navigate('/')} />

      <Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* ── Stat Banner ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {statCards.map(s => (
              <Col xs={24} sm={8} key={s.label}>
                <Card style={{
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  boxShadow: 'var(--shadow-sm)',
                }} styles={{ body: { padding: '20px 24px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 'var(--radius-md)',
                      background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color,
                    }}>
                      {s.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-ink)', lineHeight: 1.2 }}>
                        {dataLoading ? '—' : s.value}
                      </div>
                      <Text type="secondary" style={{ fontSize: 13 }}>{s.label}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* ── AI 解读区 ── */}
          <Card style={{ ...cardStyle, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff',
              }}>
                <RobotOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: '0 0 4px', color: 'var(--color-ink)' }}>AI政策解读</Title>
                <Text type="secondary">有问题直接问，专业解读房产政策</Text>
              </div>
            </div>

            {/* 快捷问题标签 */}
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_QUESTIONS.map(pq => (
                <Tag
                  key={pq.label}
                  style={{
                    cursor: 'pointer', borderRadius: 'var(--radius-pill)', padding: '4px 16px',
                    fontSize: 13, lineHeight: '24px', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-muted)', color: 'var(--color-ink-secondary)',
                    transition: 'all var(--motion-fast)',
                  }}
                  onClick={() => setQuestion(pq.label)}
                >
                  {pq.icon} {pq.label}
                </Tag>
              ))}
            </div>

            <TextArea
              placeholder="请输入您想了解的政策问题，例如：公积金贷款最多能贷多少？"
              value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button type="primary" size="large" icon={<RobotOutlined />}
                onClick={handleGetExplanation} loading={loading}
                style={{ borderRadius: 'var(--radius-md)', height: 44, padding: '0 32px' }}>
                让AI解读
              </Button>
            </div>

            {explanation && (
              <Card style={{
                marginTop: 16, background: 'var(--color-surface-muted)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <RobotOutlined style={{ color: 'var(--color-primary)', fontSize: 16, marginTop: 2 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>AI 解读结果</Text>
                </div>
                <Paragraph style={{
                  whiteSpace: 'pre-wrap', margin: 0, fontSize: 15, lineHeight: 1.8,
                  color: 'var(--color-ink-secondary)',
                }}>
                  {explanation}
                </Paragraph>
              </Card>
            )}
            {explanation && explanation.includes('网络查询') && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                以上内容来自网络搜索，仅供参考，请以官方发布为准。
              </Text>
            )}
          </Card>

          {/* ── 吸顶搜索栏 ── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: 'var(--color-bg)', padding: '4px 0 16px',
          }}>
            <Card style={{ ...cardStyle, marginBottom: 0 }}>
              <Row gutter={[16, 12]} align="middle">
                <Col xs={24} md={10}>
                  <Input
                    placeholder="搜索政策关键词"
                    prefix={<SearchOutlined style={{ color: 'var(--color-ink-muted)' }} />}
                    value={searchText} onChange={(e) => setSearchText(e.target.value)} size="large"
                    style={{ borderRadius: 'var(--radius-md)' }}
                    allowClear
                  />
                </Col>
                <Col xs={24} md={14}>
                  <Space wrap size={[8, 8]}>
                    <Tag
                      style={{
                        cursor: 'pointer', borderRadius: 'var(--radius-pill)', padding: '4px 18px',
                        fontSize: 13, lineHeight: '26px', border: '1px solid var(--color-border)',
                        background: !activeCategory ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                        color: !activeCategory ? '#fff' : 'var(--color-ink-secondary)',
                      }}
                      onClick={() => setActiveCategory('')}
                    >
                      全部
                    </Tag>
                    {categories.map(cat => {
                      const active = activeCategory === cat;
                      const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
                      return (
                        <Tag
                          key={cat}
                          style={{
                            cursor: 'pointer', borderRadius: 'var(--radius-pill)', padding: '4px 18px',
                            fontSize: 13, lineHeight: '26px',
                            border: active ? `1px solid ${color}` : '1px solid var(--color-border)',
                            background: active ? color : 'var(--color-surface-muted)',
                            color: active ? '#fff' : 'var(--color-ink-secondary)',
                          }}
                          onClick={() => setActiveCategory(active ? '' : cat)}
                        >
                          {categoryNames[cat] || cat}
                        </Tag>
                      );
                    })}
                  </Space>
                </Col>
              </Row>
            </Card>
          </div>

          {/* ── 结果区域 ── */}
          <Row gutter={[24, 24]}>
            <Col xs={24} md={16}>
              <Card loading={dataLoading} style={cardStyle}
                title={
                  <Space>
                    <BookOutlined style={{ color: '#3b82f6' }} />
                    <span style={{ color: 'var(--color-ink)' }}>政策列表</span>
                    <Tag style={{ borderRadius: 'var(--radius-pill)' }}>{filteredPolicies.length} 条</Tag>
                  </Space>
                }>
                {filteredPolicies.length > 0 ? (
                  <div>
                    {filteredPolicies.map(policy => (
                      <PolicyCard
                        key={policy.id}
                        policy={policy}
                        category={getCategoryLabel(policy)}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--color-ink-muted)' }}>
                    <SearchOutlined style={{ fontSize: 40, marginBottom: 12, display: 'block' }} />
                    <Text type="secondary">暂无匹配的政策数据</Text>
                  </div>
                )}
              </Card>
            </Col>

            {/* Sidebar: FAQ */}
            <Col xs={24} md={8}>
              {faqs.length > 0 && (
                <Card style={cardStyle}
                  title={
                    <Space>
                      <MessageOutlined style={{ color: '#3b82f6' }} />
                      <span style={{ color: 'var(--color-ink)' }}>常见问题</span>
                      <Tag style={{ borderRadius: 'var(--radius-pill)' }}>{faqs.length}</Tag>
                    </Space>
                  }>
                  <Collapse accordion expandIconPosition="end"
                    style={{ background: 'transparent', border: 'none' }}
                  >
                    {faqs.map(faq => {
                      const catColor = (faq.category && CATEGORY_COLORS[faq.category])
                        ? CATEGORY_COLORS[faq.category] : undefined;
                      return (
                        <Panel
                          header={
                            <Text strong style={{ color: 'var(--color-ink)', fontSize: 14 }}>{faq.question}</Text>
                          }
                          key={faq.id}
                          style={{
                            marginBottom: 8, borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                          }}
                        >
                          <Paragraph style={{ whiteSpace: 'pre-wrap', color: 'var(--color-ink-secondary)', margin: 0, lineHeight: 1.7 }}>
                            {faq.answer}
                          </Paragraph>
                        </Panel>
                      );
                    })}
                  </Collapse>
                  <Button type="primary" block icon={<RobotOutlined />}
                    style={{ marginTop: 16, height: 44, fontSize: 15, borderRadius: 'var(--radius-md)' }}
                    onClick={() => navigate('/chat')}>
                    立即咨询AI顾问
                  </Button>
                </Card>
              )}
            </Col>
          </Row>
        </div>
      </Content>
    </Layout>
  );
};

export default Policy;
