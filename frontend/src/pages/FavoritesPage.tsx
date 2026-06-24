/**
 * Favorites page — 我的收藏
 *
 * 优化要点：
 *   * 使用 Navbar 组件保持一致导航
 *   * CSS 变量驱动所有颜色，暗色模式自动适配
 *   * 统一卡片样式，移除 emoji（🏠💰📐📝）
 *   * 触摸友好的操作按钮 (min 44px tap area)
 */
import { useState, useEffect } from 'react';
import { favoriteApi } from '../services/api';
import type { FavoriteItem } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components';
import { EnvironmentOutlined, DollarOutlined, ExpandOutlined, HeartFilled } from '@ant-design/icons';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFavorites(); }, []);

  const loadFavorites = async () => {
    try {
      const res = await favoriteApi.list();
      if (res.success) setFavorites(res.data);
    } catch (err) { console.error('加载收藏失败:', err); }
    finally { setLoading(false); }
  };

  const handleRemove = async (fav: FavoriteItem) => {
    if (!window.confirm(`确定要取消收藏「${fav.community_name}」吗？`)) return;
    try {
      await favoriteApi.remove(fav.community_id);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
    } catch { alert('取消收藏失败'); }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60dvh' }}>
      <div style={{ fontSize: 18, color: 'var(--color-ink-muted)' }}>加载中...</div>
    </div>;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="我的收藏" showBack onBack={() => navigate('/')} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        <h2 style={{ marginBottom: 24, color: 'var(--color-ink)', fontSize: '1.5rem', fontWeight: 600 }}>我的收藏</h2>

        {favorites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-ink-muted)' }}>
            <HeartFilled style={{ fontSize: 48, marginBottom: 16, display: 'block', color: 'var(--color-ink-muted)' }} />
            <p>还没有收藏任何楼盘</p>
            <button onClick={() => navigate('/properties')} style={{
              marginTop: 16, background: 'var(--gradient-primary)', color: '#fff',
              border: 'none', padding: '10px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 14,
            }}>
              去浏览楼盘
            </button>
          </div>
        ) : (
          favorites.map(fav => (
            <div key={fav.id} className="glass-card" style={{
              borderRadius: 'var(--radius-lg)',
              padding: 20, marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate('/properties')}>
                <h4 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--color-ink)' }}>{fav.community_name}</h4>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-ink-muted)', flexWrap: 'wrap' }}>
                  {fav.property?.district && (
                    <span><EnvironmentOutlined style={{ marginRight: 4 }} />{fav.property.district}</span>
                  )}
                  {fav.property?.total_price_min && fav.property?.total_price_max && (
                    <span><DollarOutlined style={{ marginRight: 4 }} />{fav.property.total_price_min}-{fav.property.total_price_max}万</span>
                  )}
                  {fav.property?.area_min && fav.property?.area_max && (
                    <span><ExpandOutlined style={{ marginRight: 4 }} />{fav.property.area_min}-{fav.property.area_max}㎡</span>
                  )}
                </div>
                {fav.notes && <div style={{ fontSize: 13, color: 'var(--color-ink-secondary)', fontStyle: 'italic', marginTop: 4 }}>{fav.notes}</div>}
              </div>
              <button onClick={() => handleRemove(fav)} style={{
                background: '#fff1f0', color: '#ef4444', border: '1px solid #ffccc7',
                padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontSize: 13, whiteSpace: 'nowrap', minHeight: 44, transition: 'all var(--motion-fast)',
              }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#ef4444'; (e.target as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#fff1f0'; (e.target as HTMLElement).style.color = '#ef4444'; }}
              >
                取消收藏
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
