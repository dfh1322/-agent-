import React from 'react';
import { Empty } from 'antd';

interface EmptyStateProps {
  description?: string;
  image?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  description = '暂无数据',
}) => {
  return (
    <Empty
      description={description}
      style={{ padding: '40px 0' }}
    />
  );
};

export default EmptyState;
