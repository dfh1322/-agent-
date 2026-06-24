import React from 'react';
import { RobotOutlined, PhoneOutlined } from '@ant-design/icons';

interface ConsultActionSheetProps {
  visible: boolean;
  onSelectAI: () => void;
  onSelectLandlord: () => void;
  onClose: () => void;
}

const ConsultActionSheet: React.FC<ConsultActionSheetProps> = ({
  visible,
  onSelectAI,
  onSelectLandlord,
  onClose,
}) => {
  if (!visible) return null;

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '16px 20px',
    marginBottom: 10,
    borderRadius: 14,
    border: '1px solid rgba(15,118,110,0.15)',
    background: 'rgba(15,118,110,0.04)',
    cursor: 'pointer',
    minHeight: 80,
    transition: 'all 150ms ease',
  };

  const iconCircleStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    color: '#fff',
    flexShrink: 0,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 32px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          animation: 'slideUp 250ms ease-out',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 32, height: 4, borderRadius: 2,
            background: 'rgba(15,118,110,0.25)',
          }} />
        </div>

        {/* Title */}
        <p style={{
          fontSize: 16, fontWeight: 600, color: '#134E4A',
          marginBottom: 4, textAlign: 'center',
        }}>
          请问您想如何咨询？
        </p>
        <p style={{
          fontSize: 13, color: '#64748B',
          marginBottom: 20, textAlign: 'center',
        }}>
          选择最适合您的方式
        </p>

        {/* AI Option */}
        <div
          style={optionStyle}
          onClick={() => { onSelectAI(); onClose(); }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(15,118,110,0.4)';
            e.currentTarget.style.background = 'rgba(15,118,110,0.08)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,118,110,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(15,118,110,0.15)';
            e.currentTarget.style.background = 'rgba(15,118,110,0.04)';
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div style={{ ...iconCircleStyle, background: 'linear-gradient(135deg, #0F766E, #14B8A6)' }}>
            <RobotOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#134E4A', marginBottom: 2 }}>
              AI 智能咨询
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              即时分析楼盘、匹配需求、计算贷款...
            </div>
          </div>
          <span style={{ color: '#0F766E', fontSize: 18 }}>→</span>
        </div>

        {/* Landlord Option */}
        <div
          style={optionStyle}
          onClick={() => { onSelectLandlord(); onClose(); }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(15,118,110,0.4)';
            e.currentTarget.style.background = 'rgba(15,118,110,0.08)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,118,110,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(15,118,110,0.15)';
            e.currentTarget.style.background = 'rgba(15,118,110,0.04)';
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div style={{ ...iconCircleStyle, background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}>
            <PhoneOutlined />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#134E4A', marginBottom: 2 }}>
              联系房东
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              获取联系方式、在线留言、预约看房...
            </div>
          </div>
          <span style={{ color: '#0F766E', fontSize: 18 }}>→</span>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 0',
            marginTop: 8,
            borderRadius: 12,
            border: 'none',
            background: 'transparent',
            color: '#64748B',
            fontSize: 14,
            cursor: 'pointer',
            minHeight: 44,
            transition: 'background 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default ConsultActionSheet;
