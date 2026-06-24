import React from 'react';
import { Spin } from 'antd';

interface LoadingSpinnerProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
  fullscreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'default',
  tip = '加载中...',
  fullscreen = false,
}) => {
  const style: React.CSSProperties = fullscreen
    ? {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '300px',
      }
    : {};

  return (
    <div style={style}>
      <Spin size={size} tip={tip} />
    </div>
  );
};

export default LoadingSpinner;
