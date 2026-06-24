/**
 * Landlord page — 房东管理中心
 *
 * 设计方向：极简专业风，大量留白，teal 色系，清晰排版层级
 */
import React, { useEffect, useState } from 'react';
import {
  Layout, Button, Table, Form, Input, InputNumber,
  Select, App, Card, Tag, Space, Row, Col, Statistic, Cascader, Empty, Typography, Badge, List,
} from 'antd';
import {
  PlusOutlined,
  HomeOutlined,
  MessageOutlined,
  BarChartOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  MailOutlined,
  CalendarOutlined,
  PhoneOutlined,
  UserOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { LandlordMessage } from '../services/landlord';
import { landlordApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Navbar } from '../components';
import DraggableModal from '../components/DraggableModal';
import LandlordCommunityDrawer from '../components/LandlordCommunityDrawer';

const { Content } = Layout;
const { Text } = Typography;

const Landlord: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [messages, setMessages] = useState<LandlordMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [districtTree, setDistrictTree] = useState<any[]>([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  // Building/Room management drawer
  const [buildingDrawerOpen, setBuildingDrawerOpen] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [selectedCommunityName, setSelectedCommunityName] = useState('');

  const fetchDistrictTree = async () => {
    try {
      const res = await landlordApi.getDistrictTree();
      if (res.success) setDistrictTree(res.data);
    } catch { /* fallback */ }
  };

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const result = await landlordApi.getMyCommunities();
      setCommunities(result.communities || []);
    } catch (err: any) { message.error(err.response?.data?.detail || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCommunities(); fetchDistrictTree(); loadMessages(); }, []);

  const loadMessages = async () => {
    setMessagesLoading(true);
    try {
      const res = await landlordApi.getMyMessages();
      if (res.success) setMessages(res.messages);
    } catch { /* ignore */ }
    finally { setMessagesLoading(false); }
  };

  const handleCreate = async (values: any) => {
    try {
      const cascaderValue = values.district;
      const payload = { ...values };
      if (Array.isArray(cascaderValue)) {
        payload.district_id = parseInt(cascaderValue[cascaderValue.length - 1], 10);
        delete payload.district;
      }
      await landlordApi.createCommunity(payload);
      message.success('小区发布成功');
      setModalOpen(false);
      form.resetFields();
      loadCommunities();
    } catch (err: any) { message.error(err.response?.data?.detail || '发布失败'); }
  };

  const columns = [
    {
      title: '小区名称', dataIndex: 'name', key: 'name',
      width: 180,
      render: (v: string) => <Text strong style={{ fontSize: 15 }}>{v}</Text>,
    },
    {
      title: '区域', dataIndex: 'district', key: 'district',
      render: (v: string) => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: '#0F766E', fontSize: 13 }} />
          <Text style={{ color: '#134E4A' }}>{v || '—'}</Text>
        </Space>
      ),
    },
    {
      title: '价格区间 (万)', key: 'price',
      render: (_: unknown, r: any) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.total_price_min ? `${r.total_price_min} — ${r.total_price_max || r.total_price_min}` : '—'}
        </Text>
      ),
    },
    {
      title: '面积 (㎡)', key: 'area',
      render: (_: unknown, r: any) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.area_min ? `${r.area_min} — ${r.area_max || r.area_min}` : '—'}
        </Text>
      ),
    },
    {
      title: '楼层', key: 'floor',
      render: (_: unknown, r: any) =>
        r.floor_min != null || r.floor_max != null
          ? <Tag color="geekblue" style={{ borderRadius: 20, border: 'none', padding: '2px 12px' }}>{r.floor_min ?? '—'} — {r.floor_max ?? '—'} 层</Tag>
          : <Text type="secondary">—</Text>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => (
        s === '在售'
          ? <Tag color="#0F766E" style={{ borderRadius: 20, border: 'none', padding: '2px 12px' }}>{s}</Tag>
          : <Tag style={{ borderRadius: 20 }}>{s}</Tag>
      ),
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, r: any) => (
        <Button
          type="link"
          size="small"
          icon={<BankOutlined />}
          onClick={() => {
            setSelectedCommunityId(r.id);
            setSelectedCommunityName(r.name);
            setBuildingDrawerOpen(true);
          }}
        >
          楼栋/房间
        </Button>
      ),
    },
  ];

  const total = communities.length;
  const available = communities.filter((c) => c.status === '在售').length;
  const avgPrice = communities.length > 0
    ? (communities.reduce((s, c) => s + (Number(c.total_price_min) || 0), 0) / communities.length).toFixed(0)
    : null;

  const statCardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: 'none',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(15,118,110,0.06), 0 1px 2px rgba(15,118,110,0.04)',
  };

  return (
    <Layout style={{ minHeight: '100dvh', background: '#F0FDFA' }}>
      <Navbar
        title="房东管理中心"
        showBack
        onBack={() => navigate('/')}
        extra={
          <Space size={12}>
            <Button icon={<ReloadOutlined />} onClick={() => { loadCommunities(); loadMessages(); }} style={{ borderRadius: 10 }}>
              刷新
            </Button>
            <Button type="primary" ghost icon={<MessageOutlined />} onClick={() => navigate('/chat')} style={{ borderRadius: 10 }}>
              智能咨询
            </Button>
            <Text strong style={{ fontSize: 14 }}>
              {user?.company_name || user?.full_name || user?.username}
            </Text>
          </Space>
        }
      />

      <Content style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Stats */}
        <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
          <Col xs={24} sm={8}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>小区总数</Text>}
                value={total}
                prefix={<HomeOutlined style={{ color: '#0F766E', fontSize: 22 }} />}
                styles={{ content: { fontSize: 32, fontWeight: 700, color: '#134E4A' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>在售中</Text>}
                value={available}
                prefix={<CheckCircleOutlined style={{ color: '#10b981', fontSize: 22 }} />}
                styles={{ content: { fontSize: 32, fontWeight: 700, color: '#134E4A' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>平均起价 (万)</Text>}
                value={avgPrice ?? '—'}
                prefix={<BarChartOutlined style={{ color: '#6366f1', fontSize: 22 }} />}
                styles={{ content: { fontSize: 32, fontWeight: 700, color: '#134E4A' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>新留言</Text>}
                value={messages.length}
                prefix={<MailOutlined style={{ color: '#0F766E', fontSize: 22 }} />}
                styles={{ content: { fontSize: 32, fontWeight: 700, color: '#134E4A' } }}
              />
            </Card>
          </Col>
        </Row>

        {/* Contact Messages */}
        <Card
          title={
            <Space>
              <MailOutlined style={{ color: '#0F766E' }} />
              <Text strong style={{ fontSize: 17, color: '#134E4A' }}>客户留言</Text>
              {messages.length > 0 && (
                <Badge count={messages.length} style={{ backgroundColor: '#0F766E' }} />
              )}
            </Space>
          }
          style={{ borderRadius: 16, border: 'none', boxShadow: '0 1px 3px rgba(15,118,110,0.06)', marginBottom: 32 }}
        >
          {messagesLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">加载中...</Text>
            </div>
          ) : messages.length === 0 ? (
            <Empty description="暂无客户留言" style={{ padding: 40 }} />
          ) : (
            <List
              dataSource={messages}
              renderItem={(msg: LandlordMessage) => (
                <List.Item style={{ padding: '16px 0', borderBottom: '1px solid rgba(15,118,110,0.06)' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Space size={12}>
                        <Space size={4}>
                          <UserOutlined style={{ color: '#0F766E', fontSize: 14 }} />
                          <Text strong style={{ fontSize: 14, color: '#134E4A' }}>{msg.guest_name}</Text>
                        </Space>
                        <Space size={4}>
                          <PhoneOutlined style={{ color: '#64748B', fontSize: 13 }} />
                          <Text style={{ fontSize: 13, color: '#64748B' }}>{msg.guest_phone}</Text>
                        </Space>
                      </Space>
                      <Space size={8}>
                        {msg.preferred_date && (
                          <Tag icon={<CalendarOutlined />} color="#0F766E" style={{ borderRadius: 20, border: 'none' }}>
                            {msg.preferred_date}
                          </Tag>
                        )}
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                          {msg.created_at ? new Date(msg.created_at).toLocaleString('zh-CN') : ''}
                        </Text>
                      </Space>
                    </div>
                    <div style={{
                      background: 'rgba(15,118,110,0.04)',
                      borderRadius: 12,
                      padding: '12px 16px',
                    }}>
                      <Text style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
                        {msg.message}
                      </Text>
                    </div>
                    {msg.community_id && (
                      <div style={{ marginTop: 6 }}>
                        <Tag color="blue" style={{ borderRadius: 20, border: 'none', fontSize: 12 }}>
                          关联小区 ID: {msg.community_id}
                        </Tag>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Table */}
        <Card
          title={<Text strong style={{ fontSize: 17, color: '#134E4A' }}>我的小区</Text>}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              style={{ borderRadius: 10, background: '#0F766E', borderColor: '#0F766E' }}
            >
              发布小区
            </Button>
          }
          style={{ borderRadius: 16, border: 'none', boxShadow: '0 1px 3px rgba(15,118,110,0.06)' }}
        >
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={communities}
            pagination={communities.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            locale={{ emptyText: <Empty description="暂无小区，点击上方按钮发布第一个" style={{ padding: 40 }} /> }}
            style={{ marginTop: -8 }}
          />
        </Card>

        {/* Building & Room Management Drawer */}
        <LandlordCommunityDrawer
          open={buildingDrawerOpen}
          communityId={selectedCommunityId}
          communityName={selectedCommunityName}
          onClose={() => setBuildingDrawerOpen(false)}
        />

        {/* Create Modal */}
        <DraggableModal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onCloseModal={() => setModalOpen(false)}
          title="发布新小区"
          footer={null}
          width={600}
          style={{ top: 80 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreate}
            initialValues={{ status: '在售' }}
            style={{ marginTop: 8 }}
          >
            <Row gutter={20}>
              <Col span={12}>
                <Form.Item name="name" label="小区名称" rules={[{ required: true, message: '请输入小区名称' }]}>
                  <Input placeholder="如：绿城·桂语江南" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="district" label="所属区域" rules={[{ required: true, message: '请选择区域' }]}>
                  <Cascader
                    options={districtTree}
                    placeholder="省 / 市 / 区"
                    changeOnSelect
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="详细地址">
              <Input placeholder="如：文一西路 588 号" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Row gutter={20}>
              <Col span={12}>
                <Form.Item label="主力楼层" style={{ marginBottom: 0 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="floor_min" noStyle rules={[{ type: 'number', min: 1, message: '请输入有效楼层' }]}>
                      <InputNumber placeholder="起始" min={1} style={{ width: '48%', borderRadius: 8 }} />
                    </Form.Item>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }}>—</span>
                    <Form.Item name="floor_max" noStyle rules={[{ type: 'number', min: 1, message: '请输入有效楼层' }]}>
                      <InputNumber placeholder="结束" min={1} style={{ width: '48%', borderRadius: 8 }} />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="decoration_status" label="装修">
                  <Select
                    options={[{ value: '毛坯', label: '毛坯' }, { value: '简装', label: '简装' }, { value: '精装', label: '精装' }]}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={20}>
              <Col span={8}>
                <Form.Item name="total_price_min" label="最低总价 (万)">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="total_price_max" label="最高总价 (万)">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="area_min" label="最小面积 (㎡)">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="metro_distance" label="距地铁 (米)">
              <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="description" label="小区简介">
              <Input.TextArea rows={3} placeholder="一句话描述小区特色、配套、卖点" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button onClick={() => setModalOpen(false)} style={{ borderRadius: 10 }}>取消</Button>
              <Button type="primary" htmlType="submit" style={{ borderRadius: 10, background: '#0F766E', borderColor: '#0F766E' }}>
                提交发布
              </Button>
            </Space>
          </Form>
        </DraggableModal>
      </Content>
    </Layout>
  );
};

export default Landlord;
