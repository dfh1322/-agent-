import React, { useEffect, useState } from 'react';
import {
  Drawer, Form, Input, DatePicker, Button, Typography,
  Skeleton, Tooltip, App, Space,
} from 'antd';
import {
  PhoneOutlined,
  WechatOutlined,
  EnvironmentOutlined,
  CopyOutlined,
  UserOutlined,
  SendOutlined,
  CloseOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { landlordApi, type ContactInfo } from '../services/landlord';
import type { AdminProperty } from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface LandlordContactDrawerProps {
  visible: boolean;
  property: AdminProperty | null;
  onClose: () => void;
}

const LandlordContactDrawer: React.FC<LandlordContactDrawerProps> = ({
  visible,
  property,
  onClose,
}) => {
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [width, setWidth] = useState(420);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    const check = () => setWidth(window.innerWidth < 768 ? window.innerWidth : 420);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (visible && property?.owner_id) {
      setLoading(true);
      setContact(null);
      setSubmitted(false);
      form.resetFields();
      landlordApi
        .getContactInfo(property.owner_id)
        .then((res) => {
          if (res.success) setContact(res.data);
        })
        .catch(() => {
          message.error('加载房东信息失败');
        })
        .finally(() => setLoading(false));
    }
  }, [visible, property, form, message]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制到剪贴板'),
      () => message.error('复制失败'),
    );
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!property?.owner_id) return;
    setSubmitting(true);
    try {
      const preferredDate = values.preferred_date
        ? (values.preferred_date as { format: (fmt: string) => string }).format('YYYY-MM-DD')
        : undefined;
      const res = await landlordApi.submitContactMessage({
        landlord_id: property.owner_id,
        property_id: property.id,
        guest_name: values.guest_name as string,
        guest_phone: values.guest_phone as string,
        message: values.message as string,
        preferred_date: preferredDate,
      });
      if (res.success) {
        setSubmitted(true);
        message.success(res.message || '留言已发送');
      } else {
        message.error('提交失败，请稍后重试');
      }
    } catch {
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const contactCardStyle: React.CSSProperties = {
    padding: 20,
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(15,118,110,0.06), rgba(20,184,166,0.03))',
    border: '1px solid rgba(15,118,110,0.12)',
    marginBottom: 24,
  };

  const contactRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    minHeight: 44,
    borderBottom: '1px solid rgba(15,118,110,0.06)',
  };

  const submitBtnStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    background: 'linear-gradient(135deg, #0F766E, #14B8A6)',
    boxShadow: '0 4px 16px rgba(15,118,110,0.25)',
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SendOutlined style={{ color: '#0F766E', fontSize: 18 }} />
          <span style={{ color: '#134E4A', fontWeight: 600 }}>联系房东</span>
        </div>
      }
      placement="right"
      size="large"
      open={visible}
      onClose={onClose}
      closeIcon={<CloseOutlined style={{ color: '#134E4A' }} />}
      styles={{
        body: { padding: '20px 24px', background: '#F0FDFA' },
        header: {
          borderBottom: '1px solid rgba(15,118,110,0.1)',
          background: '#F0FDFA',
        },
      }}
      width={width}
    >
      {/* Loading skeleton */}
      {loading && (
        <div style={{ padding: 20 }}>
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        </div>
      )}

      {/* Contact info card */}
      {!loading && contact && (
        <div style={contactCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0F766E, #14B8A6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22,
            }}>
              {contact.full_name?.[0] || <UserOutlined />}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#134E4A' }}>
                {contact.full_name || '房东'}
              </div>
              {contact.company_name && (
                <div style={{ fontSize: 13, color: '#64748B' }}>
                  {contact.company_name}
                </div>
              )}
            </div>
          </div>

          {contact.phone_masked && (
            <div style={contactRowStyle}>
              <Space>
                <PhoneOutlined style={{ color: '#0F766E', fontSize: 16 }} />
                <Text style={{ fontSize: 14, color: '#134E4A' }}>
                  {contact.phone_masked}
                </Text>
              </Space>
              {contact.phone_raw && (
                <Tooltip title={contact.phone_raw}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(contact.phone_raw)}
                    style={{ color: '#0F766E', minWidth: 44, minHeight: 44 }}
                  />
                </Tooltip>
              )}
            </div>
          )}

          {contact.wechat && (
            <div style={contactRowStyle}>
              <Space>
                <WechatOutlined style={{ color: '#0F766E', fontSize: 16 }} />
                <Text style={{ fontSize: 14, color: '#134E4A' }}>
                  微信号: {contact.wechat}
                </Text>
              </Space>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(contact.wechat)}
                style={{ color: '#0F766E', minWidth: 44, minHeight: 44 }}
              />
            </div>
          )}

          {contact.address && (
            <div style={contactRowStyle}>
              <Space>
                <EnvironmentOutlined style={{ color: '#0F766E', fontSize: 16 }} />
                <Text style={{ fontSize: 14, color: '#134E4A' }}>
                  {contact.address}
                </Text>
              </Space>
            </div>
          )}
        </div>
      )}

      {/* Fallback: no contact info */}
      {!loading && !contact && (
        <div style={{
          textAlign: 'center', padding: 24,
          color: '#94A3B8', fontSize: 14,
        }}>
          暂未公开联系方式，您可以通过下方表单留言
        </div>
      )}

      {/* Message form */}
      <div style={{
        padding: 20,
        borderRadius: 16,
        background: '#FFFFFF',
        border: '1px solid rgba(15,118,110,0.1)',
      }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #0F766E, #14B8A6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#fff', fontSize: 28,
            }}>
              ✓
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#134E4A', marginBottom: 4 }}>
              留言已发送
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              房东将尽快与您联系
            </div>
            <Button
              type="link"
              onClick={() => { setSubmitted(false); form.resetFields(); }}
              style={{ marginTop: 16, color: '#0F766E' }}
            >
              再次留言
            </Button>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark="optional"
          >
            <Form.Item
              name="guest_name"
              label="您的姓名"
              rules={[{ required: true, message: '请输入您的姓名' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                placeholder="请输入您的姓名"
                style={{ borderRadius: 10, height: 44 }}
              />
            </Form.Item>

            <Form.Item
              name="guest_phone"
              label="联系电话"
              rules={[
                { required: true, message: '请输入您的手机号' },
                { pattern: /^1\d{10}$/, message: '请输入正确的手机号' },
              ]}
            >
              <Input
                prefix={<PhoneOutlined style={{ color: '#94A3B8' }} />}
                placeholder="请输入您的手机号"
                style={{ borderRadius: 10, height: 44 }}
                maxLength={11}
              />
            </Form.Item>

            <Form.Item label="意向楼盘">
              <Input
                value={property?.name || ''}
                disabled
                style={{ borderRadius: 10, height: 44 }}
              />
            </Form.Item>

            <Form.Item
              name="message"
              label="留言内容"
              rules={[{ required: true, message: '请输入留言内容' }]}
            >
              <TextArea
                placeholder="我对这个楼盘很感兴趣，想了解一下..."
                rows={4}
                maxLength={2000}
                showCount
                style={{ borderRadius: 10 }}
              />
            </Form.Item>

            <Form.Item name="preferred_date" label="期望看房日期">
              <DatePicker
                style={{ width: '100%', borderRadius: 10, height: 44 }}
                placeholder="选择日期（可选）"
                suffixIcon={<CalendarOutlined style={{ color: '#94A3B8' }} />}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 4 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<SendOutlined />}
                style={submitBtnStyle}
              >
                发送留言
              </Button>
            </Form.Item>

            <Paragraph style={{
              textAlign: 'center', fontSize: 12, color: '#94A3B8',
              marginTop: 8, marginBottom: 0,
            }}>
              您的信息仅房东可见
            </Paragraph>
          </Form>
        )}
      </div>
    </Drawer>
  );
};

export default LandlordContactDrawer;
