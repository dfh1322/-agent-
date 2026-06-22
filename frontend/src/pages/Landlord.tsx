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
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { LandlordMessage } from '../services/landlord';
import { landlordApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Navbar } from '../components';
import DraggableModal from '../components/DraggableModal';

const { Content } = Layout;
const { Text } = Typography;

const Landlord: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [messages, setMessages] = useState<LandlordMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [districtTree, setDistrictTree] = useState<any[]>([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const fetchDistrictTree = async () => {
    try {
      const res = await landlordApi.getDistrictTree();
      if (res.success) setDistrictTree(res.data);
    } catch { /* fallback */ }
  };

  const loadProperties = async () => {
    setLoading(true);
    try {
      const result = await landlordApi.getMyProperties();
      setProperties(result.properties || []);
    } catch (err: any) { message.error(err.response?.data?.detail || '加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProperties(); fetchDistrictTree(); loadMessages(); }, []);

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
      await landlordApi.createProperty(payload);
      message.success('楼盘发布成功');
      setModalOpen(false);
      form.resetFields();
      loadProperties();
    } catch (err: any) { message.error(err.response?.data?.detail || '发布失败'); }
  };

  const columns = [
    {
      title: '楼盘名称', dataIndex: 'name', key: 'name',
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
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => (
        s === '在售'
          ? <Tag color="#0F766E" style={{ borderRadius: 20, border: 'none', padding: '2px 12px' }}>{s}</Tag>
          : <Tag style={{ borderRadius: 20 }}>{s}</Tag>
      ),
    },
  ];

  const total = properties.length;
  const available = properties.filter((p) => p.status === '在售').length;
  const avgPrice = properties.length > 0
    ? (properties.reduce((s, p) => s + (Number(p.total_price_min) || 0), 0) / properties.length).toFixed(0)
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
            <Button icon={<ReloadOutlined />} onClick={() => { loadProperties(); loadMessages(); }} style={{ borderRadius: 10 }}>
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
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>楼盘总数</Text>}
                value={total}
                prefix={<HomeOutlined style={{ color: '#0F766E', fontSize: 22 }} />}
                valueStyle={{ fontSize: 32, fontWeight: 700, color: '#134E4A' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>在售中</Text>}
                value={available}
                prefix={<CheckCircleOutlined style={{ color: '#10b981', fontSize: 22 }} />}
                valueStyle={{ fontSize: 32, fontWeight: 700, color: '#134E4A' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>平均起价 (万)</Text>}
                value={avgPrice ?? '—'}
                prefix={<BarChartOutlined style={{ color: '#6366f1', fontSize: 22 }} />}
                valueStyle={{ fontSize: 32, fontWeight: 700, color: '#134E4A' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card style={statCardStyle}>
              <Statistic
                title={<Text style={{ fontSize: 13, color: '#5B8A87' }}>新留言</Text>}
                value={messages.length}
                prefix={<MailOutlined style={{ color: '#0F766E', fontSize: 22 }} />}
                valueStyle={{ fontSize: 32, fontWeight: 700, color: '#134E4A' }}
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
                    {msg.property_id && (
                      <div style={{ marginTop: 6 }}>
                        <Tag color="blue" style={{ borderRadius: 20, border: 'none', fontSize: 12 }}>
                          关联楼盘 ID: {msg.property_id}
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
          title={<Text strong style={{ fontSize: 17, color: '#134E4A' }}>我的楼盘</Text>}
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              style={{ borderRadius: 10, background: '#0F766E', borderColor: '#0F766E' }}
            >
              发布楼盘
            </Button>
          }
          style={{ borderRadius: 16, border: 'none', boxShadow: '0 1px 3px rgba(15,118,110,0.06)' }}
        >
          <Table
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={properties}
            pagination={properties.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
            locale={{ emptyText: <Empty description="暂无楼盘，点击上方按钮发布第一个" style={{ padding: 40 }} /> }}
            style={{ marginTop: -8 }}
          />
        </Card>

        {/* Create Modal */}
        <DraggableModal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onCloseModal={() => setModalOpen(false)}
          title="发布新楼盘"
          footer={null}
          width={600}
          initialOffset={{ x: 0, y: 60 }}
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
                <Form.Item name="name" label="楼盘名称" rules={[{ required: true, message: '请输入楼盘名称' }]}>
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
                <Form.Item name="area_min" label="最小面积 (㎡)">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="area_max" label="最大面积 (㎡)">
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="green_rate" label="绿化率 (%)">
                  <InputNumber min={0} max={100} style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="metro_distance" label="距地铁 (米)">
              <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="description" label="楼盘简介">
              <Input.TextArea rows={3} placeholder="一句话描述楼盘特色、配套、卖点" style={{ borderRadius: 8 }} />
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
