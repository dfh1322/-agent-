import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, Tabs, Button, App, Space, Table, Tag, Popconfirm, Modal, Form, InputNumber, Select, Input, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { landlordApi } from '../services/api';
import type { Building, HouseType } from '../types/property';
import RoomManager from '../pages/admin/RoomManager';

interface LandlordCommunityDrawerProps {
  open: boolean;
  communityId: number | null;
  communityName: string;
  onClose: () => void;
}

const BUILDING_TYPES = ['板楼', '塔楼', '板塔结合', '联排', '独栋'];

const LandlordCommunityDrawer: React.FC<LandlordCommunityDrawerProps> = ({
  open, communityId, communityName, onClose,
}) => {
  const { message } = App.useApp();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [buildingHouseTypes, setBuildingHouseTypes] = useState<Record<number, HouseType[]>>({});
  const [activeTab, setActiveTab] = useState<string>('buildings');

  // add building modal
  const [addBuildingOpen, setAddBuildingOpen] = useState(false);
  const [addBuildingForm] = Form.useForm();

  // add house type modal
  const [addHouseTypeOpen, setAddHouseTypeOpen] = useState(false);
  const [addHouseTypeForm] = Form.useForm();
  const [houseTypeBuildingId, setHouseTypeBuildingId] = useState<number | null>(null);

  const landlordUnitApi = {
    listUnits: async (buildingId: number, params?: any) => {
      const res = await landlordApi.listUnits(buildingId, params);
      return res;
    },
    deleteUnit: async (id: number) => {
      const res = await landlordApi.deleteUnit(id);
      return res;
    },
    updateUnit: async (id: number, data: any) => {
      const res = await landlordApi.updateUnit(id, data);
      return res;
    },
    createUnits: async (buildingId: number, units: any[]) => {
      const res = await landlordApi.createUnits(buildingId, units);
      return res;
    },
    batchUpdateUnits: async (ids: number[], updates: Record<string, unknown>) => {
      const res = await landlordApi.batchUpdateUnits(ids, updates);
      return res;
    },
  };

  const fetchBuildings = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    try {
      const res = await landlordApi.getCommunity(communityId);
      if ((res as any).success) {
        const blds = ((res as any).community?.buildings || []) as Building[];
        setBuildings(blds);
        const htMap: Record<number, HouseType[]> = {};
        blds.forEach((b: Building) => {
          htMap[b.id] = b.house_types || [];
        });
        setBuildingHouseTypes(htMap);
        if (blds.length > 0 && !selectedBuildingId) {
          setSelectedBuildingId(blds[0].id);
        }
      }
    } catch {
      message.error('加载楼栋列表失败');
    } finally {
      setLoading(false);
    }
  }, [communityId, message, selectedBuildingId]);

  useEffect(() => {
    if (open && communityId) {
      fetchBuildings();
    }
  }, [open, communityId]);

  const handleDeleteBuilding = async (id: number) => {
    try {
      await landlordApi.deleteBuilding(id);
      message.success('楼栋已删除');
      fetchBuildings();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '删除失败');
    }
  };

  const handleAddBuilding = async () => {
    try {
      const values = await addBuildingForm.validateFields();
      // POST /landlord/communities/{communityId}/buildings
      const api = (await import('../services/http')).default;
      const res = await api.post(`/landlord/communities/${communityId}/buildings`, values);
      if (res.data?.success) {
        message.success('楼栋已添加');
        setAddBuildingOpen(false);
        addBuildingForm.resetFields();
        fetchBuildings();
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('; ') : (detail || '添加失败');
      message.error(msg);
    }
  };

  const handleAddHouseType = async () => {
    try {
      const values = await addHouseTypeForm.validateFields();
      if (!houseTypeBuildingId) return;
      const api = (await import('../services/http')).default;
      const res = await api.post(`/landlord/buildings/${houseTypeBuildingId}/house-types`, values);
      if (res.data?.success) {
        message.success('户型已添加');
        setAddHouseTypeOpen(false);
        addHouseTypeForm.resetFields();
        fetchBuildings();
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('; ') : (detail || '添加失败');
      message.error(msg);
    }
  };

  const buildingColumns = [
    { title: '楼栋', dataIndex: 'name', key: 'name', width: 100 },
    { title: '编号', dataIndex: 'building_number', key: 'building_number', width: 80 },
    { title: '类型', dataIndex: 'building_type', key: 'building_type', width: 100 },
    {
      title: '楼层', key: 'floor', width: 100,
      render: (_: unknown, r: Building) =>
        r.floor_min != null && r.floor_max != null
          ? `${r.floor_min}-${r.floor_max}层`
          : '-',
    },
    {
      title: '户数/层', dataIndex: 'units_per_floor', key: 'units_per_floor', width: 80,
    },
    {
      title: '户型数', key: 'ht_count', width: 80,
      render: (_: unknown, r: Building) => (buildingHouseTypes[r.id] || []).length,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => <Tag color={v === '在售' ? 'green' : 'default'}>{v}</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_: unknown, r: Building) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setHouseTypeBuildingId(r.id); setAddHouseTypeOpen(true); }}>
            添加户型
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteBuilding(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const houseTypesForSelected = selectedBuildingId
    ? (buildingHouseTypes[selectedBuildingId] || [])
    : [];

  return (
    <Drawer
      title={`${communityName} - 楼栋 & 房间管理`}
      open={open}
      onClose={onClose}
      size="large"
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ paddingLeft: 24, paddingTop: 8 }}
        items={[
          {
            key: 'buildings',
            label: `楼栋 (${buildings.length})`,
            children: (
              <div style={{ padding: 24 }}>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddBuildingOpen(true)}>
                    添加楼栋
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  columns={buildingColumns}
                  dataSource={buildings}
                  loading={loading}
                  size="small"
                  pagination={false}
                  onRow={(record) => ({
                    onClick: () => setSelectedBuildingId(record.id),
                    style: {
                      background: record.id === selectedBuildingId ? '#e6f4ff' : undefined,
                      cursor: 'pointer',
                    },
                  })}
                />
              </div>
            ),
          },
          {
            key: 'rooms',
            label: `房间管理 ${selectedBuilding ? `- ${selectedBuilding.name}` : ''}`,
            children: selectedBuildingId ? (
              <div style={{ padding: 24 }}>
                <RoomManager
                  buildingId={selectedBuildingId}
                  buildingName={selectedBuilding?.name || ''}
                  houseTypes={houseTypesForSelected}
                  api={landlordUnitApi}
                  onRequestAddHouseType={() => {
                    if (selectedBuildingId) {
                      setHouseTypeBuildingId(selectedBuildingId);
                      setAddHouseTypeOpen(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
                请先在「楼栋」Tab 中选择一个楼栋
              </div>
            ),
          },
        ]}
      />

      {/* Add Building Modal */}
      <Modal
        title="添加楼栋"
        open={addBuildingOpen}
        onOk={handleAddBuilding}
        onCancel={() => { setAddBuildingOpen(false); addBuildingForm.resetFields(); }}
        destroyOnHidden
      >
        <Form form={addBuildingForm} layout="vertical" initialValues={{ status: '在售' }}>
          <Form.Item name="name" label="楼栋名称" rules={[{ required: true, message: '请输入楼栋名称' }]}>
            <Input placeholder="如 A栋, 1号楼" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="building_number" label="编号">
                <Input placeholder="如 A, 1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="building_type" label="类型">
                <Select options={BUILDING_TYPES.map(t => ({ value: t, label: t }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="total_floors" label="总层数">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="floor_min" label="最低可售层" dependencies={['floor_max']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_: any, value: number) => {
                      const max = getFieldValue('floor_max');
                      if (value != null && max != null && value > max) {
                        return Promise.reject(new Error('最低层不能大于最高层'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如 5" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="floor_max" label="最高可售层" dependencies={['floor_min']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_: any, value: number) => {
                      const min = getFieldValue('floor_min');
                      if (value != null && min != null && value < min) {
                        return Promise.reject(new Error('最高层不能小于最低层'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如 25" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="units_per_floor" label="每层户数">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit_count" label="单元数">
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="elevator_count" label="电梯数">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="orientation" label="朝向">
            <Select allowClear placeholder="如 南, 南北" options={[
              { value: '南', label: '南' }, { value: '南北', label: '南北' },
              { value: '东', label: '东' }, { value: '西', label: '西' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add House Type Modal */}
      <Modal
        title="添加户型"
        open={addHouseTypeOpen}
        onOk={handleAddHouseType}
        onCancel={() => { setAddHouseTypeOpen(false); addHouseTypeForm.resetFields(); }}
        destroyOnHidden
      >
        <Form form={addHouseTypeForm} layout="vertical">
          <Form.Item name="name" label="户型名称" rules={[{ required: true, message: '请输入户型名称' }]}>
            <Input placeholder="如 三室两厅, A户型" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bedrooms" label="室">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="living_rooms" label="厅">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bathrooms" label="卫">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="area" label="面积 (㎡)" rules={[{ required: true, message: '请输入面积' }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="total_price" label="参考总价 (万元)">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="orientation" label="朝向">
            <Select allowClear placeholder="朝向" options={[
              { value: '南', label: '南' }, { value: '南北', label: '南北' },
              { value: '东', label: '东' }, { value: '西', label: '西' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="floor_min" label="起始楼层" dependencies={['floor_max']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_: any, value: number) => {
                      const max = getFieldValue('floor_max');
                      if (value != null && max != null && value > max) {
                        return Promise.reject(new Error('起始楼层不能大于结束楼层'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如 5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="floor_max" label="结束楼层" dependencies={['floor_min']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_: any, value: number) => {
                      const min = getFieldValue('floor_min');
                      if (value != null && min != null && value < min) {
                        return Promise.reject(new Error('结束楼层不能小于起始楼层'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如 18" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Drawer>
  );
};

export default LandlordCommunityDrawer;
