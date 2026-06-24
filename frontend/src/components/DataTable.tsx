/**
 * DataTable - 通用表格组件
 *
 * 功能：
 *   - 分页（支持自定义每页条数）
 *   - 排序（列头点击排序）
 *   - 搜索（顶部搜索框）
 *   - 列配置（动态显示/隐藏列）
 *   - 自定义操作列（通过 renderActions 传入）
 *
 * 依赖：
 *   - Ant Design Table + Pagination + Search
 */
import React, { useState, useMemo } from 'react';
import { Table, Input, Button, Space, Select, Dropdown, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ReloadOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons'; 

interface DataTableProps<T extends Record<string, any>> {
  /** 表格数据 */
  dataSource: T[];
  /** 列定义 */
  columns: ColumnsType<T>;
  /** 加载中状态 */
  loading?: boolean;
  /** 是否显示搜索框 */
  searchable?: boolean;
  /** 搜索框 placeholder */
  searchPlaceholder?: string;
  /** 是否显示分页 */
  showPagination?: boolean;
  /** 每页条数选项 */
  pageSizeOptions?: string[];
  /** 默认每页条数 */
  defaultPageSize?: number;
  /** 总记录数（受控模式） */
  total?: number;
  /** 当前页（受控模式） */
  currentPage?: number;
  /** 页码变化回调 */
  onPageChange?: (page: number, pageSize: number) => void;
  /** 自定义操作列渲染 */
  renderActions?: (record: T) => React.ReactNode;
  /** 表格风格 */
  size?: 'small' | 'middle' | 'large';
  /** 额外顶部工具栏 */
  extraToolbar?: React.ReactNode;
  /** 行选择回调 */
  onSelectChange?: (selectedRowKeys: React.Key[]) => void;
  /** 选中的行 */
  selectedRowKeys?: React.Key[];
}

const DataTable = <T extends Record<string, any>>({
  dataSource,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = '搜索...',
  showPagination = true,
  pageSizeOptions = ['10', '20', '50', '100'],
  defaultPageSize = 20,
  total,
  currentPage,
  onPageChange,
  renderActions,
  size = 'middle',
  extraToolbar,
  onSelectChange,
  selectedRowKeys,
}: DataTableProps<T>) => {
  const [searchText, setSearchText] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    columns.map((col) => col.key as string).filter(Boolean),
  );

  // 搜索过滤
  const filteredData = useMemo(() => {
    if (!searchText) return dataSource;
    const lower = searchText.toLowerCase();
    return dataSource.filter((record) =>
      Object.values(record).some((val) =>
        String(val ?? '').toLowerCase().includes(lower),
      ),
    );
  }, [dataSource, searchText]);

  // 列可见性切换
  const columnMenuItems = columns
    .filter((col) => col.key)
    .map((col) => ({
      key: col.key as string,
      label: (
        <span>
          <Checkbox
            checked={visibleColumns.includes(col.key as string)}
            onChange={() => {
              const key = col.key as string;
              setVisibleColumns((prev) =>
                prev.includes(key)
                  ? prev.filter((k) => k !== key)
                  : [...prev, key],
              );
            }}
          >
            {col.title as React.ReactNode}
          </Checkbox>
        </span>
      ),
    }));

  // 合并操作列
  const mergedColumns = useMemo(() => {
    const cols = columns.filter((col) => col.key && visibleColumns.includes(col.key as string));
    if (renderActions) {
      cols.push({
        title: '操作',
        key: 'actions',
        width: 180,
        fixed: 'right' as const,
        render: (_: unknown, record: T) => <Space>{renderActions(record)}</Space>,
      } as ColumnsType<T>[number]);
    }
    return cols;
  }, [columns, visibleColumns, renderActions]);

  return (
    <div>
      {/* 搜索栏 + 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space>
          {searchable && (
            <Input
              placeholder={searchPlaceholder}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260, borderRadius: 8 }}
              allowClear
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setSearchText('')}
            style={{ borderRadius: 8 }}
          >
            重置
          </Button>
        </Space>

        <Space>
          {extraToolbar}
          <Dropdown menu={{ items: columnMenuItems }} placement="bottomRight">
            <Button icon={<ColumnHeightOutlined />} style={{ borderRadius: 8 }}>
              列配置
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* 表格 */}
      <Table<T>
        columns={mergedColumns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 1200 }}
        size={size}
        rowKey={(record) => String(record.id ?? record.key)}
        rowSelection={
          selectedRowKeys && onSelectChange
            ? {
                selectedRowKeys,
                onChange: onSelectChange,
              }
            : undefined
        }
        pagination={
          showPagination
            ? {
                current: currentPage || 1,
                pageSize: defaultPageSize,
                total: currentPage !== undefined ? total : filteredData.length,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions,
                showTotal: (t) => `共 ${t} 条`,
                onChange: (page, pageSize) => {
                  if (onPageChange) onPageChange(page, pageSize);
                },
              }
            : false
        }
        locale={{
          emptyText: (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
              <div style={{ color: '#999' }}>暂无数据</div>
            </div>
          ),
        }}
      />
    </div>
  );
};

export default DataTable;
