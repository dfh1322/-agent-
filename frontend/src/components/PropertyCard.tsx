import React from 'react';
import { Card, Tag, Typography, Space } from 'antd';

const { Text, Paragraph } = Typography;

interface PropertyCardProps {
  name: string;
  district: string;
  priceRange: string;
  areaRange: string;
  decoration?: string;
  greenRate?: string;
  metro?: string;
  school?: string;
  description?: string;
  onClick?: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  name,
  district,
  priceRange,
  areaRange,
  decoration,
  greenRate,
  metro,
  school,
  description,
  onClick,
}) => {
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: '20px' } }}
    >
      <Text strong style={{ fontSize: '18px', color: '#333' }}>{name}</Text>
      <Space style={{ marginTop: '8px', marginBottom: '8px' }} size="small">
        <Tag color="blue">{district}</Tag>
        <Tag color="green">{priceRange}</Tag>
        <Tag color="orange">{areaRange}</Tag>
      </Space>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {decoration && <Tag color="cyan">{decoration}</Tag>}
        {greenRate && <Tag color="purple">{greenRate}</Tag>}
        {school && <Tag color="gold">学区</Tag>}
        {metro && <Tag color="cyan">{metro}</Tag>}
      </div>
      {description && (
        <Paragraph style={{ marginTop: '12px', fontSize: '14px', color: '#666' }} ellipsis={{ rows: 2 }}>
          {description}
        </Paragraph>
      )}
    </Card>
  );
};

export default PropertyCard;
