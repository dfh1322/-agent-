/**
 * App.tsx - 应用根组件
 */
import React, { Suspense } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppRoutes } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

const PageFallback = (
  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#6366f1',
            colorLink: '#6366f1',
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            borderRadius: 8,
            fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
          },
        }}
      >
        <Router>
          <Suspense fallback={PageFallback}>
            <AppRoutes />
          </Suspense>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
