/**
 * PlanPage — 个性化置业方案生成
 *
 * 功能：
 *   1. 表单收集用户偏好（区域、预算、户型、首付、贷款年限等）
 *   2. 提交后台 /chat/plan/generate 生成结构化方案
 *   3. 可视化展示推荐楼盘、预算分析、相关政策
 *   4. 支持打印/导出 PDF
 *
 * 设计遵循项目 CSS 变量系统，无 emoji，纯 SVG 图标。
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Card, Typography, Button, Form, Select, InputNumber,
  Slider, Switch, Steps, Row, Col, Space, Tag, Table, Divider,
  Progress, App, Spin, Empty,
} from 'antd';
import {
  HomeOutlined, DollarOutlined, EnvironmentOutlined,
  BankOutlined, FileTextOutlined, PrinterOutlined,
  DownloadOutlined, StarOutlined, CheckCircleOutlined,
  ThunderboltOutlined, CompassOutlined, ApartmentOutlined,
  RobotOutlined, BulbOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { chatApi } from '../services/api';
import { Navbar } from '../components';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

/* ── 类型 ── */
interface PlanReport {
  title: string;
  generated_at: string;
  userNeeds: string;
  recommendedProperties: Array<{
    id: number;
    name: string;
    district: string;
    price_range: string;
    area_range: string;
    pros: string[];
    cons: string[];
  }>;
  budgetAdvice: string;
  overallAdvice: string;
  policies: Array<{ title: string; content: string }>;
}

/* ── 配色 ── */
const C = {
  primary: '#6366f1',
  primaryLight: 'rgba(99,102,241,0.10)',
  accent: '#0F766E',
  accentLight: 'rgba(15,118,110,0.10)',
  surface: '#ffffff',
  bg: '#f5f7fa',
  ink: '#1e293b',
  inkSecondary: '#64748b',
  inkMuted: '#94a3b8',
  border: '#e2e8f0',
  success: '#10b981',
  warning: '#f59e0b',
};

const sectionCard: React.CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-sm)',
};

const gradientPrimary = 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)';
const gradientAccent = 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)';
const gradientWarm = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

const PlanPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [step, setStep] = useState(0); // 0=填写, 1=生成中, 2=结果
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PlanReport | null>(null);
  const [progress, setProgress] = useState(0);

  /* ── 进度条模拟 ── */
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setProgress(p => (p >= 90 ? 90 : p + (90 - p) * 0.15));
    }, 400);
    return () => clearInterval(t);
  }, [loading]);

  /* ── 提交 ── */
  const handleSubmit = async (values: any) => {
    setLoading(true);
    setStep(1);
    setProgress(0);
    try {
      const res: any = await chatApi.generatePlan({
        district: values.district,
        max_price: values.max_price,
        bedrooms: values.bedrooms,
        down_payment_ratio: values.down_payment_ratio ?? 0.3,
        loan_term: values.loan_term ?? 30,
        has_provident_fund: values.has_provident_fund ?? false,
        is_second_home: values.is_second_home ?? false,
        need_metro: values.need_metro ?? false,
        need_school: values.need_school ?? false,
      });
      if (res.success && res.report) {
        setReport(res.report as PlanReport);
        setProgress(100);
        setTimeout(() => setStep(2), 300);
      } else {
        message.error(res.error || '生成方案失败');
        setStep(0);
      }
    } catch {
      message.error('网络错误，请稍后重试');
      setStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  /* ════════════════════════════════════════════════════════════
     步骤 0 · 需求表单
     ════════════════════════════════════════════════════════════ */
  const renderForm = () => (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: gradientPrimary,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, boxShadow: '0 12px 32px rgba(99,102,241,0.25)',
        }}>
          <BulbOutlined style={{ fontSize: 32, color: '#fff' }} />
        </div>
        <Title level={3} style={{ margin: '0 0 6px', color: C.ink }}>
          个性化置业方案
        </Title>
        <Text style={{ color: C.inkSecondary, fontSize: 15 }}>
          填写您的购房需求，AI 为您定制专属方案
        </Text>
      </div>

      {/* 表单卡片 */}
      <Card style={{ ...sectionCard, marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            bedrooms: 3,
            down_payment_ratio: 0.3,
            loan_term: 30,
            has_provident_fund: false,
            is_second_home: false,
            need_metro: false,
            need_school: false,
          }}
        >
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="district"
                label={<><EnvironmentOutlined style={{ marginRight: 4 }} />意向区域</>}
              >
                <Select
                  placeholder="选择区域（可选）"
                  allowClear
                  showSearch
                  size="large"
                  options={[
                    '西湖区', '上城区', '拱墅区', '滨江区', '余杭区',
                    '萧山区', '临平区', '钱塘区', '富阳区', '临安区',
                  ].map(d => ({ label: d, value: d }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="max_price"
                label={<><DollarOutlined style={{ marginRight: 4 }} />预算上限（万元）</>}
                rules={[{ required: true, message: '请输入预算' }]}
              >
                <InputNumber
                  min={50} max={5000} step={10}
                  placeholder="如：500"
                  size="large"
                  style={{ width: '100%' }}
                  addonAfter="万"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="bedrooms"
                label={<><HomeOutlined style={{ marginRight: 4 }} />户型需求</>}
              >
                <Select
                  size="large"
                  options={[1, 2, 3, 4, 5].map(n => ({ label: `${n} 室`, value: n }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="down_payment_ratio"
                label={<><BankOutlined style={{ marginRight: 4 }} />首付比例</>}
              >
                <Slider
                  min={0.2} max={0.7} step={0.05}
                  marks={{ 0.2: '20%', 0.3: '30%', 0.5: '50%', 0.7: '70%' }}
                  tooltip={{ formatter: v => `${(Number(v) * 100).toFixed(0)}%` }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="loan_term"
                label="贷款年限"
              >
                <Select
                  size="large"
                  options={[10, 15, 20, 25, 30].map(y => ({ label: `${y} 年`, value: y }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="has_provident_fund" label="公积金" valuePropName="checked">
                    <Switch checkedChildren="有" unCheckedChildren="无" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="is_second_home" label="二套房" valuePropName="checked">
                    <Switch checkedChildren="是" unCheckedChildren="否" />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="need_metro" label="近地铁" valuePropName="checked">
                <Switch checkedChildren="需要" unCheckedChildren="不限" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="need_school" label="学区需求" valuePropName="checked">
                <Switch checkedChildren="需要" unCheckedChildren="不限" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 24px' }} />

          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<ThunderboltOutlined />}
              style={{
                height: 52, padding: '0 48px', fontSize: 16, fontWeight: 600,
                borderRadius: 14, background: gradientPrimary, border: 'none',
                boxShadow: '0 8px 24px rgba(99,102,241,0.30)',
              }}
            >
              立即生成方案
            </Button>
          </div>
        </Form>
      </Card>

      {/* 特性亮点 */}
      <Row gutter={[16, 16]}>
        {[
          { icon: <RobotOutlined />, title: 'AI 驱动', desc: '智能匹配楼盘 + 金融测算' },
          { icon: <CompassOutlined />, title: '多维分析', desc: '价格、学区、地铁综合评估' },
          { icon: <SafetyCertificateOutlined />, title: '政策同步', desc: '最新购房政策一网打尽' },
        ].map((item, i) => (
          <Col xs={24} sm={8} key={i}>
            <Card
              style={{ textAlign: 'center', borderRadius: 14, border: '1px solid var(--color-border)' }}
              styles={{ body: { padding: '20px 16px' } }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: C.primaryLight, color: C.primary,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, marginBottom: 10,
              }}>
                {item.icon}
              </div>
              <Text strong style={{ display: 'block', color: C.ink, marginBottom: 4 }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 12, color: C.inkMuted }}>{item.desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     步骤 1 · 生成中
     ════════════════════════════════════════════════════════════ */
  const renderGenerating = () => (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
      <div style={{
        width: 88, height: 88, borderRadius: 24,
        background: gradientPrimary,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28, animation: 'pulse-glow 2s ease-in-out infinite',
        boxShadow: '0 16px 40px rgba(99,102,241,0.30)',
      }}>
        <RobotOutlined style={{ fontSize: 40, color: '#fff' }} />
      </div>
      <Title level={3} style={{ color: C.ink, marginBottom: 8 }}>
        正在生成您的专属方案...
      </Title>
      <Text style={{ color: C.inkSecondary, display: 'block', marginBottom: 24 }}>
        AI 正在分析您的需求、匹配楼盘并测算预算
      </Text>
      <Progress
        percent={Math.round(progress)}
        status="active"
        strokeColor={{ from: '#6366f1', to: '#0F766E' }}
        style={{ maxWidth: 320, margin: '0 auto' }}
      />
      <div style={{ marginTop: 24, color: C.inkMuted, fontSize: 13 }}>
        {progress < 30 && '正在提取需求特征...'}
        {progress >= 30 && progress < 55 && '正在匹配楼盘数据库...'}
        {progress >= 55 && progress < 80 && '正在进行金融测算...'}
        {progress >= 80 && '正在整理方案文档...'}
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     步骤 2 · 方案展示
     ════════════════════════════════════════════════════════════ */
  const renderResult = () => {
    if (!report) return null;
    return (
      <div className="plan-result" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* 顶部操作栏 */}
        <Card style={{
          ...sectionCard, marginBottom: 24,
          background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: gradientPrimary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <StarOutlined style={{ fontSize: 22, color: '#fff' }} />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, color: C.ink }}>{report.title}</Title>
                <Text style={{ fontSize: 12, color: C.inkMuted }}>
                  生成时间：{new Date(report.generated_at).toLocaleString('zh-CN')}
                </Text>
              </div>
            </Space>
            <Space>
              <Button
                icon={<PrinterOutlined />}
                onClick={handlePrint}
                size="large"
                style={{ borderRadius: 10 }}
              >
                打印
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handlePrint}
                size="large"
                style={{
                  borderRadius: 10, background: gradientPrimary, border: 'none',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                }}
              >
                导出 PDF
              </Button>
              <Button
                onClick={() => { setStep(0); setReport(null); }}
                style={{ borderRadius: 10 }}
              >
                重新生成
              </Button>
            </Space>
          </div>
        </Card>

        {/* KPI 卡片行 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            {
              icon: <HomeOutlined />,
              label: '匹配楼盘',
              value: report.recommendedProperties.length,
              suffix: '个',
              gradient: gradientPrimary,
            },
            {
              icon: <BankOutlined />,
              label: '覆盖区域',
              value: new Set(report.recommendedProperties.map((p: any) => p.district)).size,
              suffix: '个',
              gradient: gradientAccent,
            },
            {
              icon: <FileTextOutlined />,
              label: '相关政策',
              value: report.policies?.length ?? 0,
              suffix: '条',
              gradient: gradientWarm,
            },
          ].map((kpi, i) => (
            <Col xs={24} sm={8} key={i}>
              <Card style={{
                ...sectionCard, textAlign: 'center',
                borderTop: `3px solid ${i === 0 ? C.primary : i === 1 ? C.accent : C.warning}`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: kpi.gradient,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}>
                  <span style={{ color: '#fff', fontSize: 18 }}>{kpi.icon}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>
                  {kpi.value}<span style={{ fontSize: 16, fontWeight: 400, color: C.inkMuted }}>{kpi.suffix}</span>
                </div>
                <Text style={{ fontSize: 13, color: C.inkSecondary }}>{kpi.label}</Text>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 需求摘要 */}
        <Card
          style={{ ...sectionCard, marginBottom: 24 }}
          title={<Space><CheckCircleOutlined style={{ color: C.primary }} />您的需求</Space>}
        >
          <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0, fontSize: 15, color: C.inkSecondary }}>
            {report.userNeeds}
          </Paragraph>
        </Card>

        {/* 推荐楼盘 */}
        {report.recommendedProperties.length > 0 && (
          <Card
            style={{ ...sectionCard, marginBottom: 24 }}
            title={<Space><ApartmentOutlined style={{ color: C.primary }} />推荐楼盘清单</Space>}
          >
            <Table
              dataSource={report.recommendedProperties.map((p, i) => ({ ...p, key: p.id, rank: i + 1 }))}
              columns={[
                {
                  title: '#', dataIndex: 'rank', key: 'rank', width: 48,
                  render: (v: number) => (
                    <Tag color={v === 1 ? 'gold' : v === 2 ? 'default' : 'default'} style={{ fontWeight: 700 }}>
                      {v}
                    </Tag>
                  ),
                },
                {
                  title: '楼盘名称', dataIndex: 'name', key: 'name',
                  render: (t: string) => <Text strong>{t}</Text>,
                },
                { title: '区域', dataIndex: 'district', key: 'district', width: 90 },
                {
                  title: '价格', dataIndex: 'price_range', key: 'price_range', width: 130,
                  render: (t: string) => <Text style={{ color: '#ef4444', fontWeight: 600 }}>{t}</Text>,
                },
                { title: '面积', dataIndex: 'area_range', key: 'area_range', width: 100 },
                {
                  title: '亮点', key: 'pros',
                  render: (_: any, r: any) => r.pros?.map((p: string, i: number) => (
                    <Tag key={i} color="green" style={{ margin: 1 }}>{p}</Tag>
                  )),
                },
                {
                  title: '注意', key: 'cons',
                  render: (_: any, r: any) => r.cons?.length
                    ? r.cons.map((c: string, i: number) => (
                        <Tag key={i} color="red" style={{ margin: 1 }}>{c}</Tag>
                      ))
                    : <Text style={{ color: C.inkMuted }}>—</Text>,
                },
              ]}
              pagination={false}
              size="middle"
            />
          </Card>
        )}

        {/* 预算建议 + 政策 双栏 */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          {report.budgetAdvice && (
            <Col xs={24} md={12}>
              <Card
                style={{ ...sectionCard, height: '100%', borderLeft: `4px solid ${C.accent}` }}
                title={<Space><DollarOutlined style={{ color: C.accent }} />预算分析</Space>}
              >
                <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0, color: C.inkSecondary }}>
                  {report.budgetAdvice}
                </Paragraph>
              </Card>
            </Col>
          )}
          {report.policies && report.policies.length > 0 && (
            <Col xs={24} md={12}>
              <Card
                style={{ ...sectionCard, height: '100%', borderLeft: `4px solid ${C.primary}` }}
                title={<Space><SafetyCertificateOutlined style={{ color: C.primary }} />相关政策</Space>}
              >
                {report.policies.map((p, i) => (
                  <div key={i} style={{ marginBottom: i < report.policies.length - 1 ? 16 : 0 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4, color: C.ink }}>
                      {p.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: C.inkMuted, lineHeight: 1.6 }}>
                      {p.content}
                    </Text>
                    {i < report.policies.length - 1 && <Divider style={{ margin: '12px 0' }} />}
                  </div>
                ))}
              </Card>
            </Col>
          )}
        </Row>

        {/* 综合建议 */}
        {report.overallAdvice && (
          <Card
            style={{ ...sectionCard, borderLeft: `4px solid ${C.warning}` }}
            title={<Space><BulbOutlined style={{ color: C.warning }} />综合建议</Space>}
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, margin: 0, fontSize: 15, color: C.inkSecondary }}>
              {report.overallAdvice}
            </Paragraph>
          </Card>
        )}

        {/* 打印样式 */}
        <style>{`
          @media print {
            body { background: #fff !important; }
            .plan-result button { display: none !important; }
            .plan-result .ant-card { box-shadow: none !important; border: 1px solid #eee !important; }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 16px 40px rgba(99,102,241,0.30); }
            50%      { box-shadow: 0 20px 56px rgba(99,102,241,0.45); }
          }
        `}</style>
      </div>
    );
  };

  return (
    <Layout style={{ minHeight: '100dvh', background: C.bg }}>
      <Navbar title="个性化置业方案" showBack onBack={() => navigate('/')} />
      <Content style={{ padding: '24px' }}>
        {step === 0 && renderForm()}
        {step === 1 && renderGenerating()}
        {step === 2 && renderResult()}
      </Content>
    </Layout>
  );
};

export default PlanPage;
