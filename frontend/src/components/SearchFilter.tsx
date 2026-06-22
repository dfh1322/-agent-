import React from 'react';
import { Typography, Input } from 'antd';

const { Text } = Typography;
const { Search } = Input;

interface SearchFilterProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
  style?: React.CSSProperties;
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  value = '',
  onChange,
  placeholder = '搜索...',
  onSearch,
  style,
}) => {
  return (
    <Search
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      onSearch={onSearch}
      placeholder={placeholder}
      allowClear
      style={{ width: '100%', maxWidth: 400, ...style }}
    />
  );
};

export default SearchFilter;
