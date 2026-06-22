/**
 * StatKpiCard - 统计卡片
 *
 * 用于 Admin / Landlord 后台的 KPI 数字展示。设计要点：
 *   - 单一焦点：超大数字 + 单位 / 说明，辅助信息以 trend + delta 显示；
 *   - trend 可选 up/down/flat，配合 delta 百分比，前景色自动应用语义色；
 *   - 数字使用 tabular-nums 避免数字宽度跳动；
 *   - loading 时显示骨架；
 *   - 可选底部"迷你条形 / sparkline"趋势指示。
 *
 * Props 全部可选，便于直接由 antd Statistic 替代。
 */
import React from 'react';
import { Card, Skeleton, Typography } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { palette, radius, space, motion, text } from '../theme';

const { Text } = Typography;

export type TrendDirection = 'up' | 'down' | 'flat';

export interface SparkPoint {
  value: number;
  /** 可选 x 轴标签，hover 时显示 */
  label?: string;
}

export interface StatKpiCardProps {
  /** 指标名称 */
  title: string;
  /** 主数值（已格式化好的字符串） */
  value: string | number;
  /** 前缀图标节点 */
  icon?: React.ReactNode;
  /** 主数值下方辅助说明 */
  hint?: string;
  /** 趋势方向 */
  trend?: TrendDirection;
  /** 趋势变化值（百分比小数：0.18 = +18%） */
  trendValue?: number;
  /** 后缀单位 */
  suffix?: React.ReactNode;
  /** 微型趋势图（最近 N 个点的 value），纯 SVG 渲染 */
  sparkline?: number[];
  /** 主色调：primary / accent / success / warning */
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  onClick?: () => void;
}

const toneColor = (tone: StatKpiCardProps['tone']) => {
  switch (tone) {
    case 'accent': return palette.accent;
    case 'success': return palette.success;
    case 'warning': return palette.warning;
    case 'danger': return palette.danger;
    case 'primary':
    default: return palette.primary;
  }
};

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPath = `M0,${h} L ${points.replace(/ /g, ' L ')} L ${w},${h} Z`;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="趋势迷你图"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M0,${h} L ${points.replace(/ /g, ' L ')} L ${w},${h} Z`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const StatKpiCard: React.FC<StatKpiCardProps> = ({
  title,
  value,
  icon,
  hint,
  trend,
  trendValue,
  suffix,
  sparkline,
  tone = 'primary',
  loading,
  onClick,
}) => {
  const color = toneColor(tone);
  const TrendIcon =
    trend === 'up' ? ArrowUpOutlined : trend === 'down' ? ArrowDownOutlined : MinusOutlined;
  const trendColor =
    trend === 'up' ? palette.success
    : trend === 'down' ? palette.danger
    : palette.inkMuted;

  return (
    <Card
      variant="borderless"
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        borderRadius: radius.lg,
        boxShadow: palette.shadow.sm,
        background: palette.surface,
        transition: `box-shadow ${motion.fast} ${motion.easing}, transform ${motion.fast} ${motion.easing}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      styles={{ body: { padding: `${space.lg}px ${space.lg}px` } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md }}>
        {icon && (
          <div
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              background: `${color}1a`, // 10% opacity
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: text.caption.fontSize,
              color: palette.inkMuted,
              display: 'block',
              marginBottom: 6,
            }}
          >
            {title}
          </Text>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            {loading ? (
              <Skeleton.Input active size="small" style={{ width: 90, height: 28 }} />
            ) : (
              <span
                style={{
                  fontSize: 28,
                  fontWeight: text.heading.fontWeight,
                  color: palette.ink,
                  ...text.number,
                  lineHeight: 1.1,
                }}
              >
                {value}
              </span>
            )}
            {suffix && (
              <Text style={{ fontSize: text.caption.fontSize, color: palette.inkMuted }}>
                {suffix}
              </Text>
            )}
          </div>
          {(trend || hint) && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: space.sm }}>
              {trend && trendValue !== undefined && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: text.caption.fontSize,
                    color: trendColor,
                    fontWeight: text.subtitle.fontWeight,
                    background: `${trendColor}14`,
                    padding: '2px 8px',
                    borderRadius: radius.pill,
                  }}
                >
                  <TrendIcon style={{ fontSize: 10 }} />
                  {(trendValue * 100).toFixed(1)}%
                </span>
              )}
              {hint && (
                <Text style={{ fontSize: text.caption.fontSize, color: palette.inkMuted }}>
                  {hint}
                </Text>
              )}
            </div>
          )}
        </div>
        {sparkline && sparkline.length >= 2 && (
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Sparkline data={sparkline} color={color} />
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatKpiCard;
