import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  tag: string;
  onClick: () => void;
  index?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, gradient, tag, onClick, index = 0 }) => {
  return (
    <div role="button" tabIndex={0} className="glass-card"
      style={{
        height: '100%', cursor: 'pointer', textAlign: 'center',
        padding: '32px 24px', animation: `fadeInUp 0.5s ease-out ${index * 0.08}s both`,
        background: 'var(--color-surface)',
      }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 18px', background: gradient,
        boxShadow: 'var(--shadow-md)', fontSize: 32, color: '#fff',
        transition: 'transform var(--motion-fast) var(--motion-easing)',
      }}>
        {icon}
      </div>
      <span style={{
        display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-pill)',
        background: gradient, color: '#fff', fontSize: '0.75rem', fontWeight: 600,
        marginBottom: 14, letterSpacing: '0.03em',
      }}>
        {tag}
      </span>
      <Title level={4} style={{ color: 'var(--color-ink)', marginBottom: 10 }}>{title}</Title>
      <Paragraph style={{ color: 'var(--color-ink-secondary)', fontSize: '0.9375rem', marginBottom: 0 }}>
        {description}
      </Paragraph>
    </div>
  );
};

export default FeatureCard;
