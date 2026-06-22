/**
 * PolicyReference - 政策原文引用块
 *
 * 功能：
 *   - 展示政策原文
 *   - 标注来源、发布日期
 *   - 支持高亮关键词
 *   - 可折叠展开
 *
 * 依赖：
 *   - Ant Design Collapse + Tag + Card
 */
import React, { useState } from 'react';
import { Collapse, Tag, Typography, Card, Space } from 'antd';
import {
  BookOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface PolicyReferenceItem {
  /** 政策标题 */
  title: string;
  /** 政策原文/内容 */
  content: string;
  /** 来源（如"杭州公积金中心"） */
  source?: string;
  /** 发布日期 */
  publishDate?: string;
  /** 政策类型 */
  category?: string;
  /** 是否有效 */
  isActive?: boolean;
}

interface PolicyReferenceProps {
  /** 政策列表 */
  policies: PolicyReferenceItem[];
  /** 是否折叠，默认展开 */
  collapsible?: boolean;
  /** 高亮关键词 */
  highlightKeyword?: string;
}

const PolicyReference: React.FC<PolicyReferenceProps> = ({
  policies,
  collapsible = true,
  highlightKeyword,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(
    policies.map((_, i) => i),
  );

  if (policies.length === 0) {
    return (
      <Card style={{ borderRadius: 12, textAlign: 'center', padding: '24px 0' }}>
        <Text type="secondary">暂无相关政策信息</Text>
      </Card>
    );
  }

  const highlightText = (text: string, keyword?: string) => {
    if (!keyword || !text) return text;
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <Text key={i} strong style={{ color: '#ff4d4f', background: '#fff1f0' }}>
          {part}
        </Text>
      ) : (
        part
      ),
    );
  };

  const content = collapsible ? (
    <Collapse
      accordion
      expandedKeys={expandedKeys}
      onChange={(keys) => setExpandedKeys(keys)}
      style={{ border: 'none' }}
      itemStyle={{
        background: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
      }}
    >
      {policies.map((policy, index) => (
        <Panel
          header={
            <Space>
              <BookOutlined style={{ color: '#667eea' }} />
              <Text strong style={{ fontSize: 15 }}>{policy.title}</Text>
              {policy.isActive !== false && (
                <Tag color="green" style={{ marginLeft: 8 }}>生效中</Tag>
              )}
            </Space>
          }
          key={index}
        >
          <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {highlightText(policy.content, highlightKeyword)}
          </Paragraph>
          <Space size="large" style={{ marginTop: 8 }}>
            {policy.source && (
              <Space>
                <EnvironmentOutlined style={{ color: '#999' }} />
                <Text type="secondary">{policy.source}</Text>
              </Space>
            )}
            {policy.publishDate && (
              <Space>
                <ClockCircleOutlined style={{ color: '#999' }} />
                <Text type="secondary">{policy.publishDate}</Text>
              </Space>
            )}
            {policy.category && (
              <Tag color="blue">{policy.category}</Tag>
            )}
          </Space>
        </Panel>
      ))}
    </Collapse>
  ) : (
    <div>
      {policies.map((policy, index) => (
        <Card
          key={index}
          style={{
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Space style={{ width: '100%', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 16 }}>{policy.title}</Text>
            {policy.isActive !== false && (
              <Tag color="green">生效中</Tag>
            )}
            {policy.category && (
              <Tag color="blue">{policy.category}</Tag>
            )}
          </Space>
          <Paragraph style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {highlightText(policy.content, highlightKeyword)}
          </Paragraph>
          <Space size="large" style={{ marginTop: 8 }}>
            {policy.source && (
              <Space>
                <EnvironmentOutlined style={{ color: '#999' }} />
                <Text type="secondary">{policy.source}</Text>
              </Space>
            )}
            {policy.publishDate && (
              <Space>
                <ClockCircleOutlined style={{ color: '#999' }} />
                <Text type="secondary">{policy.publishDate}</Text>
              </Space>
            )}
          </Space>
        </Card>
      ))}
    </div>
  );

  return content;
};

export default PolicyReference;
