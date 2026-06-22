import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import './index.css';
import App from './App.tsx';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#c00', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>运行时错误</h2>
          <pre>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// 用 ``<App>`` 包根组件——AntD v5 的 message.* / notification.* 必须挂
// 在 App 子树内才能读取 Theme context 与静态 token。组件内部请改用
// ``const { message, notification } = App.useApp();`` 获取实例。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AntdApp>
        <App />
      </AntdApp>
    </ErrorBoundary>
  </StrictMode>,
);
