/**
 * AdminCompliance - 合规配置 v2
 *
 * 设计要点：
 *   1. 顶部按 action 类型统计的 KPI：拦截 / 替换 / 警告 实时数量；
 *   2. 按 action 分类的 Tabs：一眼看清当前配置分布；
 *   3. 实时"命中预览"：管理员输入一段文本，立即看到哪些敏感词会被命中；
 *   4. 用 BatchImportModal 进行批量导入；
 *   5. 操作列：编辑（inline Modal）、删除。
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Input, Button, Select, Tag, Space, App, Popconfirm, Form,
  Row, Col, Card, Typography, Tabs, Alert, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  ExperimentOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../services/api';
import PermissionControl from '../../components/PermissionControl';
import StatKpiCard from '../../components/StatKpiCard';
import BatchImportModal from '../../components/BatchImportModal';
import EmptyChart from '../../components/EmptyChart';
import DraggableModal from '../../components/DraggableModal';
import { palette, radius, space, text } from '../../theme';

const { Title, Text } = Typography;

interface ComplianceWord {
  word: string;
  action?: string;
  replacement?: string;
  category?: string;
}

const ACTION_META: Record<string, { label: string; color: string; description: string }> = {
  block: {
    label: '拦截',
    color: palette.danger,
    description: '直接拒绝输出，Agent 不会发出此话术',
  },
  replace: {
    label: '替换',
    color: palette.info,
    description: '自动替换为 replacement 内容再输出',
  },
  warn: {
    label: '警告',
    color: palette.warning,
    description: '保留原话但标记高风险，可在审核端复查',
  },
};

const AdminCompliance: React.FC = () => {
  const [words, setWords] = useState<ComplianceWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [actionTab, setActionTab] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<ComplianceWord | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  /**
   * 客户端递增序号 — 不是 React 渲染时的 list-index（antd 已弃用 ``rowKey``
   * 函数中的 ``index`` 参数），而是上一次后端响应时唯一分配的序号，
   * 保证多次拉取之间具备稳定的 React key。
   */
  const seqRef = React.useRef(0);
  const seqMap = React.useMemo(() => {
    const map = new Map<string, number>();
    words.forEach((w) => {
      const key = `${w.word}|${w.action || 'block'}|${w.category || ''}`;
      if (!map.has(key)) {
        seqRef.current += 1;
        map.set(key, seqRef.current);
      }
    });
    return map;
  }, [words]);

  const fetchWords = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getComplianceWords();
      if (res.success) setWords(res.data || []);
    } catch {
      message.error('获取敏感词列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  // ── 过滤 ──
  const visibleWords = useMemo(() => {
    return words.filter((w) => {
      if (actionTab !== 'all' && (w.action || 'block') !== actionTab) return false;
      if (keyword && !(`${w.word} ${w.replacement || ''} ${w.category || ''}`).toLowerCase().includes(keyword.toLowerCase()))
        return false;
      return true;
    });
  }, [words, actionTab, keyword]);

  // ── KPIs ──
  const stats = useMemo(() => {
    const out = { block: 0, replace: 0, warn: 0 };
    words.forEach((w) => {
      const a = (w.action || 'block') as keyof typeof out;
      if (out[a] !== undefined) out[a] += 1;
    });
    return out;
  }, [words]);

  // ── 命中预览 ──
  const previewHits = useMemo(() => {
    if (!previewText.trim()) return [];
    const hits: { word: ComplianceWord; index: number }[] = [];
    for (const w of words) {
      let idx = previewText.indexOf(w.word);
      while (idx >= 0) {
        hits.push({ word: w, index: idx });
        idx = previewText.indexOf(w.word, idx + 1);
      }
    }
    hits.sort((a, b) => a.index - b.index);
    return hits;
  }, [previewText, words]);

  // ── 操作 ──
  const openCreate = () => {
    setEditingWord(null);
    form.resetFields();
    form.setFieldsValue({ action: 'block', category: 'sensitive' });
    setModalOpen(true);
  };

  const openEdit = (w: ComplianceWord) => {
    setEditingWord(w);
    form.setFieldsValue(w);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // 编辑：先删旧再加新（后端接口按 word 唯一）
      if (editingWord && editingWord.word !== values.word) {
        await adminApi.removeComplianceWord(editingWord.word);
      }
      await adminApi.addComplianceWord(values);
      message.success(editingWord ? '敏感词已更新' : '敏感词已添加');
      setModalOpen(false);
      fetchWords();
    } catch {
      /* validation */
    }
  };

  const handleDelete = async (word: string) => {
    try {
      await adminApi.removeComplianceWord(word);
      message.success(`敏感词 "${word}" 已删除`);
      fetchWords();
    } catch {
      message.error('删除失败');
    }
  };

  const renderAction = (w: ComplianceWord) => {
    const a = w.action || 'block';
    const m = ACTION_META[a] || ACTION_META.block;
    return (
      <Tag
        style={{
          background: `${m.color}1a`,
          color: m.color,
          border: `1px solid ${m.color}40`,
          borderRadius: radius.sm,
          padding: '1px 10px',
          fontSize: 12,
          fontWeight: text.subtitle.fontWeight,
        }}
      >
        {m.label}
      </Tag>
    );
  };

  const columns = [
    {
      title: '敏感词',
      dataIndex: 'word',
      key: 'word',
      width: 220,
      render: (w: string) => (
        <span
          style={{
            fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
            color: palette.danger,
            fontWeight: text.subtitle.fontWeight,
            fontSize: 13,
          }}
        >
          {w}
        </span>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      ellipsis: true,
      render: (c?: string) =>
        c ? <Tag color={palette.surfaceMuted} style={{ color: palette.inkSecondary }}>{c}</Tag> : <Text type="secondary">通用</Text>,
    },
    {
      title: '处理方式',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: renderAction,
    },
    {
      title: '替换词',
      dataIndex: 'replacement',
      key: 'replacement',
      ellipsis: true,
      render: (v?: string) =>
        v ? (
          <span style={{ fontFamily: 'SFMono-Regular, Consolas, monospace', color: palette.info, fontSize: 12 }}>
            → {v}
          </span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: unknown, w: ComplianceWord) => (
        <PermissionControl allowedRoles={['admin']}>
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(w)}
            >
              编辑
            </Button>
            <Popconfirm
              title={`删除敏感词 "${w.word}"？`}
              onConfirm={() => handleDelete(w.word)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </PermissionControl>
      ),
    },
  ];

  return (
    <div>
      {/* ── 页面头 ── */}
      <div style={{ marginBottom: space.lg }}>
        <Title level={3} style={{ margin: 0, fontSize: text.heading.fontSize }}>
          <SafetyCertificateOutlined style={{ color: palette.primary, marginRight: space.sm }} />
          合规配置
        </Title>
        <Text style={{ color: palette.inkSecondary, marginTop: 4, display: 'block' }}>
          管理敏感词和违规话术黑名单。系统在 Agent 输出前自动拦截/替换违规内容。
        </Text>
      </div>

      {/* ── KPI ── */}
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        <Col xs={24} sm={8}>
          <StatKpiCard
            title="拦截类"
            value={stats.block}
            tone="danger"
            icon={<ThunderboltOutlined />}
            hint="直接拒绝输出"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatKpiCard
            title="替换类"
            value={stats.replace}
            tone="primary"
            icon={<ExperimentOutlined />}
            hint="替换为 replacement"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatKpiCard
            title="警告类"
            value={stats.warn}
            tone="warning"
            icon={<CheckCircleOutlined />}
            hint="标记，需人工复核"
          />
        </Col>
      </Row>

      {/* ── Tabs + Table ── */}
      <Card
        variant="borderless"
        style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm, marginBottom: space.lg }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{
            padding: `${space.md}px ${space.lg}px`,
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: space.md,
          }}
        >
          <Tabs
            activeKey={actionTab}
            onChange={setActionTab}
            items={[
              { key: 'all', label: `全部 (${words.length})` },
              { key: 'block', label: `拦截 (${stats.block})` },
              { key: 'replace', label: `替换 (${stats.replace})` },
              { key: 'warn', label: `警告 (${stats.warn})` },
            ]}
            tabBarStyle={{ margin: 0, borderBottom: 'none' }}
          />
          <Space size={space.sm} wrap>
            <Input
              placeholder="搜索词 / 分类"
              prefix={<SearchOutlined style={{ color: palette.inkMuted }} />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchWords}>刷新</Button>
            <PermissionControl allowedRoles={['admin']}>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setBatchOpen(true)}
              >
                批量导入
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
                style={{
                  background: palette.primary,
                  borderColor: palette.primary,
                  boxShadow: `0 4px 12px ${palette.primaryLight}`,
                }}
              >
                添加敏感词
              </Button>
            </PermissionControl>
          </Space>
        </div>

        {/* 表格 */}
        <div style={{ padding: space.md }}>
          {visibleWords.length > 0 ? (
            <Table<ComplianceWord>
              dataSource={visibleWords}
              columns={columns}
              rowKey={(r) => {
                const seq = seqMap.get(`${r.word}|${r.action || 'block'}|${r.category || ''}`);
                // 出现顺序里遇罕见无 seq 的尾部条目，退化为 ``word:action:categ
                // ory`` 兜底；不再依赖 antd ``rowKey`` 第二参数 index。
                return seq ?? `${r.word}-${r.action || 'block'}`;
              }}
              loading={loading}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个` }}
            />
          ) : (
            <EmptyChart
              message={keyword ? '没有匹配的敏感词' : '当前分类下无敏感词'}
              height={180}
            />
          )}
        </div>
      </Card>

      {/* ── 命中预览 ── */}
      <Card
        variant="borderless"
        title={
          <span>
            <ExperimentOutlined style={{ color: palette.primary, marginRight: 8 }} />
            实时命中预览
          </span>
        }
        style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm }}
      >
        <Input.TextArea
          placeholder="粘贴一段模拟话术，立即查看哪些敏感词会被命中（仅本机预览，不联网）"
          rows={4}
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          style={{ borderRadius: radius.md }}
        />
        <div style={{ marginTop: space.md, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {previewHits.length > 0 ? (
            <>
              <Tag color="red" style={{ fontWeight: text.subtitle.fontWeight }}>
                {previewHits.length} 处命中
              </Tag>
              {previewHits.slice(0, 8).map((h, i) => {
                const m = ACTION_META[h.word.action || 'block'];
                return (
                  <Tooltip key={`${h.word.word}-${i}`} title={`${m.description}：${h.word.replacement || ''}`}>
                    <Tag
                      style={{
                        background: `${m.color}1a`,
                        color: m.color,
                        border: `1px solid ${m.color}40`,
                      }}
                    >
                      {h.word.word} · {m.label}
                    </Tag>
                  </Tooltip>
                );
              })}
            </>
          ) : (
            <Alert
              type="info"
              showIcon
              title={previewText ? '当前文本不含任何已配置的敏感词' : '请在上方输入文本以预览命中情况'}
            />
          )}
        </div>
      </Card>

      {/* ── 添加/编辑 Modal ── */}
      <DraggableModal
        title={editingWord ? `编辑敏感词` : '添加敏感词'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onCloseModal={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={520}
        initialOffset={{ x: 0, y: 40 }}
        style={{ top: 80 }}
      >
        <Form form={form} layout="vertical" initialValues={{ action: 'block', category: 'sensitive' }}>
          <Form.Item name="word" label="敏感词" rules={[{ required: true }]}>
            <Input placeholder="请输入敏感词" />
          </Form.Item>
          <Form.Item name="action" label="处理方式" rules={[{ required: true }]}>
            <Select
              options={Object.entries(ACTION_META).map(([v, m]) => ({
                value: v,
                label: `${m.label}（${m.description}）`,
              }))}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.action !== curr.action}
          >
            {({ getFieldValue }) =>
              getFieldValue('action') === 'replace' ? (
                <Form.Item
                  name="replacement"
                  label="替换词"
                  rules={[{ required: true, message: '替换方式必须指定 replacement' }]}
                >
                  <Input placeholder="替换为以下内容" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="如：夸大宣传、价格误导、学区承诺" />
          </Form.Item>
        </Form>
      </DraggableModal>

      <BatchImportModal
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        title="批量导入敏感词"
        endpoint="/api/admin/compliance/words/batch"
        columns={[
          { key: 'word', title: '敏感词', required: true },
          {
            key: 'action', title: '处理方式', required: true,
            parse: (s) => (['block', 'replace', 'warn'].includes(String(s).trim()) ? String(s).trim() : 'block'),
          },
          { key: 'replacement', title: '替换词' },
          { key: 'category', title: '分类' },
        ]}
        onComplete={() => fetchWords()}
      />
    </div>
  );
};

export default AdminCompliance;
