import React, { useState, useEffect, useRef } from 'react';
import { Avatar, Card, Tag, Typography } from 'antd';
import { UserOutlined, RobotOutlined, ToolOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  properties?: Array<{
    id: number;
    name: string;
    district: string;
    price_range: string;
    area_range: string;
    decoration?: string;
    green_rate?: string;
    metro?: string;
    school?: string;
  }>;
  toolCalls?: Array<{ tool: string; input: string; observation?: string }>;
  isTyping?: boolean;
  typeSpeed?: number;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  role, content, timestamp, properties, toolCalls,
  isTyping = false, typeSpeed = 0,
}) => {
  const isUser = role === 'user';
  const [visibleChars, setVisibleChars] = useState(typeSpeed > 0 ? 0 : content.length);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeSpeed <= 0 || !content) { setVisibleChars(content.length); return; }
    setVisibleChars(0);
    let idx = 0;
    timerRef.current = setInterval(() => {
      idx++;
      setVisibleChars(idx);
      if (idx >= content.length && timerRef.current) clearInterval(timerRef.current);
    }, typeSpeed);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [content, typeSpeed]);

  const displayText = typeSpeed > 0 ? content.slice(0, visibleChars) : content;
  const showCursor = typeSpeed > 0 && visibleChars < content.length;

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start', maxWidth: '75%' }}>
        <Avatar
          size={40}
          style={{
            background: isUser ? 'var(--gradient-primary)' : 'var(--gradient-card2)',
            marginRight: isUser ? 0 : 10,
            marginLeft: isUser ? 10 : 0,
            flexShrink: 0,
          }}
          icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        />
        <div>
          <Card
            style={{
              background: isUser ? 'var(--gradient-primary)' : 'var(--color-surface)',
              color: isUser ? '#fff' : 'var(--color-ink)',
              borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              border: 'none',
              boxShadow: 'var(--shadow-md)',
            }}
            styles={{ body: { padding: '14px 18px' } }}
          >
            {isTyping ? (
              <div className="typing-dots"><span /><span /><span /></div>
            ) : (
              <>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6 }}>
                  {displayText}
                  {showCursor && <span className="typewriter-cursor">|</span>}
                </Paragraph>

                {toolCalls && toolCalls.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                    {toolCalls.map((tc, i) => (
                      <Tag key={i} color="gold" style={{ marginBottom: 4, fontSize: 12 }}>
                        <ToolOutlined style={{ marginRight: 4 }} />{tc.tool}
                      </Tag>
                    ))}
                  </div>
                )}

                {properties && properties.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text strong style={{ fontSize: 14, color: 'var(--color-ink)' }}>推荐楼盘：</Text>
                    {properties.map((prop, index) => (
                      <Card key={prop.id || index} size="small" style={{ marginBottom: 8, marginTop: 4, background: 'var(--color-surface-muted)' }}>
                        <Text strong style={{ color: 'var(--color-ink)' }}>{prop.name}</Text>
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          <Tag color="blue">{prop.district}</Tag>
                          <Tag color="green">{prop.price_range}</Tag>
                          <Tag color="orange">{prop.area_range}</Tag>
                          {prop.school && <Tag color="purple">学区房</Tag>}
                          {prop.metro && <Tag color="cyan">近地铁</Tag>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
            <Text style={{ fontSize: 12, opacity: 0.6, marginTop: 8, display: 'block', color: isUser ? 'rgba(255,255,255,0.8)' : 'var(--color-ink-muted)' }}>
              {timestamp?.toLocaleTimeString() || ''}
            </Text>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
