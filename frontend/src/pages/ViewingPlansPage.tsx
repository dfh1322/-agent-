/**
 * ViewingPlans page — 看房计划
 *
 * 优化要点：
 *   * 使用 Navbar 组件保持一致导航
 *   * CSS 变量驱动所有颜色，暗色模式自动适配
 *   * 统一卡片样式，移除 emoji
 *   * 触摸友好的表单控件 (min 44px tap targets)
 */
import { useState, useEffect } from 'react';
import { viewingPlanApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components';
import { CalendarOutlined, EnvironmentOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

export default function ViewingPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [propertyIds, setPropertyIds] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const res = await viewingPlanApi.list();
      if (res.success) setPlans(res.data);
    } catch (err) { console.error('加载看房计划失败:', err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!title.trim()) { alert('请输入计划标题'); return; }
    const ids = propertyIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length === 0) { alert('请输入至少一个楼盘ID（用逗号分隔）'); return; }
    try {
      await viewingPlanApi.create({ title, property_ids: ids, plan_date: planDate || undefined, notes: notes || undefined });
      setShowForm(false); setTitle(''); setPropertyIds(''); setPlanDate(''); setNotes('');
      loadPlans();
    } catch (err: any) { alert(err.response?.data?.detail || '创建失败'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除此看房计划？')) return;
    try { await viewingPlanApi.delete(id); loadPlans(); }
    catch { alert('删除失败'); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)', fontSize: 14, boxSizing: 'border-box', marginBottom: 12,
    background: 'var(--color-surface)', color: 'var(--color-ink)', minHeight: 44,
  };

  const btnPrimary: React.CSSProperties = {
    background: 'var(--gradient-primary)', color: '#fff', border: 'none',
    padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60dvh' }}>
      <div style={{ fontSize: 18, color: 'var(--color-ink-muted)' }}>加载中...</div>
    </div>;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="看房计划" showBack onBack={() => navigate('/')} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: '1.5rem', fontWeight: 600 }}>看房计划</h2>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : (<><PlusOutlined style={{ marginRight: 6 }} />新建计划</>)}
          </button>
        </div>

        {showForm && (
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--color-ink)' }}>新建看房计划</h3>
            <input style={inputStyle} placeholder="计划标题（如：周末看房）" value={title} onChange={e => setTitle(e.target.value)} />
            <input style={inputStyle} placeholder="楼盘ID（用逗号分隔，如：1,3,5）" value={propertyIds} onChange={e => setPropertyIds(e.target.value)} />
            <input style={inputStyle} type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} />
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
              placeholder="备注（可选）"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button style={btnPrimary} onClick={handleCreate}>创建计划</button>
          </div>
        )}

        {plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-ink-muted)' }}>
            <CalendarOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block', color: 'var(--color-ink-muted)' }} />
            <p>还没有看房计划</p>
          </div>
        ) : (
          plans.map(plan => (
            <div key={plan.id} style={{
              background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
              padding: 20, marginBottom: 16, boxShadow: 'var(--shadow-sm)',
              borderLeft: '4px solid #3b82f6',
              border: '1px solid var(--color-border)',
              opacity: plan.status === 'completed' ? 0.65 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--color-ink)' }}>{plan.title}</h4>
                  {plan.plan_date && <span style={{ fontSize: 13, color: 'var(--color-ink-muted)' }}><CalendarOutlined style={{ marginRight: 4 }} />{plan.plan_date}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 500,
                    background: plan.status === 'completed' ? '#f6ffed' : '#fff7e6',
                    color: plan.status === 'completed' ? '#10b981' : '#f59e0b',
                  }}>
                    {plan.status === 'completed' ? '已完成' : '待看房'}
                  </span>
                  <button onClick={() => handleDelete(plan.id)} style={{
                    background: 'none', border: '1px solid #ffccc7', color: '#ef4444',
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, minHeight: 36,
                  }}>
                    <DeleteOutlined />
                  </button>
                </div>
              </div>
              {plan.property_names && plan.property_names.length > 0 && (
                <div style={{ margin: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {plan.property_names.map((name: string, i: number) => (
                    <span key={i} style={{
                      background: 'var(--color-surface-muted)', color: '#3b82f6',
                      padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 13,
                      border: '1px solid var(--color-border)',
                    }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />{name}
                    </span>
                  ))}
                </div>
              )}
              {plan.notes && <div style={{ fontSize: 13, color: 'var(--color-ink-secondary)', marginTop: 8 }}>{plan.notes}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
