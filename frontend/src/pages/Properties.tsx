/**
 * Properties page — 楼盘智能匹配
 *
 * 优化要点：
 *   * 移除所有 emoji（🏠🤖💰等），全部替换为向量图标
 *   * CSS 变量驱动颜色，暗色模式原生支持
 *   * 毛玻璃卡片 + 统一 16px 圆角
 *   * 收藏按钮使用 HeartOutlined / HeartFilled 代替 LikeOutlined
 *   * 触摸友好的筛选控件
 */
import React, { useState, useEffect } from 'react';
import { Layout, Typography, Input, Button, Card, Row, Col, Space, Select, Slider, Tag, Badge, App, Empty } from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  EnvironmentOutlined,
  HeartFilled,
  HeartOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { chatApi, favoriteApi } from '../services/api';
import { Navbar } from '../components';
import ConsultActionSheet from '../components/ConsultActionSheet';
import LandlordContactDrawer from '../components/LandlordContactDrawer';
import type { AdminProperty } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const Properties: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [district, setDistrict] = useState<string>('');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [preference, setPreference] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [favoritedMap, setFavoritedMap] = useState<Record<number, boolean>>({});
  const [favoritingId, setFavoritingId] = useState<number | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<AdminProperty | null>(null);

  useEffect(() => { loadProperties(); loadFavorites(); }, []);

  const loadProperties = async () => {
    setFetching(true);
    try {
      const result = await chatApi.getCommunities();
      if (Array.isArray(result)) setProperties(result as any[]);
    } catch (error) { console.error('加载楼盘失败:', error); }
    finally { setFetching(false); }
  };

  const loadFavorites = async () => {
    try {
      const res = await favoriteApi.list();
      if (res.success) {
        const map: Record<number, boolean> = {};
        res.data.forEach((f: any) => { map[f.community_id] = true; });
        setFavoritedMap(map);
      }
    } catch { /* ignore */ }
  };

  const toggleFavorite = async (prop: AdminProperty) => {
    if (favoritedMap[prop.id!]) {
      try { await favoriteApi.remove(prop.id!); setFavoritedMap(prev => ({ ...prev, [prop.id!]: false })); message.success('已取消收藏'); }
      catch { message.error('取消收藏失败'); }
    } else {
      setFavoritingId(prop.id!);
      try { await favoriteApi.add(prop.id!); setFavoritedMap(prev => ({ ...prev, [prop.id!]: true })); message.success('已收藏'); }
      catch (err: any) { message.error(err.response?.data?.detail || '收藏失败'); }
      finally { setFavoritingId(null); }
    }
  };

  const filteredCommunities = properties.filter(prop => {
    const matchSearch = !searchText ||
      prop.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      prop.address?.toLowerCase().includes(searchText.toLowerCase());
    const matchDistrict = !district || prop.district === district;
    const matchPrice = (prop.total_price_max ?? 0) >= priceRange[0] && (prop.total_price_min ?? 0) <= priceRange[1];
    const matchRooms = true;
    return matchSearch && matchDistrict && matchPrice && matchRooms;
  });

  const handleRecommend = async () => {
    if (!preference.trim()) { message.warning('请先描述您的需求'); return; }
    setLoading(true);
    try {
      const result = await chatApi.recommendProperties(preference);
      if ((result as any).success) { setRecommendation((result as any).recommendation); message.success('AI推荐完成'); }
      else message.error((result as any).error || '推荐失败，请稍后重试');
    } catch { message.error('推荐失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const districts = Array.from(new Set(properties.map(p => p.district).filter(Boolean)));

  const cardStyles: React.CSSProperties = {
    marginBottom: 24, borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Navbar title="楼盘智能匹配" showBack onBack={() => navigate('/')} />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px' }}>
        {/* AI Recommendation */}
        <Card style={cardStyles}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff' }}>
                <RobotOutlined />
              </div>
              <div>
                <Title level={4} style={{ margin: 0, color: 'var(--color-ink)' }}>AI智能推荐</Title>
                <Text type="secondary">告诉我您的需求，AI为您推荐最合适的楼盘</Text>
              </div>
            </div>
            <TextArea
              placeholder="例如：我想找一个3室、地铁附近、500万左右的房子，最好在西湖区..."
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              rows={3}
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" size="large" icon={<RobotOutlined />}
                onClick={handleRecommend} loading={loading}
                style={{ borderRadius: 'var(--radius-md)', height: 44, padding: '0 32px' }}>
                获取AI推荐
              </Button>
            </div>
            {recommendation && (
              <Card style={{ background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 15, lineHeight: 1.8, color: 'var(--color-ink-secondary)' }}>
                  {recommendation}
                </Paragraph>
              </Card>
            )}
          </Space>
        </Card>

        {/* Filters */}
        <Card style={cardStyles}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Input placeholder="搜索楼盘名称或地址" prefix={<SearchOutlined />}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                size="large" style={{ borderRadius: 'var(--radius-md)' }} />
            </Col>
            <Col xs={24} sm={6} md={4}>
              <Select placeholder="选择区域" value={district || undefined} onChange={setDistrict}
                size="large" style={{ width: '100%', borderRadius: 'var(--radius-md)' }}>
                <Option value="">全部区域</Option>
                {districts.map(d => <Option key={d} value={d}>{d}</Option>)}
              </Select>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ padding: '0 12px' }}>
                <Text style={{ fontSize: 14, color: 'var(--color-ink-muted)', display: 'block', marginBottom: 4 }}>
                  价格范围: {priceRange[0]} - {priceRange[1]} 万元
                </Text>
                <Slider range min={0} max={1000} value={priceRange} onChange={setPriceRange} />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Results count */}
        <div style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)' }}>
            找到 <Text strong style={{ color: '#3b82f6' }}>{filteredCommunities.length}</Text> 个符合条件的房源
          </Text>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Text type="secondary">加载中...</Text>
          </div>
        ) : filteredCommunities.length > 0 ? (
          <Row gutter={[24, 24]}>
            {filteredCommunities.map(prop => (
              <Col xs={24} sm={12} lg={8} key={prop.id}>
                <Badge.Ribbon text={prop.status === '在售' ? '在售' : (prop.status || '推荐')} color={prop.status === '在售' ? '#ef4444' : '#3b82f6'}>
                  <Card hoverable className="glass-card"
                    style={{ overflow: 'hidden', height: '100%', border: '1px solid var(--color-border)' }}
                    cover={
                      <div style={{
                        height: 160,
                        background: 'var(--gradient-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 48, color: '#fff',
                      }}>
                        <EnvironmentOutlined />
                      </div>
                    }
                    actions={[
                      <Button type="link"
                        icon={favoritedMap[prop.id!] ? <HeartFilled style={{ color: '#ef4444' }} /> : <HeartOutlined />}
                        loading={favoritingId === prop.id}
                        onClick={() => toggleFavorite(prop)}
                        style={{ minHeight: 44 }}>
                        {favoritedMap[prop.id!] ? '已收藏' : '收藏'}
                      </Button>,
                      <Button
                        type="primary"
                        onClick={() => {
                          setSelectedCommunity(prop);
                          setActionSheetOpen(true);
                        }}
                        style={{ minHeight: 44 }}
                      >
                        咨询
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text strong style={{ fontSize: 18, color: 'var(--color-ink)' }}>{prop.name}</Text>
                          <Text strong style={{ color: '#ef4444', fontSize: 18 }}>
                            {prop.total_price_min && prop.total_price_max ? `${prop.total_price_min}-${prop.total_price_max}万` : '价格面议'}
                          </Text>
                        </Space>
                      }
                      description={
                        <div>
                          <Text style={{ display: 'block', marginBottom: 8, color: 'var(--color-ink-muted)' }}>
                            <EnvironmentOutlined style={{ marginRight: 4 }} />
                            {prop.district}{prop.address ? ` · ${prop.address}` : ''}
                          </Text>
                          <div style={{ marginBottom: 12 }}>
                            {prop.school_district && <Tag color="purple">学区</Tag>}
                            {prop.metro_distance && prop.metro_distance <= 1500 && <Tag color="blue">近地铁{prop.metro_distance}m</Tag>}
                            {prop.decoration_status && <Tag color="cyan">{prop.decoration_status}</Tag>}
                            {prop.green_rate && <Tag color="green">绿化率{prop.green_rate}%</Tag>}
                          </div>
                          <Text type="secondary">
                            {prop.area_min && prop.area_max ? `${prop.area_min}-${prop.area_max}㎡` : '面积待补充'}
                            {prop.price_per_sqm && ` · ${prop.price_per_sqm}元/㎡`}
                          </Text>
                        </div>
                      }
                    />
                  </Card>
                </Badge.Ribbon>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无符合条件的房源，试试调整筛选条件" style={{ padding: '60px 0' }} />
        )}
      </div>
      {/* Consult Action Sheet */}
      <ConsultActionSheet
        visible={actionSheetOpen}
        onSelectAI={() => {
          if (selectedCommunity) {
            navigate('/chat', {
              state: {
                communityName: selectedCommunity.name,
                communityId: selectedCommunity.id,
              },
            });
          }
        }}
        onSelectLandlord={() => setDrawerOpen(true)}
        onClose={() => setActionSheetOpen(false)}
      />

      {/* Landlord Contact Drawer */}
      <LandlordContactDrawer
        visible={drawerOpen}
        community={selectedCommunity}
        onClose={() => { setDrawerOpen(false); setSelectedCommunity(null); }}
      />
    </Layout>
  );
};

export default Properties;
