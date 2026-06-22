/**
 * BatchImportModal — 通用批量导入弹窗（CLAUDE.md 4.1）
 *
 * 三步流程：上传 → 预览/校验 → 提交。
 * 接收一个 ``endpoint`` 与 ``template`` 列定义；导入成功后回调 ``onComplete``。
 *
 * 解析：
 *   * 支持 .xlsx / .xls / .csv 三种文件格式，统一委托给 ``xlsx`` 解析。
 *   * 首行作为表头（中文），下方为数据；列名需与模板 ``column.title`` 一致。
 *   * ``column.parse`` 可对原始单元格做类型转换（例如将"500 万"转 500）。
 *
 * 服务端调用：
 *   * 直接用 axios 携带 JWT 调 ``endpoint``，body 是 ``{ rows: [...] }``。
 */
import React, { useMemo, useState } from 'react';
import {
  Steps, Upload, Button, Table, Alert, Space, Typography, App,
} from 'antd';
import DraggableModal from './DraggableModal';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import axios from 'axios';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

export interface ImportColumn {
  /** 形参名（最终 JSON 字段） */
  key: string;
  /** 表头中文（首行匹配） */
  title: string;
  required?: boolean;
  /** 简单类型转换 */
  parse?: (raw: unknown) => unknown;
}

export interface BatchImportModalProps {
  open: boolean;
  onCancel: () => void;
  /** 后端批量导入 URL（绝对路径或相对路径） */
  endpoint: string;
  /** 列定义 */
  columns: ImportColumn[];
  /** 通过 axios 注入 Authorization 头的 token；默认从 localStorage 读 */
  getToken?: () => string | null;
  /** 导入完成后回调 */
  onComplete?: (importedCount: number) => void;
  /** 弹窗标题，默认"批量导入" */
  title?: string;
  /** 模板文件名，提供则会出现在"下载模板"按钮 */
  templateName?: string;
}

const ACCEPT_MIME = [
  // Excel
  '.xlsx',
  '.xls',
  // CSV
  '.csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
].join(',');

function coerceCell(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

/**
 * 表头归一化：去 BOM、前后空格、合并连续空白；便于用户上传的模板存在
 * 口碑差异时仍能与 ``ImportColumn.title`` 对齐。
 */
function normalizeHeader(s: string): string {
  return (s || '').replace(/﻿/g, '').replace(/\s+/g, ' ').trim();
}

const BatchImportModal: React.FC<BatchImportModalProps> = ({
  open, onCancel, endpoint, columns, getToken, onComplete,
  title = '批量导入', templateName,
}) => {
  const [step, setStep] = useState<number>(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ name: string; total: number; skipped: number } | null>(null);

  const headerToKey = useMemo(() => {
    const map = new Map<string, ImportColumn>();
    columns.forEach((c) => map.set(normalizeHeader(c.title), c));
    return map;
  }, [columns]);

  const { message } = App.useApp();

  const beforeUpload = async (file: UploadFile) => {
    if (!file.originFileObj) return false;
    try {
      const buf = await file.originFileObj.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        message.error('文件中未找到可识别的表格');
        return false;
      }
      const sheet = workbook.Sheets[sheetName];
      // header:1 表示首行作为表头，其余按行数组返回
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: true,
      });
      if (!grid.length || grid.length < 2) {
        message.error('文件至少需要 1 行表头 + 1 行数据');
        return false;
      }
      const headerCells = (grid[0] as unknown[]).map((c) => normalizeHeader(coerceCell(c)));
      for (const col of columns) {
        if (col.required && !headerCells.includes(normalizeHeader(col.title))) {
          message.error(`缺少必需列：${col.title}`);
          return false;
        }
      }

      const parsed: Record<string, unknown>[] = [];
      let skipped = 0;
      for (let r = 1; r < grid.length; r++) {
        const rawRow = grid[r] as unknown[];
        const row: Record<string, unknown> = {};
        let allEmpty = true;
        headerCells.forEach((header, idx) => {
          const col = headerToKey.get(header);
          if (!col) return;
          const raw = rawRow[idx];
          const s = coerceCell(raw).trim();
          if (s) allEmpty = false;
          try {
            row[col.key] = col.parse ? col.parse(raw) : (s || undefined);
          } catch (e) {
            // 跳过解析失败的格子，但保留空字符串
            row[col.key] = s || undefined;
          }
        });
        if (allEmpty) {
          skipped += 1;
          continue;
        }
        parsed.push(row);
      }

      if (!parsed.length) {
        message.error('未解析到任何有效数据行，请检查模板是否正确');
        return false;
      }

      setRows(parsed);
      setFileMeta({
        name: file.name,
        total: grid.length - 1,
        skipped,
      });
      setStep(1);
    } catch (e: any) {
      message.error(`解析失败：${e?.message || '请确认文件格式正确'}`);
    }
    return false; // 阻止 Ant Design 默认上传行为
  };

  const downloadTemplate = () => {
    const headerRow = columns.map((c) => c.title);
    const sampleRow = columns.map((c) => {
      switch (c.key.toLowerCase()) {
        case 'username': return 'zhangsan';
        case 'email': return 'zhangsan@example.com';
        case 'password': return 'P@ssw0rd';
        case 'phone': return '13800000000';
        case 'full_name': return '张三';
        case 'role': return 'user';
        case 'name': return '示例楼盘';
        case 'district': return '西湖区';
        default: return '';
      }
    });
    const ws = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
    // 表头加粗 + 冻结首行
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    ws['!cols'] = headerRow.map(() => ({ wch: 16 }));
    ws['!freeze'] = { ySplit: 1 };
    // 给表头单元格一个粗体 (xlsx utils 不直接暴露，但简单给头部 set font)
    if (range.e.r >= 0 && range.e.c >= 0) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[addr]) ws[addr].s = { font: { bold: true } };
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    XLSX.writeFile(wb, templateName || 'import_template.xlsx');
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const token = (getToken ? getToken() : localStorage.getItem('token')) || '';
      const { data } = await axios.post(endpoint, { rows }, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const count = (data?.count ?? rows.length) as number;
      message.success(`导入成功：${count} 条`);
      onComplete?.(count);
      reset();
      onCancel();
    } catch (e: any) {
      const detail =
        typeof e?.response?.data?.detail === 'string'
          ? e.response.data.detail
          : e?.message || '导入失败';
      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setRows([]);
    setSubmitting(false);
    setFileMeta(null);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <DraggableModal
      title={title}
      open={open}
      onCancel={handleCancel}
      onCloseModal={handleCancel}
      width={760}
      footer={null}
      destroyOnHidden
      initialOffset={{ x: 0, y: 40 }}
      style={{ top: 80 }}
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 16 }}
        items={[
          { title: '选择文件' },
          { title: '数据预览' },
          { title: '确认导入' },
        ]}
      />

      {step === 0 && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={5} style={{ marginBottom: 4 }}>1. 上传 Excel 文件</Title>
          <Alert
            showIcon
            type="info"
            message="支持 .xlsx / .xls / .csv。首行需为表头（中文），下方行为数据；列名需与下述模板一致。"
          />
          <Space wrap>
            <Upload
              accept={ACCEPT_MIME}
              beforeUpload={beforeUpload}
              showUploadList={false}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择 Excel / CSV 文件</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
              下载 Excel 模板
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            必需列（中文表头）：{columns.filter((c) => c.required).map((c) => c.title).join('、')}
          </Text>
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            showIcon
            type="success"
            message={
              fileMeta
                ? `已从「${fileMeta.name}」解析 ${rows.length} 行有效数据（空行已跳过 ${fileMeta.skipped} 行）。`
                : `解析完成，共 ${rows.length} 行有效数据。`
            }
          />
          <Table
            size="small"
            dataSource={rows.map((r, i) => ({ key: i, ...r }))}
            columns={columns.map((c) => ({ title: c.title, dataIndex: c.key, key: c.key }))}
            pagination={{ pageSize: 5 }}
            scroll={{ x: true }}
          />
          <Space>
            <Button onClick={() => setStep(0)}>重新上传</Button>
            <Button type="primary" loading={submitting} onClick={submit}>
              确认导入
            </Button>
          </Space>
        </Space>
      )}

      {step === 2 && (
        <Alert showIcon type="success" title="导入完成" />
      )}
    </DraggableModal>
  );
};

export default BatchImportModal;
