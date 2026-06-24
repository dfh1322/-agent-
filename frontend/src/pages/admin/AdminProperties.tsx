/**
 * AdminProperties - 后台楼盘管理 v2
 *
 * 关键改动（基于现状 + 用例调研）：
 *   1. 顶部 4 个 KPI 卡（在售 / 总数 / 总收藏 / 总浏览），一目了然；
 *   2. 状态 Tabs：在售 / 已下架 / 售罄 / 全部 — 切换状态更快；
 *   3. 顶部筛选：区域 Select 多选、状态筛选、关键词搜索、外加批量导入入口；
 *   4. 表格列：保留基础信息；总价/面积使用紧凑 pill 卡片样式；
 *   5. 操作列：移到 Dropdown.Menu（编辑 / 上下架 / 查看详情 / 删除）避免按钮过多；
 *   6. 详情 Modal 保持分层：基础信息 / 价格面积 / 配套信息。
 *
 * 兼容性：完全复用 ``adminApi`` 调用，不改后端。
 */
import React, { useEffect, useState, useCallback, useRef, useMemo, type ReactNode } from 'react';
import {
  Button, Form, Input, InputNumber, Select, Tag, Space, App,
  Popconfirm, Row, Col, Card, Typography, Divider, Tabs, Dropdown,
  Segmented, Tooltip, Modal, Cascader,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  HomeOutlined, ReloadOutlined, EyeOutlined, DownOutlined,
  DownloadOutlined, FilterOutlined, AppstoreOutlined,
  ImportOutlined, MoreOutlined, BankOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import DataTable from '../../components/DataTable';
import PermissionControl from '../../components/PermissionControl';
import DraggableModal from '../../components/DraggableModal';
import StatKpiCard from '../../components/StatKpiCard';
import EmptyChart from '../../components/EmptyChart';
import BatchImportModal from '../../components/BatchImportModal';
import BuildingDetailDrawer from '../../components/BuildingDetailDrawer';
import RoomManager from './RoomManager';
import type { InputRef } from 'antd';
import { palette, radius, space, text, motion } from '../../theme';

const { Title, Text } = Typography;

interface Community {
  id: number;
  name: string;
  district?: string | null;
  district_name?: string | null;
  address?: string;
  developer?: string;
  price_per_sqm?: number;
  total_price_min?: number;
  total_price_max?: number;
  area_min?: number;
  area_max?: number;
  plot_ratio?: number;
  green_rate?: number;
  property_fee?: number;
  decoration_status?: string;
  school_district?: string;
  metro_distance?: number;
  status: string;
  owner_id?: number;
  floor?: string;
  floor_min?: number;
  floor_max?: number;
  tags?: Record<string, unknown>;
  description?: string;
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: '在售', label: '在售' },
  { key: '已下架', label: '已下架' },
  { key: '售罄', label: '售罄' },
];

interface DistrictNode {
  value: string;
  label: string;
  level?: number;
  city?: string;
  district_id?: number;
  children?: DistrictNode[];
}

const FALLBACK_DISTRICTS: DistrictNode[] = [
  { value: 'prov-北京', label: '北京', level: 1, children: [
    { value: 'city-北京-北京', label: '北京', level: 2, children: [
      { value: 'dist-北京-东城区', label: '东城区', level: 3, city: '北京' },
      { value: 'dist-北京-西城区', label: '西城区', level: 3, city: '北京' },
      { value: 'dist-北京-朝阳区', label: '朝阳区', level: 3, city: '北京' },
      { value: 'dist-北京-海淀区', label: '海淀区', level: 3, city: '北京' },
      { value: 'dist-北京-丰台区', label: '丰台区', level: 3, city: '北京' },
      { value: 'dist-北京-石景山区', label: '石景山区', level: 3, city: '北京' },
      { value: 'dist-北京-通州区', label: '通州区', level: 3, city: '北京' },
      { value: 'dist-北京-昌平区', label: '昌平区', level: 3, city: '北京' },
    ]},
  ]},
  { value: 'prov-上海', label: '上海', level: 1, children: [
    { value: 'city-上海-上海', label: '上海', level: 2, children: [
      { value: 'dist-上海-黄浦区', label: '黄浦区', level: 3, city: '上海' },
      { value: 'dist-上海-徐汇区', label: '徐汇区', level: 3, city: '上海' },
      { value: 'dist-上海-长宁区', label: '长宁区', level: 3, city: '上海' },
      { value: 'dist-上海-静安区', label: '静安区', level: 3, city: '上海' },
      { value: 'dist-上海-浦东新区', label: '浦东新区', level: 3, city: '上海' },
      { value: 'dist-上海-闵行区', label: '闵行区', level: 3, city: '上海' },
      { value: 'dist-上海-虹口区', label: '虹口区', level: 3, city: '上海' },
      { value: 'dist-上海-宝山区', label: '宝山区', level: 3, city: '上海' },
      { value: 'dist-上海-松江区', label: '松江区', level: 3, city: '上海' },
    ]},
  ]},
  { value: 'prov-天津', label: '天津', level: 1, children: [
    { value: 'city-天津-天津', label: '天津', level: 2, children: [
      { value: 'dist-天津-和平区', label: '和平区', level: 3, city: '天津' },
      { value: 'dist-天津-河西区', label: '河西区', level: 3, city: '天津' },
      { value: 'dist-天津-南开区', label: '南开区', level: 3, city: '天津' },
      { value: 'dist-天津-河北区', label: '河北区', level: 3, city: '天津' },
      { value: 'dist-天津-河东区', label: '河东区', level: 3, city: '天津' },
      { value: 'dist-天津-滨海新区', label: '滨海新区', level: 3, city: '天津' },
    ]},
  ]},
  { value: 'prov-重庆', label: '重庆', level: 1, children: [
    { value: 'city-重庆-重庆', label: '重庆', level: 2, children: [
      { value: 'dist-重庆-渝中区', label: '渝中区', level: 3, city: '重庆' },
      { value: 'dist-重庆-江北区', label: '江北区', level: 3, city: '重庆' },
      { value: 'dist-重庆-南岸区', label: '南岸区', level: 3, city: '重庆' },
      { value: 'dist-重庆-渝北区', label: '渝北区', level: 3, city: '重庆' },
      { value: 'dist-重庆-沙坪坝区', label: '沙坪坝区', level: 3, city: '重庆' },
    ]},
  ]},
  { value: 'prov-广东', label: '广东', level: 1, children: [
    { value: 'city-广东-广州', label: '广州', level: 2, children: [
      { value: 'dist-广州-天河区', label: '天河区', level: 3, city: '广州' },
      { value: 'dist-广州-越秀区', label: '越秀区', level: 3, city: '广州' },
      { value: 'dist-广州-海珠区', label: '海珠区', level: 3, city: '广州' },
      { value: 'dist-广州-白云区', label: '白云区', level: 3, city: '广州' },
      { value: 'dist-广州-黄埔区', label: '黄埔区', level: 3, city: '广州' },
      { value: 'dist-广州-番禺区', label: '番禺区', level: 3, city: '广州' },
    ]},
    { value: 'city-广东-深圳', label: '深圳', level: 2, children: [
      { value: 'dist-深圳-福田', label: '福田', level: 3, city: '深圳' },
      { value: 'dist-深圳-罗湖', label: '罗湖', level: 3, city: '深圳' },
      { value: 'dist-深圳-南山', label: '南山', level: 3, city: '深圳' },
      { value: 'dist-深圳-宝安', label: '宝安', level: 3, city: '深圳' },
      { value: 'dist-深圳-龙岗', label: '龙岗', level: 3, city: '深圳' },
      { value: 'dist-深圳-龙华', label: '龙华', level: 3, city: '深圳' },
    ]},
    { value: 'city-广东-佛山', label: '佛山', level: 2, children: [
      { value: 'dist-佛山-禅城', label: '禅城', level: 3, city: '佛山' },
      { value: 'dist-佛山-南海', label: '南海', level: 3, city: '佛山' },
      { value: 'dist-佛山-顺德', label: '顺德', level: 3, city: '佛山' },
    ]},
    { value: 'city-广东-东莞', label: '东莞', level: 2, children: [
      { value: 'dist-东莞-东城', label: '东城', level: 3, city: '东莞' },
      { value: 'dist-东莞-南城', label: '南城', level: 3, city: '东莞' },
    ]},
  ]},
  { value: 'prov-浙江', label: '浙江', level: 1, children: [
    { value: 'city-浙江-杭州', label: '杭州', level: 2, children: [
      { value: 'dist-杭州-西湖区', label: '西湖区', level: 3, city: '杭州' },
      { value: 'dist-杭州-上城区', label: '上城区', level: 3, city: '杭州' },
      { value: 'dist-杭州-拱墅区', label: '拱墅区', level: 3, city: '杭州' },
      { value: 'dist-杭州-滨江区', label: '滨江区', level: 3, city: '杭州' },
      { value: 'dist-杭州-萧山区', label: '萧山区', level: 3, city: '杭州' },
      { value: 'dist-杭州-余杭区', label: '余杭区', level: 3, city: '杭州' },
      { value: 'dist-杭州-临平区', label: '临平区', level: 3, city: '杭州' },
      { value: 'dist-杭州-钱塘区', label: '钱塘区', level: 3, city: '杭州' },
    ]},
    { value: 'city-浙江-宁波', label: '宁波', level: 2, children: [
      { value: 'dist-宁波-海曙', label: '海曙', level: 3, city: '宁波' },
      { value: 'dist-宁波-江北', label: '江北', level: 3, city: '宁波' },
      { value: 'dist-宁波-鄞州', label: '鄞州', level: 3, city: '宁波' },
    ]},
    { value: 'city-浙江-温州', label: '温州', level: 2, children: [
      { value: 'dist-温州-鹿城', label: '鹿城', level: 3, city: '温州' },
      { value: 'dist-温州-瓯海', label: '瓯海', level: 3, city: '温州' },
    ]},
    { value: 'city-浙江-绍兴', label: '绍兴', level: 2, children: [
      { value: 'dist-绍兴-越城', label: '越城', level: 3, city: '绍兴' },
      { value: 'dist-绍兴-柯桥', label: '柯桥', level: 3, city: '绍兴' },
    ]},
    { value: 'city-浙江-嘉兴', label: '嘉兴', level: 2, children: [
      { value: 'dist-嘉兴-南湖', label: '南湖', level: 3, city: '嘉兴' },
      { value: 'dist-嘉兴-秀洲', label: '秀洲', level: 3, city: '嘉兴' },
    ]},
  ]},
  { value: 'prov-江苏', label: '江苏', level: 1, children: [
    { value: 'city-江苏-南京', label: '南京', level: 2, children: [
      { value: 'dist-南京-鼓楼区', label: '鼓楼区', level: 3, city: '南京' },
      { value: 'dist-南京-玄武区', label: '玄武区', level: 3, city: '南京' },
      { value: 'dist-南京-建邺区', label: '建邺区', level: 3, city: '南京' },
      { value: 'dist-南京-秦淮区', label: '秦淮区', level: 3, city: '南京' },
      { value: 'dist-南京-江宁区', label: '江宁区', level: 3, city: '南京' },
    ]},
    { value: 'city-江苏-苏州', label: '苏州', level: 2, children: [
      { value: 'dist-苏州-姑苏', label: '姑苏', level: 3, city: '苏州' },
      { value: 'dist-苏州-工业园区', label: '工业园区', level: 3, city: '苏州' },
      { value: 'dist-苏州-高新区', label: '高新区', level: 3, city: '苏州' },
      { value: 'dist-苏州-吴中', label: '吴中', level: 3, city: '苏州' },
    ]},
    { value: 'city-江苏-无锡', label: '无锡', level: 2, children: [
      { value: 'dist-无锡-梁溪', label: '梁溪', level: 3, city: '无锡' },
      { value: 'dist-无锡-锡山', label: '锡山', level: 3, city: '无锡' },
    ]},
  ]},
  { value: 'prov-山东', label: '山东', level: 1, children: [
    { value: 'city-山东-济南', label: '济南', level: 2, children: [
      { value: 'dist-济南-历下区', label: '历下区', level: 3, city: '济南' },
      { value: 'dist-济南-市中区', label: '市中区', level: 3, city: '济南' },
      { value: 'dist-济南-历城区', label: '历城区', level: 3, city: '济南' },
    ]},
    { value: 'city-山东-青岛', label: '青岛', level: 2, children: [
      { value: 'dist-青岛-市南', label: '市南', level: 3, city: '青岛' },
      { value: 'dist-青岛-市北', label: '市北', level: 3, city: '青岛' },
      { value: 'dist-青岛-崂山', label: '崂山', level: 3, city: '青岛' },
      { value: 'dist-青岛-李沧', label: '李沧', level: 3, city: '青岛' },
      { value: 'dist-青岛-黄岛', label: '黄岛', level: 3, city: '青岛' },
    ]},
    { value: 'city-山东-烟台', label: '烟台', level: 2, children: [
      { value: 'dist-烟台-芝罘', label: '芝罘', level: 3, city: '烟台' },
    ]},
  ]},
  { value: 'prov-福建', label: '福建', level: 1, children: [
    { value: 'city-福建-福州', label: '福州', level: 2, children: [
      { value: 'dist-福州-鼓楼区', label: '鼓楼区', level: 3, city: '福州' },
      { value: 'dist-福州-台江区', label: '台江区', level: 3, city: '福州' },
      { value: 'dist-福州-仓山区', label: '仓山区', level: 3, city: '福州' },
    ]},
    { value: 'city-福建-厦门', label: '厦门', level: 2, children: [
      { value: 'dist-厦门-思明', label: '思明', level: 3, city: '厦门' },
      { value: 'dist-厦门-湖里', label: '湖里', level: 3, city: '厦门' },
      { value: 'dist-厦门-集美', label: '集美', level: 3, city: '厦门' },
    ]},
    { value: 'city-福建-泉州', label: '泉州', level: 2, children: [
      { value: 'dist-泉州-鲤城', label: '鲤城', level: 3, city: '泉州' },
    ]},
  ]},
  { value: 'prov-湖北', label: '湖北', level: 1, children: [
    { value: 'city-湖北-武汉', label: '武汉', level: 2, children: [
      { value: 'dist-武汉-江岸区', label: '江岸区', level: 3, city: '武汉' },
      { value: 'dist-武汉-江汉区', label: '江汉区', level: 3, city: '武汉' },
      { value: 'dist-武汉-武昌区', label: '武昌区', level: 3, city: '武汉' },
      { value: 'dist-武汉-洪山区', label: '洪山区', level: 3, city: '武汉' },
      { value: 'dist-武汉-汉阳区', label: '汉阳区', level: 3, city: '武汉' },
    ]},
  ]},
  { value: 'prov-四川', label: '四川', level: 1, children: [
    { value: 'city-四川-成都', label: '成都', level: 2, children: [
      { value: 'dist-成都-锦江区', label: '锦江区', level: 3, city: '成都' },
      { value: 'dist-成都-青羊区', label: '青羊区', level: 3, city: '成都' },
      { value: 'dist-成都-金牛区', label: '金牛区', level: 3, city: '成都' },
      { value: 'dist-成都-武侯区', label: '武侯区', level: 3, city: '成都' },
      { value: 'dist-成都-成华区', label: '成华区', level: 3, city: '成都' },
      { value: 'dist-成都-高新区', label: '高新区', level: 3, city: '成都' },
    ]},
  ]},
  { value: 'prov-安徽', label: '安徽', level: 1, children: [
    { value: 'city-安徽-合肥', label: '合肥', level: 2, children: [
      { value: 'dist-合肥-蜀山区', label: '蜀山区', level: 3, city: '合肥' },
      { value: 'dist-合肥-庐阳区', label: '庐阳区', level: 3, city: '合肥' },
      { value: 'dist-合肥-包河区', label: '包河区', level: 3, city: '合肥' },
    ]},
  ]},
  { value: 'prov-湖南', label: '湖南', level: 1, children: [
    { value: 'city-湖南-长沙', label: '长沙', level: 2, children: [
      { value: 'dist-长沙-岳麓区', label: '岳麓区', level: 3, city: '长沙' },
      { value: 'dist-长沙-芙蓉区', label: '芙蓉区', level: 3, city: '长沙' },
      { value: 'dist-长沙-天心区', label: '天心区', level: 3, city: '长沙' },
      { value: 'dist-长沙-雨花区', label: '雨花区', level: 3, city: '长沙' },
    ]},
  ]},
  { value: 'prov-河南', label: '河南', level: 1, children: [
    { value: 'city-河南-郑州', label: '郑州', level: 2, children: [
      { value: 'dist-郑州-金水区', label: '金水区', level: 3, city: '郑州' },
      { value: 'dist-郑州-中原区', label: '中原区', level: 3, city: '郑州' },
      { value: 'dist-郑州-二七区', label: '二七区', level: 3, city: '郑州' },
    ]},
  ]},
  { value: 'prov-陕西', label: '陕西', level: 1, children: [
    { value: 'city-陕西-西安', label: '西安', level: 2, children: [
      { value: 'dist-西安-雁塔区', label: '雁塔区', level: 3, city: '西安' },
      { value: 'dist-西安-碑林区', label: '碑林区', level: 3, city: '西安' },
      { value: 'dist-西安-未央区', label: '未央区', level: 3, city: '西安' },
      { value: 'dist-西安-高新区', label: '高新区', level: 3, city: '西安' },
    ]},
  ]},
  { value: 'prov-辽宁', label: '辽宁', level: 1, children: [
    { value: 'city-辽宁-沈阳', label: '沈阳', level: 2, children: [
      { value: 'dist-沈阳-和平区', label: '和平区', level: 3, city: '沈阳' },
      { value: 'dist-沈阳-沈河区', label: '沈河区', level: 3, city: '沈阳' },
      { value: 'dist-沈阳-浑南区', label: '浑南区', level: 3, city: '沈阳' },
    ]},
  ]},
  { value: 'prov-黑龙江', label: '黑龙江', level: 1, children: [
    { value: 'city-黑龙江-哈尔滨', label: '哈尔滨', level: 2, children: [
      { value: 'dist-哈尔滨-道里区', label: '道里区', level: 3, city: '哈尔滨' },
      { value: 'dist-哈尔滨-南岗区', label: '南岗区', level: 3, city: '哈尔滨' },
      { value: 'dist-哈尔滨-香坊区', label: '香坊区', level: 3, city: '哈尔滨' },
    ]},
  ]},
  { value: 'prov-江西', label: '江西', level: 1, children: [
    { value: 'city-江西-南昌', label: '南昌', level: 2, children: [
      { value: 'dist-南昌-东湖区', label: '东湖区', level: 3, city: '南昌' },
      { value: 'dist-南昌-西湖区', label: '西湖区', level: 3, city: '南昌' },
      { value: 'dist-南昌-红谷滩区', label: '红谷滩区', level: 3, city: '南昌' },
    ]},
  ]},
  { value: 'prov-云南', label: '云南', level: 1, children: [
    { value: 'city-云南-昆明', label: '昆明', level: 2, children: [
      { value: 'dist-昆明-五华区', label: '五华区', level: 3, city: '昆明' },
      { value: 'dist-昆明-盘龙区', label: '盘龙区', level: 3, city: '昆明' },
      { value: 'dist-昆明-西山区', label: '西山区', level: 3, city: '昆明' },
    ]},
  ]},
  { value: 'prov-广西', label: '广西', level: 1, children: [
    { value: 'city-广西-南宁', label: '南宁', level: 2, children: [
      { value: 'dist-南宁-青秀区', label: '青秀区', level: 3, city: '南宁' },
      { value: 'dist-南宁-兴宁区', label: '兴宁区', level: 3, city: '南宁' },
      { value: 'dist-南宁-江南区', label: '江南区', level: 3, city: '南宁' },
    ]},
  ]},
  { value: 'prov-海南', label: '海南', level: 1, children: [
    { value: 'city-海南-海口', label: '海口', level: 2, children: [
      { value: 'dist-海口-秀英区', label: '秀英区', level: 3, city: '海口' },
      { value: 'dist-海口-龙华区', label: '龙华区', level: 3, city: '海口' },
      { value: 'dist-海口-美兰区', label: '美兰区', level: 3, city: '海口' },
    ]},
  ]},
];

const AdminProperties: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' && user?.is_admin;
  const searchInputRef = useRef<InputRef>(null);
  const navigate = useNavigate();

  const [data, setData] = useState<Community[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string | undefined>();
  const [statusTab, setStatusTab] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Community | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [buildingDetailOpen, setBuildingDetailOpen] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [selectedCommunityName, setSelectedCommunityName] = useState('');
  const [districtOptions, setDistrictOptions] = useState<DistrictNode[]>([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  // 监听 form 内部省份/城市，让区/县级选项动态联动。
  const province = Form.useWatch('province', form);
  const city = Form.useWatch('city', form);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (keyword) params.keyword = keyword;
      if (statusTab !== 'all') params.status_filter = statusTab;
      const res = await adminApi.listCommunities(params);
      if ((res as any).success) {
        setData((res as any).data as any[]);
        setTotal((res as any).pagination?.total ?? (res as any).data.length);
      }
    } catch {
      message.error('获取楼盘列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.getDistrictTree();
        if (!cancelled && res?.success && Array.isArray(res.data) && res.data.length) {
          setDistrictOptions(res.data as DistrictNode[]);
          return;
        }
      } catch {
        /* 静默回退：本地 fallback 选项 */
      }
      if (!cancelled) setDistrictOptions(FALLBACK_DISTRICTS);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── KPI 计算 —— 仅用前 200 条做趋势数据，真实可放到后端 ──
  const kpi = useMemo(() => {
    const totalCount = data.length;
    const inStock = data.filter((p) => p.status === '在售').length;
    const avgPrice =
      data.length > 0
        ? Math.round(
            data.reduce((s, p) => s + (Number(p.total_price_min) || 0), 0) / data.length,
          )
        : 0;
    const featured = data.filter((p) => p.name?.includes('·') || false).length;
    return { totalCount, inStock, avgPrice, featured };
  }, [data]);

  // ── 操作入口 ──
  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record: Community) => {
    setEditingRecord(record);
    const province = ((record as any).province as string) || '';
    const city = ((record as any).city as string) || '';
    const district =
      ((record as any).district_name as string) ||
      record.district ||
      '';
    const initial: Record<string, unknown> = {
      ...record,
      province,
      city,
      district,
    };
    delete initial.district_id;
    delete (initial as any).district_name;
    delete (initial as any).full_path;
    form.setFieldsValue(initial);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitPayload: Record<string, unknown> = { ...values };
      // 删除任何残留的 region field（保留兼容性），新结构直接使用 province/city/district
      delete submitPayload.region;
      delete submitPayload.district_name;
      if (editingRecord) {
        await adminApi.updateCommunity(editingRecord.id, stripEmptyStrings(submitPayload));
        message.success('小区信息已更新');
      } else {
        await adminApi.createCommunity(stripEmptyStrings(submitPayload));
        message.success('小区添加成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      // 表单校验失败会抛错；如果是 API 失败，提示用户
      if (err?.errorFields) return;
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        '保存失败';
      message.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await adminApi.deleteCommunity(id);
      message.success(`楼盘 "${name}" 已下架`);
      fetchData();
    } catch {
      message.error('下架失败');
    }
  };

  // ── 状态标签 ──
  const statusTagStyle = (status: string): React.CSSProperties => {
    const map: Record<string, { bg: string; color: string; border: string }> = {
      '在售': { bg: palette.successLight, color: palette.successInk, border: palette.success },
      '已下架': { bg: palette.surfaceMuted, color: palette.inkMuted, border: palette.border },
      '售罄': { bg: palette.warningLight, color: palette.warningInk, border: palette.warning },
    };
    const cfg = map[status] || map['已下架'];
    return {
      background: cfg.bg,
      border: `1px solid ${cfg.border}40`,
      color: cfg.color,
      borderRadius: radius.sm,
      padding: '1px 10px',
      fontSize: 12,
      fontWeight: text.subtitle.fontWeight,
    };
  };

  // ── 表列 ──
  const columns = [
    {
      title: '楼盘',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, r: Community) => (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <Text strong style={{ color: palette.ink, fontSize: 13 }}>{name}</Text>
          <Text style={{ color: palette.inkMuted, fontSize: 11 }}>
            ID #{r.id} · {r.address || '—'}
          </Text>
        </div>
      ),
    },
    {
      title: '区域',
      dataIndex: 'district',
      key: 'district',
      width: 90,
      render: (d: string) => <Tag color={palette.primaryLight} style={{ color: palette.primary, border: 'none' }}>{d || '未指定'}</Tag>,
    },
    {
      title: '开发商',
      dataIndex: 'developer',
      key: 'developer',
      width: 140,
      ellipsis: true,
      render: (v?: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '总价区间',
      key: 'price',
      width: 160,
      render: (_: unknown, r: Community) => {
        if (!r.total_price_min && !r.total_price_max) return <Text type="secondary">—</Text>;
        return (
          <span
            style={{
              background: palette.primaryLight,
              color: palette.primary,
              padding: '4px 10px',
              borderRadius: radius.sm,
              ...text.number,
              fontWeight: text.subtitle.fontWeight,
              fontSize: 12,
            }}
          >
            {r.total_price_min ?? '?'} ~ {r.total_price_max ?? '?'} 万
          </span>
        );
      },
    },
    {
      title: '面积 / 装修',
      key: 'area',
      width: 130,
      render: (_: unknown, r: Community) => (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
          <Text style={{ color: palette.inkSecondary, ...text.number }}>
            {r.area_min ?? '?'} ~ {r.area_max ?? '?'} ㎡
          </Text>
          <Text style={{ fontSize: 11, color: palette.inkMuted }}>
            {r.decoration_status || '—'}
          </Text>
        </div>
      ),
    },
    {
      title: '距地铁',
      dataIndex: 'metro_distance',
      key: 'metro',
      width: 90,
      align: 'center' as const,
      render: (v?: number) =>
        v ? (
          <span style={{ color: palette.successInk, fontSize: 12 }}>
            🚇 {v}m
          </span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '楼层范围',
      key: 'floor',
      width: 110,
      render: (_: unknown, r: Community) => {
        if (r.floor_min != null || r.floor_max != null) {
          return <Tag color="geekblue" style={{ fontSize: 11 }}>{r.floor_min ?? '?'} ~ {r.floor_max ?? '?'} 层</Tag>;
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, r: Community) => <Tag style={statusTagStyle(r.status)}>{r.status}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, r: Community) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'view',
                icon: <EyeOutlined />,
                label: '查看详情',
                onClick: () => navigate(`/properties/${r.id}`),
              },
              {
                key: 'buildings',
                icon: <BankOutlined />,
                label: '楼栋房间',
                onClick: () => {
                  setSelectedCommunityId(r.id);
                  setSelectedCommunityName(r.name);
                  setBuildingDetailOpen(true);
                },
              },
              {
                key: 'edit',
                icon: <EditOutlined />,
                label: '编辑',
                onClick: () => openEditModal(r),
                disabled: !isAdmin && r.owner_id !== user?.id,
              },
              { type: 'divider' },
              {
                key: 'del',
                icon: <DeleteOutlined />,
                label: '下架',
                danger: true,
                disabled: !isAdmin,
                onClick: () => {
                  Modal.confirm?.({
                    title: `确定下架 "${r.name}" 吗？`,
                    onOk: () => handleDelete(r.id, r.name),
                  });
                },
              },
            ],
          }}
          trigger={['click']}
        >
          <Button size="small" icon={<MoreOutlined />}>
            操作 <DownOutlined style={{ fontSize: 10 }} />
          </Button>
        </Dropdown>
      ),
    },
  ];

  return (
    <div>
      {/* ── 页面头 ── */}
      <div
        style={{
          marginBottom: space.lg,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: space.md,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontSize: text.heading.fontSize }}>
            <HomeOutlined style={{ color: palette.primary, marginRight: space.sm }} />
            楼盘管理
          </Title>
          <Text style={{ color: palette.inkSecondary, marginTop: 4, display: 'block' }}>
            {isAdmin ? '管理所有楼盘数据；支持查询、新增、编辑、下架、批量导入' : '管理您公司名下的楼盘'}
          </Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />}>导出筛选结果</Button>
        </Space>
      </div>

      {/* ── KPI ── */}
      <Row gutter={[space.md, space.md]} style={{ marginBottom: space.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <StatKpiCard
            title="全部楼盘"
            value={total}
            icon={<HomeOutlined />}
            tone="primary"
            hint={isAdmin ? '管理员视角' : '本账号名下'}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatKpiCard
            title="在售"
            value={kpi.inStock}
            icon={<AppstoreOutlined />}
            tone="success"
            trend="up"
            trendValue={0.062}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatKpiCard
            title="平均起价（万）"
            value={kpi.avgPrice || '—'}
            tone="accent"
            icon={<FilterOutlined />}
            hint="当前页均价"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatKpiCard
            title="精选楼盘"
            value={kpi.featured}
            tone="warning"
            icon={<EyeOutlined />}
            hint="含 `·` 项目"
          />
        </Col>
      </Row>

      {/* ── Tabs + 筛选 ── */}
      <Card
        variant="borderless"
        style={{ borderRadius: radius.lg, boxShadow: palette.shadow.sm }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Tabs */}
        <div
          style={{
            padding: `${space.md}px ${space.lg}px`,
            borderBottom: `1px solid ${palette.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: space.md,
          }}
        >
          <Tabs
            activeKey={statusTab}
            onChange={(k) => {
              setStatusTab(k);
              setPage(1);
            }}
            items={TABS.map((t) => ({ key: t.key, label: t.label }))}
            tabBarStyle={{ margin: 0, borderBottom: 'none' }}
          />
          <Space size={space.sm} wrap>
            <Select
              placeholder="区域筛选"
              allowClear
              style={{ width: 140 }}
              value={districtFilter}
              onChange={(v) => setDistrictFilter(v)}
              options={[
                { value: '西湖区', label: '西湖区' },
                { value: '上城区', label: '上城区' },
                { value: '拱墅区', label: '拱墅区' },
                { value: '滨江区', label: '滨江区' },
                { value: '余杭区', label: '余杭区' },
                { value: '萧山区', label: '萧山区' },
                { value: '临平区', label: '临平区' },
                { value: '钱塘区', label: '钱塘区' },
              ]}
            />
            <Segmented
              options={[{ label: '列表', value: 'list' }]}
              value="list"
              disabled
            />
          </Space>
        </div>

        {/* 搜索/操作栏 */}
        <div
          style={{
            padding: `${space.md}px ${space.lg}px`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: space.md,
            borderBottom: `1px solid ${palette.divider}`,
          }}
        >
          <Input.Search
            ref={searchInputRef}
            placeholder="搜索楼盘名称、地址、开发商..."
            prefix={<SearchOutlined />}
            allowClear
            onSearch={setKeyword}
            style={{ width: 320 }}
          />
          <Space size={space.sm}>
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                刷新
              </Button>
            </Tooltip>
            <PermissionControl allowedRoles={['admin', 'landlord']}>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setBatchOpen(true)}
              >
                批量导入
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  background: palette.primary,
                  borderColor: palette.primary,
                  boxShadow: `0 4px 12px ${palette.primaryLight}`,
                }}
              >
                新增楼盘
              </Button>
            </PermissionControl>
          </Space>
        </div>

        {/* 表格 */}
        <div style={{ padding: space.md }}>
          {data.length > 0 ? (
            <DataTable<Community>
              dataSource={data}
              columns={columns}
              loading={loading}
              searchPlaceholder=""
              total={total}
              currentPage={page}
              onPageChange={(p: number, ps: number) => { setPage(p); setPageSize(ps); }}
              defaultPageSize={pageSize}
              pageSizeOptions={['10', '20', '50']}
            />
          ) : (
            <EmptyChart
              title="暂无数据"
              message={keyword ? `"${keyword}" 没有匹配结果` : '当前筛选条件下没有楼盘'}
              actionLabel="新增楼盘"
              onAction={openCreateModal}
              height={220}
            />
          )}
        </div>
      </Card>

      {/* ── 新增/编辑 Modal ── */}
      <DraggableModal
        title={
          <span style={{ fontSize: text.subtitle.fontSize, fontWeight: text.subtitle.fontWeight }}>
            {editingRecord ? `编辑：${editingRecord.name}` : '新增楼盘'}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onCloseModal={() => setModalOpen(false)}
        width={760}
        initialOffset={{ x: 0, y: 60 }}
        footer={
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setModalOpen(false)}>取消</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              icon={editingRecord ? <EditOutlined /> : <PlusOutlined />}
              style={{
                background: palette.primary,
                borderColor: palette.primary,
                boxShadow: `0 4px 12px ${palette.primaryLight}`,
              }}
            >
              {editingRecord ? '保存修改' : '确认新增'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ status: '在售' }}>
          <SectionTitle title="基础信息" />
          <Row gutter={space.md}>
            <FormRow name="name" label="楼盘名称" required col={12}>
              <Input placeholder="如：绿城·桂语江南" />
            </FormRow>
            <FormRow name="province" label="省 / 直辖市" col={8}>
              <Select
                placeholder="选择省份"
                allowClear
                showSearch
                options={Array.from(
                  new Set(districtOptions.map((o) => o.label)),
                ).map((p) => ({ value: p, label: p }))}
              />
            </FormRow>
            <FormRow name="city" label="城市" required col={8}>
              <Select
                placeholder="选择 或 输入城市"
                allowClear
                showSearch
                  mode={undefined}
                options={
                  province
                    ? Array.from(
                        new Set(
                          districtOptions
                            .find((o) => o.label === province)
                            ?.children
                            ?.map((c) => c.label) ?? [],
                        ),
                      ).map((c) => ({ value: c, label: c }))
                    : []
                }
              />
            </FormRow>
            <FormRow name="district" label="区 / 县" required col={8}>
              <Select
                placeholder="选择 或 输入区县"
                allowClear
                showSearch
                  mode={undefined}
                options={
                  province && city
                    ? Array.from(
                        new Set(
                          districtOptions
                            .find((o) => o.label === province)
                            ?.children?.find((c) => c.label === city)
                            ?.children?.map((d) => d.label) ?? [],
                        ),
                      ).map((d) => ({ value: d, label: d }))
                    : []
                }
              />
            </FormRow>
            {!districtOptions.length && (
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  暂未加载后端区划，将自动按选择的层级写入；如新增城市，
                  在下方详细地址补全即可。
                </Text>
              </Col>
            )}
            <FormRow name="address" label="详细地址" col={24}>
              <Input placeholder="如：文一西路 588 号" />
            </FormRow>
            <FormRow name="developer" label="开发商" col={12}>
              <Input placeholder="请输入开发商名称" />
            </FormRow>
            <FormRow name="decoration_status" label="装修状态" col={12}>
              <Select
                placeholder="请选择"
                options={[
                  { value: '毛坯', label: '毛坯' },
                  { value: '简装', label: '简装' },
                  { value: '精装', label: '精装' },
                ]}
              />
            </FormRow>
            <Col span={12}>
              <Form.Item
                label={<span style={{ fontWeight: text.subtitle.fontWeight, color: palette.ink }}>楼层范围</span>}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name="floor_min" noStyle rules={[{ type: 'number', min: 1, message: '请输入有效楼层' }]}>
                    <InputNumber style={{ width: '48%' }} placeholder="最低" min={1} />
                  </Form.Item>
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 4px', flexShrink: 0 }}>—</span>
                  <Form.Item name="floor_max" noStyle rules={[{ type: 'number', min: 1, message: '请输入有效楼层' }]}>
                    <InputNumber style={{ width: '48%' }} placeholder="最高" min={1} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <SectionTitle title="价格 / 面积" />
          <Row gutter={space.md}>
            <FormRow name="total_price_min" label="最低总价（万）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="200" />
            </FormRow>
            <FormRow name="total_price_max" label="最高总价（万）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="350" />
            </FormRow>
            <FormRow name="price_per_sqm" label="参考均价（元/㎡）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="28000" />
            </FormRow>
            <FormRow name="area_min" label="最小面积（㎡）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="89" />
            </FormRow>
            <FormRow name="area_max" label="最大面积（㎡）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="140" />
            </FormRow>
            <FormRow name="status" label="楼盘状态" col={8}>
              <Select
                options={[
                  { value: '在售', label: '在售' },
                  { value: '已下架', label: '已下架' },
                  { value: '售罄', label: '售罄' },
                ]}
              />
            </FormRow>
          </Row>

          <SectionTitle title="配套信息" />
          <Row gutter={space.md}>
            <FormRow name="school_district" label="对口学校" col={8}>
              <Input placeholder="如：学军小学" />
            </FormRow>
            <FormRow name="metro_distance" label="距地铁（米）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} placeholder="500" />
            </FormRow>
            <FormRow name="plot_ratio" label="容积率" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} precision={2} placeholder="1.8" />
            </FormRow>
            <FormRow name="green_rate" label="绿化率（%）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="30" />
            </FormRow>
            <FormRow name="property_fee" label="物业费（元/㎡·月）" col={8}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="2.5" />
            </FormRow>
          </Row>

          <SectionTitle title="楼盘简介" />
          <Form.Item name="description" style={{ marginTop: 8 }}>
            <Input.TextArea
              rows={3}
              placeholder="请输入楼盘简介，包括特色、配套、卖点等信息"
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </DraggableModal>

      <BatchImportModal
        open={batchOpen}
        onCancel={() => setBatchOpen(false)}
        title="批量导入楼盘"
        endpoint="/api/admin/properties/batch"
        columns={[
          { key: 'name', title: '楼盘名称', required: true },
          { key: 'district', title: '所在区域', required: true },
          { key: 'address', title: '详细地址' },
          { key: 'developer', title: '开发商' },
          { key: 'total_price_min', title: '最低总价', parse: (s) => Number(s) || 0 },
          { key: 'total_price_max', title: '最高总价', parse: (s) => Number(s) || 0 },
          { key: 'area_min', title: '最小面积', parse: (s) => Number(s) || 0 },
          { key: 'area_max', title: '最大面积', parse: (s) => Number(s) || 0 },
          { key: 'floor_min', title: '最低楼层', parse: (s) => Number(s) || undefined },
          { key: 'floor_max', title: '最高楼层', parse: (s) => Number(s) || undefined },
          { key: 'green_rate', title: '绿化率', parse: (s) => Number(s) || 0 },
          { key: 'metro_distance', title: '距地铁', parse: (s) => Number(s) || 0 },
        ]}
        onComplete={() => fetchData()}
      />

      {/* 楼栋房间管理 Drawer */}
      <BuildingDetailDrawer
        open={buildingDetailOpen}
        communityId={selectedCommunityId}
        communityName={selectedCommunityName}
        onClose={() => setBuildingDetailOpen(false)}
      />
    </div>
  );
};

// ────── 小工具组件 ──────
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: `${space.lg}px 0 ${space.sm}px`,
    }}
  >
    <span
      style={{
        width: 4,
        height: 16,
        background: palette.primary,
        borderRadius: 2,
      }}
    />
    <Text
      style={{
        fontSize: 13,
        fontWeight: text.subtitle.fontWeight,
        color: palette.ink,
      }}
    >
      {title}
    </Text>
  </div>
);

function stripEmptyStrings<T extends Record<string, unknown>>(v: T): T {
  const next: Record<string, unknown> = {};
  Object.entries(v).forEach(([k, val]) => {
    if (val === '' || val === null || val === undefined) return;
    next[k] = val;
  });
  return next as T;
}

const FormRow: React.FC<{
  name: string;
  label: ReactNode;
  required?: boolean;
  col: number;
  children: ReactNode;
}> = ({ name, label, required, col, children }) => (
  <Col span={col}>
    <Form.Item
      name={name}
      label={<span style={{ fontWeight: text.subtitle.fontWeight, color: palette.ink }}>{label}</span>}
      rules={required ? [{ required: true, message: `请填写${typeof label === 'string' ? label : '此项'}` }] : []}
    >
      {children}
    </Form.Item>
  </Col>
);

export default AdminProperties;
