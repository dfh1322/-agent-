/**
 * EmptyChart - 图表占位
 *
 * 用于管理员/房东后台图表数据为空时的优雅占位，避免空白 Frame 给"bug"的错觉。
 *
 * Props:
 *   - title   : 图表内部标题（会显示在卡片头部）
 *   - message : 副标题/原因
 *   - action  : 右下角的"去添加"/"去处理" 按钮
 */
import React from 'react';
import { Card, Empty, Button } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { palette, radius, space } from '../theme';

export interface EmptyChartProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  height?: number;
}

const EmptyChart: React.FC<EmptyChartProps> = ({
  title,
  message = '暂无数据可展示',
  actionLabel,
  onAction,
  height = 220,
}) => {
  return (
    <Card
      variant="borderless"
      title={title}
      style={{
        borderRadius: radius.lg,
        boxShadow: palette.shadow.sm,
      }}
      styles={{ body: { padding: space.md } }}
    >
      <div
        style={{
          minHeight: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: space.md,
          color: palette.inkMuted,
        }}
      >
        <Empty
          image={
            <BulbOutlined style={{ fontSize: 48, color: palette.inkMuted, opacity: 0.5 }} />
          }
          styles={{ image: { height: 64 } }}
          description={message}
        />
        {actionLabel && onAction && (
          <Button type="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default EmptyChart;
