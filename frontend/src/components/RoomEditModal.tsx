import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Alert } from 'antd';
import type { Unit, HouseType } from '../types/property';

interface RoomEditModalProps {
  open: boolean;
  buildingId: number;
  houseTypes: HouseType[];
  room: Unit | null;
  onClose: () => void;
  onSaved: () => void;
  /** Override API — defaults to adminApi. Pass landlordApi for landlord views. */
  api?: {
    updateUnit: (id: number, data: Partial<Unit>) => Promise<any>;
    createUnits: (buildingId: number, units: any[]) => Promise<any>;
  };
}

const RoomEditModal: React.FC<RoomEditModalProps> = ({
  open, buildingId, houseTypes, room, onClose, onSaved,
  api,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const isEdit = room !== null;

  // Lazy import to avoid module-level coupling
  const [resolvedApi, setResolvedApi] = React.useState<RoomEditModalProps['api'] | null>(api || null);
  const [apiReady, setApiReady] = React.useState(!!api);

  useEffect(() => {
    if (api) {
      setResolvedApi(api);
      setApiReady(true);
    } else {
      import('../services/api').then(m => {
        setResolvedApi(m.adminApi);
        setApiReady(true);
      });
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      if (room) {
        form.setFieldsValue({
          house_type_id: room.house_type_id,
          room_number: room.room_number,
          floor: room.floor,
          area: room.area,
          total_price: room.total_price,
          orientation: room.orientation,
          status_tag: room.status_tag,
          tags: room.tags?.join(', ') || '',
          description: room.description,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status_tag: '在售' });
      }
    }
  }, [open, room, form]);

  const handleSubmit = async () => {
    if (!resolvedApi) {
      message.warning('接口模块加载中，请稍后再试');
      return;
    }
    const values = await form.validateFields();
    const payload = {
      ...values,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
    };

    try {
      if (isEdit) {
        await resolvedApi.updateUnit(room!.id, payload);
        message.success('房间已更新');
      } else {
        await resolvedApi.createUnits(buildingId, [payload]);
        message.success('房间已创建');
      }
      onSaved();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑房间' : '添加房间'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical">
        {!isEdit && houseTypes.length === 0 && (
          <Alert
            type="warning"
            showIcon
            message="当前楼栋暂无户型"
            description="请先关闭此窗口，切换到「楼栋」Tab，选中楼栋后点击「添加户型」创建户型，然后才能添加房间。"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item name="house_type_id" label="户型" rules={[{ required: true, message: '请选择户型' }]}>
          <Select
            options={houseTypes.map(h => ({
              value: h.id,
              label: `${h.name} (${h.bedrooms}室${h.living_rooms}厅 ${h.area}㎡)`,
            }))}
            placeholder={houseTypes.length === 0 ? '无可用户型，请先添加户型' : '选择户型'}
            disabled={houseTypes.length === 0}
          />
        </Form.Item>
        <Form.Item name="room_number" label="房间号" rules={[{ required: true, message: '请输入房间号' }]}>
          <Input placeholder="如 301, 3-1-01, A-1501" maxLength={20} />
        </Form.Item>
        <Form.Item name="floor" label="楼层">
          <InputNumber placeholder="所在楼层" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="area" label="面积 (㎡)">
          <InputNumber placeholder="实际面积" style={{ width: '100%' }} min={0} step={0.01} />
        </Form.Item>
        <Form.Item name="total_price" label="售价 (万元)">
          <InputNumber placeholder="实际售价" style={{ width: '100%' }} min={0} step={0.01} />
        </Form.Item>
        <Form.Item name="orientation" label="朝向">
          <Select
            allowClear
            placeholder="朝向"
            options={[
              { value: '南', label: '南' },
              { value: '南北', label: '南北' },
              { value: '东', label: '东' },
              { value: '西', label: '西' },
              { value: '东南', label: '东南' },
              { value: '西南', label: '西南' },
              { value: '东北', label: '东北' },
              { value: '西北', label: '西北' },
            ]}
          />
        </Form.Item>
        <Form.Item name="status_tag" label="状态">
          <Select
            options={[
              { value: '在售', label: '在售' },
              { value: '已售', label: '已售' },
              { value: '预定', label: '预定' },
              { value: '待推', label: '待推' },
            ]}
          />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Input placeholder="逗号分隔，如: 边套, 花园, 景观房" />
        </Form.Item>
        <Form.Item name="description" label="备注">
          <Input.TextArea rows={2} placeholder="如: 端户采光好" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoomEditModal;
