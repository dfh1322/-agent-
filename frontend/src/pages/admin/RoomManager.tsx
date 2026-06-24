import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Select, Row, Col, App, Popconfirm, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Unit, HouseType } from '../../types/property';
import RoomEditModal from '../../components/RoomEditModal';
import RoomBatchModal from '../../components/RoomBatchModal';

interface RoomManagerProps {
  buildingId: number;
  buildingName: string;
  houseTypes: HouseType[];
  /** Callback to request switching to the buildings tab */
  onRequestAddHouseType?: () => void;
  api?: {
    listUnits: (buildingId: number, params?: any) => Promise<any>;
    deleteUnit: (id: number) => Promise<any>;
    updateUnit?: (id: number, data: Partial<Unit>) => Promise<any>;
    createUnits?: (buildingId: number, units: any[]) => Promise<any>;
    batchUpdateUnits?: (unitIds: number[], updates: Record<string, unknown>) => Promise<any>;
  };
}

const STATUS_COLORS: Record<string, string> = {
  '在售': 'green',
  '已售': 'red',
  '预定': 'orange',
  '待推': 'blue',
};

const RoomManager: React.FC<RoomManagerProps> = ({ buildingId, buildingName, houseTypes, onRequestAddHouseType, ...props }) => {
  const api = props.api;
  const { message } = App.useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [htFilter, setHtFilter] = useState<number | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Unit | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const [resolvedApi, setResolvedApi] = useState<any>(null);
  useEffect(() => {
    if (api) {
      setResolvedApi(api);
    } else {
      import('../../services/api').then(m => setResolvedApi(m.adminApi));
    }
  }, [api]);

  const fetchUnits = useCallback(async () => {
    if (!resolvedApi) return;
    setLoading(true);
    try {
      const res = await resolvedApi.listUnits(buildingId, {
        page, page_size: 50, status_tag: statusFilter, house_type_id: htFilter,
      });
      setUnits(res.data);
      setTotal(res.pagination.total);
    } catch {
      message.error('加载房间列表失败');
    } finally {
      setLoading(false);
    }
  }, [buildingId, page, statusFilter, htFilter, message, resolvedApi]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const handleDelete = async (id: number) => {
    await resolvedApi.deleteUnit(id);
    message.success('已删除');
    fetchUnits();
  };

  const columns = [
    { title: '房间号', dataIndex: 'room_number', key: 'room_number', width: 100 },
    {
      title: '楼层', dataIndex: 'floor', key: 'floor', width: 70,
      sorter: (a: Unit, b: Unit) => (a.floor || 0) - (b.floor || 0),
    },
    {
      title: '户型', dataIndex: 'house_type_name', key: 'house_type_name', width: 120,
    },
    {
      title: '面积', dataIndex: 'area', key: 'area', width: 80,
      render: (v: number | null) => v != null ? `${v}㎡` : '-',
    },
    {
      title: '售价', dataIndex: 'total_price', key: 'total_price', width: 100,
      render: (v: number | null) => v != null ? `${v}万` : '-',
      sorter: (a: Unit, b: Unit) => (a.total_price || 0) - (b.total_price || 0),
    },
    { title: '朝向', dataIndex: 'orientation', key: 'orientation', width: 70 },
    {
      title: '状态', dataIndex: 'status_tag', key: 'status_tag', width: 80,
      render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 160,
      render: (v: string[] | null) =>
        v && v.length > 0 ? v.map((t: string) => <Tag key={t}>{t}</Tag>) : null,
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_: unknown, record: Unit) => (
        <Space>
          <Button
            type="link" size="small" icon={<EditOutlined />}
            onClick={() => { setEditingRoom(record); setEditOpen(true); }}
          />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── No house types: show clear guidance instead of a disabled button ──
  if (houseTypes.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#8c8c8c' }}>
              当前楼栋「{buildingName}」暂无户型，添加房间前需要先创建户型。
            </span>
          }
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (onRequestAddHouseType) {
                onRequestAddHouseType();
              } else {
                message.warning('请切换到「楼栋」Tab，选中楼栋后点击「添加户型」');
              }
            }}
          >
            去创建户型
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 120 }}
            value={statusFilter}
            onChange={v => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: '在售', label: '在售' },
              { value: '已售', label: '已售' },
              { value: '预定', label: '预定' },
            ]}
          />
        </Col>
        <Col>
          <Select
            allowClear
            placeholder="户型筛选"
            style={{ width: 180 }}
            value={htFilter}
            onChange={v => { setHtFilter(v); setPage(1); }}
            options={houseTypes.map(h => ({ value: h.id, label: h.name }))}
          />
        </Col>
        <Col flex="auto" />
        <Col>
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button onClick={() => setBatchOpen(true)}>
                批量操作 ({selectedRowKeys.length})
              </Button>
            )}
            <Button
              type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditingRoom(null); setEditOpen(true); }}
            >
              添加房间
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={units}
        loading={loading}
        size="small"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          onChange: setPage,
          showTotal: (t: number) => `共 ${t} 个房间`,
        }}
      />

      <RoomEditModal
        open={editOpen}
        buildingId={buildingId}
        houseTypes={houseTypes}
        room={editingRoom}
        api={resolvedApi ? {
          updateUnit: (id: number, data: Partial<Unit>) => resolvedApi.updateUnit(id, data),
          createUnits: (bid: number, units: any[]) => resolvedApi.createUnits(bid, units),
        } : undefined}
        onClose={() => { setEditOpen(false); setEditingRoom(null); }}
        onSaved={() => { setEditOpen(false); setEditingRoom(null); fetchUnits(); }}
      />

      <RoomBatchModal
        open={batchOpen}
        buildingId={buildingId}
        houseTypes={houseTypes}
        selectedUnitIds={selectedRowKeys as number[]}
        api={resolvedApi ? {
          generateUnits: (bid: number, data: any) => resolvedApi.generateUnits(bid, data),
          batchUpdateUnits: (ids: number[], updates: Record<string, unknown>) => resolvedApi.batchUpdateUnits(ids, updates),
        } : undefined}
        onClose={() => setBatchOpen(false)}
        onApplied={() => { setBatchOpen(false); setSelectedRowKeys([]); fetchUnits(); }}
      />
    </div>
  );
};

export default RoomManager;
