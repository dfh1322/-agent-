import React from 'react';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from './../services/api';

interface ModelSelectorProps {
  value?: string;
  onChange?: (model: string) => void;
  style?: React.CSSProperties;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, style }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: chatApi.getModels,
  });

  const models = data?.models || [];
  const currentValue = value || data?.current_model?.name;

  return (
    <Select
      value={currentValue}
      onChange={onChange}
      loading={isLoading}
      style={{ minWidth: 160, ...style }}
      options={models.map(m => ({
        label: m.description,
        value: m.name,
      }))}
    />
  );
};

export default ModelSelector;
