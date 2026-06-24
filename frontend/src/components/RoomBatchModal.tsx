import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Input, Radio, App } from 'antd';
import type { HouseType } from '../types/property';

interface RoomBatchModalProps {
  open: boolean;
  buildingId: number;
  houseTypes: HouseType[];
  selectedUnitIds: number[];
  onClose: () => void;
  onApplied: () => void;
  /** Override API — defaults to adminApi. Pass landlordApi for landlord views. */
  api?: {
    generateUnits: (buildingId: number, data: any) => Promise<any>;
    batchUpdateUnits: (unitIds: number[], updates: Record<string, unknown>) => Promise<any>;
  };
}

const RoomBatchModal: React.FC<RoomBatchModalProps> = ({
  open, buildingId, houseTypes, selectedUnitIds, onClose, onApplied,
  api,
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [mode, setMode] = useState<'status' | 'price' | 'generate'>(
    selectedUnitIds.length > 0 ? 'status' : 'generate',
  );

  const [resolvedApi, setResolvedApi] = useState<RoomBatchModalProps['api'] | null>(null);
  useEffect(() => {
    if (api) {
      setResolvedApi(api);
    } else {
      import('../services/api').then(m => setResolvedApi(m.adminApi));
    }
  }, [api]);

  const handleApply = async () => {
    if (!resolvedApi) return;
    const values = await form.validateFields();

    try {
      if (mode === 'generate') {
        const res = await resolvedApi.generateUnits(buildingId, {
          house_type_id: values.house_type_id,
          floor_start: values.floor_start,
          floor_end: values.floor_end,
          rooms_per_floor: values.rooms_per_floor ?? 2,
          room_number_pattern: values.room_number_pattern ?? '{floor}0{room}',
          area: values.area,
          total_price: values.total_price,
          orientation: values.orientation,
          status_tag: values.status_tag ?? '在售',
          price_floor_adjust: values.price_floor_adjust,
        });
        message.success(res.message);
      } else if (mode === 'status') {
        await resolvedApi.batchUpdateUnits(selectedUnitIds, { status_tag: values.status_tag });
        message.success(`已更新 ${selectedUnitIds.length} 个房间`);
      } else if (mode === 'price') {
        const sign = values.price_direction === 'up' ? '+' : '-';
        await resolvedApi.batchUpdateUnits(selectedUnitIds, { total_price_adjust: `${sign}${values.price_amount}` });
        message.success(`已更新 ${selectedUnitIds.length} 个房间`);
      }
      onApplied();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '操作失败');
    }
  };

  const hasSelection = selectedUnitIds.length > 0;

  return (
    <Modal
      title="批量操作"
      open={open}
      onOk={handleApply}
      onCancel={onClose}
      destroyOnHidden
      width={520}
    >
      {hasSelection && (
        <p style={{ marginBottom: 16, color: '#666' }}>
          已选择 <strong>{selectedUnitIds.length}</strong> 个房间
        </p>
      )}

      <Radio.Group
        value={mode}
        onChange={e => setMode(e.target.value)}
        style={{ marginBottom: 16 }}
      >
        <Radio.Button value="generate">批量生成房号</Radio.Button>
        <Radio.Button value="status" disabled={!hasSelection}>批量改状态</Radio.Button>
        <Radio.Button value="price" disabled={!hasSelection}>批量调价</Radio.Button>
      </Radio.Group>

      <Form form={form} layout="vertical">
        {mode === 'generate' && (
          <>
            <Form.Item name="house_type_id" label="户型" rules={[{ required: true, message: '请选择户型' }]}>
              <Select
                placeholder="选择户型"
                options={houseTypes.map(h => ({
                  value: h.id,
                  label: `${h.name} (${h.bedrooms}室${h.living_rooms}厅 ${h.area}㎡)`,
                }))}
              />
            </Form.Item>
            <Form.Item name="floor_start" label="起始楼层" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="floor_end" label="结束楼层" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="rooms_per_floor" label="每层户数" initialValue={2}>
              <InputNumber style={{ width: '100%' }} min={1} max={10} />
            </Form.Item>
            <Form.Item
              name="room_number_pattern"
              label="房间号模板"
              initialValue="{floor}0{room}"
              tooltip="{floor}=楼层, {floor2}=补零2位, {room}=户序号(1起)"
            >
              <Input placeholder="{floor}0{room} → 301, 302" />
            </Form.Item>
            <Form.Item name="total_price" label="统一售价 (万元)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="留空则继承户型参考价" />
            </Form.Item>
            <Form.Item name="price_floor_adjust" label="楼层差价 (万元/层)">
              <InputNumber style={{ width: '100%' }} step={0.1} placeholder="正数=越高越贵，留空=统一价" />
            </Form.Item>
            <Form.Item name="area" label="统一面积 (㎡)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="留空则继承户型面积" />
            </Form.Item>
            <Form.Item name="orientation" label="朝向">
              <Select
                allowClear
                placeholder="留空则继承户型朝向"
                options={[
                  { value: '南', label: '南' },
                  { value: '南北', label: '南北' },
                  { value: '东', label: '东' },
                  { value: '西', label: '西' },
                  { value: '东南', label: '东南' },
                  { value: '西南', label: '西南' },
                ]}
              />
            </Form.Item>
            <Form.Item name="status_tag" label="初始状态" initialValue="在售">
              <Select
                options={[
                  { value: '在售', label: '在售' },
                  { value: '待推', label: '待推' },
                ]}
              />
            </Form.Item>
          </>
        )}

        {mode === 'status' && (
          <Form.Item name="status_tag" label="目标状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: '在售', label: '在售' },
                { value: '已售', label: '已售' },
                { value: '预定', label: '预定' },
                { value: '待推', label: '待推' },
              ]}
            />
          </Form.Item>
        )}

        {mode === 'price' && (
          <>
            <Form.Item name="price_direction" label="调价方向" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'up', label: '涨价' },
                  { value: 'down', label: '降价' },
                ]}
              />
            </Form.Item>
            <Form.Item name="price_amount" label="调整金额 (万元)" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="如 5" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default RoomBatchModal;
