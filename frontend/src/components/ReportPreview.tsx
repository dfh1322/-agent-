/**
 * ReportPreview - 置业方案预览容器
 *
 * 功能：
 *   - 展示结构化置业报告
 *   - 支持打印/导出 PDF（调用浏览器打印对话框）
 *   - 报告包含：推荐楼盘、预算分配、置业建议
 *
 * 依赖：
 *   - Ant Design Card + Table + Tag + Divider
 */
import React from 'react';
import {
  Card, Table, Tag, Typography, Space, Button, Divider, Row, Col,
} from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export interface ReportProperty {
  id: number;
  name: string;
  district: string;
  price_range: string;
  area_range: string;
  pros?: string[];
  cons?: string[];
  priority?: number;
}

export interface ReportData {
  title: string;
  userNeeds: string;
  recommendedProperties: ReportProperty[];
  budgetAdvice?: string;
  overallAdvice?: string;
  generatedAt?: string;
}

interface ReportPreviewProps {
  report: ReportData;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ report }) => {
  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    // 调用浏览器打印对话框，用户可选择"另存为 PDF"
    handlePrint();
  };

  const propertyColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, record: ReportProperty) => (
        <Tag
          color={record.priority === 1 ? 'gold' : record.priority === 2 ? 'silver' : record.priority === 3 ? 'bronze' : 'default'}
          style={{ fontSize: 16, fontWeight: 'bold' }}
        >
          #{record.priority ?? '-'}
        </Tag>
      ),
    },
    {
      title: '楼盘名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong style={{ fontSize: 15 }}>{text}</Text>,
    },
    {
      title: '区域',
      dataIndex: 'district',
      key: 'district',
      width: 100,
    },
    {
      title: '价格',
      dataIndex: 'price_range',
      key: 'price_range',
      width: 140,
      render: (text: string) => <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>{text}</Text>,
    },
    {
      title: '面积',
      dataIndex: 'area_range',
      key: 'area_range',
      width: 100,
    },
    {
      title: '优点',
      key: 'pros',
      render: (_: any, record: ReportProperty) =>
        record.pros?.map((p, i) => <Tag key={i} color="green" style={{ margin: 2 }}>{p}</Tag>),
    },
    {
      title: '缺点',
      key: 'cons',
      render: (_: any, record: ReportProperty) =>
        record.cons?.map((c, i) => <Tag key={i} color="red" style={{ margin: 2 }}>{c}</Tag>),
    },
  ];

  return (
    <div className="report-preview" style={{ minHeight: '100vh', background: '#f5f7fa', padding: '24px 0' }}>
      {/* 顶部操作栏 */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto 24px',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <FileTextOutlined style={{ fontSize: 28, color: '#667eea' }} />
          <Title level={3} style={{ margin: 0, color: '#333' }}>{report.title}</Title>
        </Space>
        <Space>
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            size="large"
            style={{ borderRadius: 8 }}
          >
            打印
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportPDF}
            size="large"
            style={{
              borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            导出 PDF
          </Button>
        </Space>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {/* 用户需求摘要 */}
        <Card
          style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <Title level={5} style={{ marginBottom: 8 }}>
            📋 您的需求
          </Title>
          <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{report.userNeeds}</Paragraph>
          {report.generatedAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              生成时间：{report.generatedAt}
            </Text>
          )}
        </Card>

        {/* 推荐楼盘 */}
        {report.recommendedProperties.length > 0 && (
          <Card
            title={<Space><FileTextOutlined /> 推荐楼盘清单</Space>}
            style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Table
              columns={propertyColumns}
              dataSource={report.recommendedProperties}
              rowKey="id"
              pagination={false}
              size="middle"
              bordered
            />
          </Card>
        )}

        {/* 预算分配建议 */}
        {report.budgetAdvice && (
          <Card
            title={<Space>💰 预算分配建议</Space>}
            style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {report.budgetAdvice}
            </Paragraph>
          </Card>
        )}

        {/* 整体置业建议 */}
        {report.overallAdvice && (
          <Card
            title={<Space>🎯 整体置业建议</Space>}
            style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {report.overallAdvice}
            </Paragraph>
          </Card>
        )}
      </div>

      {/* 打印样式 */}
      <style>{`
        @media print {
          body { background: #fff; }
          .report-preview { padding: 0; background: #fff; }
          button { display: none !important; }
          Card { box-shadow: none !important; border: 1px solid #eee; }
        }
      `}</style>
    </div>
  );
};

export default ReportPreview;
