/**
 * AdminKnowledge - 知识库管理 v2
 *
 * 设计要点：
 *   * KPI：总文档、按类型分布、启用率；
 *   * 类型 Tabs；
 *   * 列表/预览双视图；
 *   * 批量导入（沿用 BatchImportModal）；
 *   * 关键词命中高亮预览。
 */
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  Button, Form, Input, Select, Tag, Space, App, Popconfirm,
  Row, Col, Card, Typography, Tabs, Segmented, Tooltip, Upload, Switch,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, BarsOutlined, EyeOutlined, DatabaseOutlined,
  HighlightOutlined, FileWordOutlined, FileTextOutlined,
} from '@ant-design/icons';
import mammoth from 'mammoth';
import { adminApi } from '../../services/api';
import PermissionControl from '../../components/PermissionControl';
import DataTable from '../../components/DataTable';
import StatKpiCard from '../../components/StatKpiCard';
import EmptyChart from '../../components/EmptyChart';
import BatchImportModal from '../../components/BatchImportModal';
import DraggableModal from '../../components/DraggableModal';
import { palette, radius, space, text } from '../../theme';

const { Title, Text } = Typography;

/** 知识库编辑器：富文本 + Word 导入 + 源码切换 */
const ContentEditor: React.FC<{
  value: string;
  onChange: (html: string) => void;
}> = ({ value, onChange }) => {
  const [mode, setMode] = useState<'rich' | 'source'>('rich');
  const { message } = App.useApp();
  const handleWordImport = async (file: any) => {
    if (!file?.originFileObj) return false;
    try {
      const buffer = await file.originFileObj.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml(
        { arrayBuffer: buffer },
        { styleMap: ['p[style-name] => p', 'b => strong', 'i => em'] },
      );
      onChange(html || '');
      message.success(`已解析 ${file.name}，请检查后保存。`);
    } catch (e: any) {
      message.error(`Word 解析失败：${e?.message || '未知错误'}`);
    }
    return false;
  };
  return (
    <div>
      <Space style={{ marginBottom: 8 }}>
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as 'rich' | 'source')}
          options={[
            { label: '富文本编辑', value: 'rich', icon: <FileTextOutlined /> },
            { label: 'HTML 源码', value: 'source', icon: <FileWordOutlined /> },
          ]}
        />
        <Upload
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          showUploadList={false}
          beforeUpload={handleWordImport}
        >
          <Button icon={<FileWordOutlined />} size="small">
            从 Word 导入
          </Button>
        </Upload>
      </Space>
      {mode === 'rich' ? (
        <div
          contentEditable
          suppressContentEditableWarning
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 6,
            padding: 10,
            minHeight: 180,
            maxHeight: 360,
            overflow: 'auto',
            background: palette.surface,
            fontSize: 13,
            color: palette.ink,
            lineHeight: 1.7,
            outline: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: value || '' }}
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          data-placeholder="请输入或从 Word 导入内容..."
        />
      ) : (
        <Input.TextArea
          rows={10}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="HTML 源码"
          style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }}
        />
      )}
    </div>
  );
};

interface KnowledgeRecord {
  id: number;
  title: string;
  doc_type: string;
  source?: string;
  content?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DOC_TYPE_OPTIONS = [
  { label: '政策', value: 'policy', color: palette.info },
  { label: '常见问题', value: 'faq', color: palette.success },
  { label: '指南', value: 'guide', color: palette.warning },
];

const AdminKnowledge: React.FC = () => {
  const [data, setData] = useState<KnowledgeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [docType, setDocType] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [previewing, setPreviewing] = useState<KnowledgeRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<KnowledgeRecord | null>(null);
  const [contentValue, setContentValue] = useState('');
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listKnowledge({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        doc_type: docType || undefined,
      });
      if ((res as any).success) {
        setData((res as any).data);
        setTotal((res as any).pagination?.total ?? (res as any).data.length);
      }
    } catch {
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, docType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── KPI ──
  const kpi = useMemo(() => {
    const out: Record<string, number> = { policy: 0, faq: 0, guide: 0 };
    data.forEach((d) => { if (out[d.doc_type] !== undefined) out[d.doc_type]++; });
    const activeCount = data.filter((d) => d.is_active).length;
    return { ...out, total, active: activeCount } as Record<string, number>;
  }, [data, total]);

  const renderDocType = (type: string) => {
    const opt = DOC_TYPE_OPTIONS.find((o) => o.value === type);
    if (!opt) return <Tag>{type}</Tag>;
    return (
      <Tag
        style={{
          background: `${opt.color}1a`,
          color: opt.color,
          border: `1px solid ${opt.color}40`,
          borderRadius: radius.sm,
          padding: '1px 10px',
          fontWeight: text.subtitle.fontWeight,
        }}
      >
        {opt.label}
      </Tag>
    );
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    setContentValue('');
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record: KnowledgeRecord) => {
    setEditingRecord(record);
    setContentValue(record.content || '');
    form.setFieldsValue({
      ...record,
      is_active: record.is_active ? '启用' : '停用',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      values.is_active = values.is_active === '启用' || values.is_active === true;
      if (editingRecord) {
        await adminApi.updateKnowledge(editingRecord.id, values);
        message.success('文档已更新');
      } else {
        await adminApi.createKnowledge(values);
        message.success('文档添加成功');
      }
      setModalOpen(false);
      fetchData();
    } catch { /* validation */ }
  };

  const handleDelete = async (id: number, title: string) => {
    try {
      await adminApi.deleteKnowledge(id);
      message.success(`文档 "${title}" 已删除`);
      fetchData();
    } catch {
      message.error('删除失败');
    }
  };

  // 高亮关键词
  const highlight = (text: string, kw: string) => {
    if (!kw) return text;
    try {
      const parts = text.split(new RegExp(`(${kw})`, 'gi'));
      return parts.map((p, i) =>
        p.toLowerCase() === kw.toLowerCase() ? (
          <mark key={i} style={{ background: '#fde68a', padding: '0 2px', borderRadius: 2 }}>{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      );
    } catch { return text; }
  };

  const columns = [
    {
      title: '文档', key: 'doc', width: 280,
      render: (_: unknown, r: KnowledgeRecord) => (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <Text strong style={{ color: palette.ink, fontSize: 13 }} ellipsis>
            {highlight(r.title, keyword) || '(未命名)'}
          </Text>
          <Text style={{ color: palette.inkMuted, fontSize: 11 }}>
            ID #{r.id} · 来源 {r.source || '未指定'}
          </Text>
        </div>
      ),
    },
    {
      title: '类型', dataIndex: 'doc_type', key: 'doc_type', width: 100,
      render: renderDocType,
    },
    {
      title: '内容预览', key: 'preview',
      render: (_: unknown, r: KnowledgeRecord) => {
        const content = (r.content || '').slice(0, 80);
        return (
          <Tooltip title={r.content || ''}>
            <Text style={{ fontSize: 12, color: palette.inkSecondary }} ellipsis>
              {highlight(content, keyword) || '—'}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active', width: 90,
      render: (v: boolean) => (
        <Tag
          style={{
            background: v ? palette.successLight : palette.surfaceMuted,
            color: v ? palette.successInk : palette.inkMuted,
            border: 'none',
            borderRadius: radius.pill,
            padding: '0 10px',
            fontWeight: text.subtitle.fontWeight,
          }}
        >
          <span
            style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: v ? palette.success : palette.inkMuted,
              marginRight: 6,
            }}
          />
          {v ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170 },
    {
      title: '操作', key: 'actions', width: 170, fixed: 'right' as const,
      render: (_: unknown, r: KnowledgeRecord) => (
        <PermissionControl allowedRoles={['admin']}>
          <Space size={4}>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewing(r)}>
              预览
            </Button>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)}>
              编辑
            </Button>
            <Popconfirm title={`确定删除 "${r.title}"？`} onConfirm={() => handleDelete(r.id, r.title)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
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
          <DatabaseOutlined style={{ color: palette.primary, marginRight: space.sm }} />
          知识库管理
        </Title>
        <Text style={{ color: palette.inkSecondary, marginTop: 4, display: 'block' }}>
          管理政策原文、FAQ 和购房指南等非结构化文档。ChromaDB 在 background 周期同步。
        </Text>
      </div>

      {/* ── KPI ── */}
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        {DOC_TYPE_OPTIONS.map((opt) => (
          <Col xs={24} sm={8} key={opt.value}>
            <StatKpiCard
              title={opt.label}
              value={kpi[opt.value] ?? 0}
              tone={opt.value === 'policy' ? 'primary' : opt.value === 'faq' ? 'success' : 'warning'}
              icon={<HighlightOutlined />}
              hint="本分类条目"
            />
          </Col>
        ))}
      </Row>

      {/* ── 主体 ── */}
      <Card variant="borderless" style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm }} styles={{ body: { padding: 0 } }}>
        <div
          style={{
            padding: `${space.md}px ${space.lg}px`,
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: space.md,
          }}
        >
          <Tabs
            activeKey={docType || 'all'}
            onChange={(k) => { setDocType(k === 'all' ? undefined : k); setPage(1); }}
            items={[
              { key: 'all', label: `全部 (${total})` },
              ...DOC_TYPE_OPTIONS.map((o) => ({
                key: o.value, label: `${o.label} (${kpi[o.value] ?? 0})`,
              })),
            ]}
            tabBarStyle={{ margin: 0, borderBottom: 'none' }}
          />
          <Space size={space.sm} wrap>
            <Input
              placeholder="搜索标题或内容"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
              style={{ width: 240 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <PermissionControl allowedRoles={['admin']}>
              <Button icon={<PlusOutlined />} onClick={() => setBatchOpen(true)}>批量导入</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{ background: palette.primary, borderColor: palette.primary }}
              >
                新增文档
              </Button>
            </PermissionControl>
          </Space>
        </div>

        <div style={{ padding: space.md }}>
          {data.length > 0 ? (
            <DataTable<KnowledgeRecord>
              dataSource={data}
              columns={columns}
              loading={loading}
              searchPlaceholder=""
              total={total}
              currentPage={page}
              onPageChange={setPage}
              pageSizeOptions={['10', '20', '50']}
            />
          ) : (
            <EmptyChart
              title="暂无文档"
              message={keyword ? `"${keyword}" 没有匹配结果` : '当前类型下没有文档'}
              actionLabel="新增文档"
              onAction={openCreateModal}
              height={180}
            />
          )}
        </div>
      </Card>

      {/* ── 新增/编辑 Modal（可拖动） ── */}
      <DraggableModal
        title={
          <span>
            {editingRecord ? '编辑文档' : '新增文档'}
            {editingRecord && <Text style={{ fontSize: 12, color: palette.inkMuted, marginLeft: 8 }}>ID #{editingRecord.id}</Text>}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onCloseModal={() => setModalOpen(false)}
        onOk={handleSubmit}
        width={720}
        destroyOnHidden
        initialOffset={{ x: 0, y: 40 }}
        style={{ top: 80 }}
      >
        <Form form={form} layout="vertical" initialValues={{ is_active: '启用' }}>
          <Row gutter={space.md}>
            <Col span={16}>
              <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                <Input placeholder="如：杭州市住房公积金贷款管理办法" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="doc_type" label="文档类型" rules={[{ required: true }]}>
                <Select options={DOC_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="来源">
                <Input placeholder="如：杭州公积金中心" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="启用状态">
                <Select
                  options={[
                    { value: '启用', label: '启用' },
                    { value: '停用', label: '停用' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="content"
            label="文档内容"
            rules={[{ required: true, message: '请输入文档内容（用于 ChromaDB 向量检索）' }]}
          >
            <ContentEditor
              value={contentValue}
              onChange={(html) => {
                setContentValue(html);
                form.setFieldValue('content', html);
              }}
            />
          </Form.Item>
        </Form>
      </DraggableModal>

      {/* ── 预览 Modal（可拖动） ── */}
      <DraggableModal
        title={previewing?.title}
        open={!!previewing}
        onCancel={() => setPreviewing(null)}
        onCloseModal={() => setPreviewing(null)}
        footer={null}
        width={680}
        initialOffset={{ x: 0, y: 40 }}
        style={{ top: 80 }}
      >
        {previewing && (
          <div>
            <Space wrap style={{ marginBottom: space.md }}>
              {renderDocType(previewing.doc_type)}
              {previewing.source && <Text style={{ fontSize: 12, color: palette.inkMuted }}>来源：{previewing.source}</Text>}
              <Text style={{ fontSize: 12, color: palette.inkMuted }}>更新于 {previewing.updated_at}</Text>
            </Space>
            <div
              style={{
                background: palette.surfaceMuted,
                borderRadius: radius.md,
                padding: space.md,
                fontSize: 13,
                lineHeight: 1.7,
                color: palette.ink,
                whiteSpace: 'pre-wrap',
                maxHeight: 320,
                overflow: 'auto',
              }}
            >
              {previewing.content || '(文档无正文)'}
            </div>
          </div>
        )}
      </DraggableModal>

      <BatchImportModal
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        title="批量导入知识库文档"
        endpoint="/api/admin/knowledge/batch"
        columns={[
          { key: 'title', title: '标题', required: true },
          { key: 'doc_type', title: '文档类型', required: true },
          { key: 'source', title: '来源' },
          { key: 'content', title: '内容', required: true },
          { key: 'is_active', title: '启用', parse: (s) => ['true', '1', '启用', 'yes'].includes(String(s).toLowerCase()) },
        ]}
        onComplete={() => fetchData()}
      />
    </div>
  );
};

export default AdminKnowledge;
