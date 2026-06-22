/**
 * ReportView - 报告预览页面
 * 从 URL 参数获取报告 ID，渲染 ReportPreview 组件
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReportPreview from '../components/ReportPreview';
import type { ReportData } from '../components/ReportPreview';

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 localStorage 加载报告数据
    // 实际项目中可以从 API 获取
    if (id) {
      try {
        const stored = localStorage.getItem(`report_${id}`);
        if (stored) {
          setReport(JSON.parse(stored));
        } else {
          // 如果没有存储的报告，创建一个示例
          setReport({
            title: '个性化置业方案',
            userNeeds: '请查看您的置业方案',
            recommendedProperties: [],
            budgetAdvice: '',
            overallAdvice: '',
            generatedAt: new Date().toLocaleString('zh-CN'),
          });
        }
      } catch {
        setReport(null);
      }
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ fontSize: '18px', color: '#999' }}>加载报告中...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', flexDirection: 'column' }}>
        <div style={{ fontSize: '48px', marginBottom: 16 }}>📄</div>
        <div style={{ fontSize: '18px', color: '#999', marginBottom: 24 }}>报告不存在</div>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          返回首页
        </button>
      </div>
    );
  }

  return <ReportPreview report={report} />;
}
