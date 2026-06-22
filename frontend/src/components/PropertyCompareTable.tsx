/**
 * PropertyCompareTable - 多楼盘动态列对比表格
 *
 * 功能：
 *   - 动态列：根据传入的楼盘数据自动生成对比列
 *   - 高亮差异项：不同值自动标色
 *   - 优劣标记：每行自动标记最优值（绿色✓）和最差值（红色✗）
 *   - AI 推荐结论：支持附加 AI 分析结果
 *
 * 依赖：
 *   - Ant Design Table + Tag + Card
 */
import React, { useMemo } from 'react';
import { Table, Tag, Card, Typography, Space, Divider } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface CompareColumn {
  /** 列标题 */
  title: string;
  /** 数据键 */
  dataIndex: string;
  /** 是否数值类型（用于求最优/最差） */
  numeric?: boolean;
  /** 数值越小越好 */
  smallerIsBetter?: boolean;
  /** 渲染函数 */
  render?: (value: any, record: any) => React.ReactNode;
  /** 默认宽度 */
  width?: number | string;
}

interface PropertyCompareTableProps {
  /** 楼盘数据列表 */
  properties: Record<string, any>[];
  /** 对比列定义 */
  columns: CompareColumn[];
  /** AI 综合推荐结论 */
  aiRecommendation?: string;
  /** 高亮差异项（默认开启） */
  highlightDifferences?: boolean;
}

const PropertyCompareTable: React.FC<PropertyCompareTableProps> = ({
  properties,
  columns,
  aiRecommendation,
  highlightDifferences = true,
}) => {
  // 计算每列的最优/最差值
  const columnStats = useMemo(() => {
    const stats: Record<string, { min?: number; max?: number }> = {};
    columns.forEach((col) => {
      if (!col.numeric || !col.dataIndex) return;
      const values = properties
        .map((p) => parseFloat(String(p[col.dataIndex])))
        .filter((v) => !isNaN(v));
      if (values.length > 0) {
        stats[col.dataIndex] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });
    return stats;
  }, [properties, columns]);

  // 检测差异列（值不完全相同的列）
  const diffColumns = useMemo(() => {
    if (!highlightDifferences) return new Set<string>();
    const diffSet = new Set<string>();
    columns.forEach((col) => {
      const values = properties.map((p) => String(p[col.dataIndex]));
      if (new Set(values).size > 1) {
        diffSet.add(col.dataIndex);
      }
    });
    return diffSet;
  }, [properties, columns, highlightDifferences]);

  // 构建 antd columns
  const tableColumns = useMemo(() => {
    const nameCol: any = {
      title: '对比项',
      dataIndex: '_name',
      key: '_name',
      width: 140,
      fixed: 'left' as const,
      render: (text: string) => <Text strong style={{ fontSize: 14 }}>{text}</Text>,
    };

    const propertyCols = properties.map((prop) => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{prop.name || '未知'}</div>
          {prop.district && (
            <Tag color="blue" style={{ marginTop: 4 }}>{prop.district}</Tag>
          )}
        </div>
      ),
      key: prop.id || prop.name,
      width: 160,
      align: 'center' as const,
      render: (text: any, record: any, index: number) => {
        const colDef = columns[index];
        if (!colDef) return '-';
        const value = prop[colDef.dataIndex];
        const isDiff = diffColumns.has(colDef.dataIndex);
        const stat = columnStats[colDef.dataIndex];

        let displayValue = value;
        let icon = null;

        if (colDef.numeric && stat && !isNaN(parseFloat(String(value)))) {
          const num = parseFloat(String(value));
          const isBetter = colDef.smallerIsBetter
            ? num === stat.min
            : num === stat.max;
          const isWorse = colDef.smallerIsBetter
            ? num === stat.max
            : num === stat.min;

          if (isBetter && properties.length > 1) {
            icon = <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 4 }} />;
          } else if (isWorse && properties.length > 1) {
            icon = <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />;
          }
        }

        return (
          <div style={{
            padding: '4px 0',
            color: isDiff ? '#333' : '#999',
            fontWeight: isDiff ? 600 : 400,
          }}>
            {colDef.render
              ? colDef.render(value, prop)
              : String(value ?? '-')}
            {icon}
          </div>
        );
      },
    }));

    return [nameCol, ...propertyCols];
  }, [properties, columns, diffColumns, columnStats]);

  // 构建数据源
  const dataSource = useMemo(() => {
    return columns.map((col) => ({
      _name: col.title,
      key: col.dataIndex,
    }));
  }, [columns]);

  return (
    <div>
      <Card
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
        styles={{ body: { padding: '0 24px 24px' } }}
      >
        <Table
          columns={tableColumns}
          dataSource={dataSource}
          pagination={false}
          size="middle"
          bordered
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '暂无对比数据' }}
        />
      </Card>

      {/* AI 推荐结论 */}
      {aiRecommendation && (
        <Card
          style={{
            marginTop: 24,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)',
            border: '1px solid rgba(102,126,234,0.2)',
          }}
        >
          <Space style={{ width: '100%' }} size="middle">
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>
              <StarOutlined style={{ color: '#fff' }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
                AI 综合推荐
              </Text>
              <Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {aiRecommendation}
              </Text>
            </div>
          </Space>
        </Card>
      )}
    </div>
  );
};

export default PropertyCompareTable;
