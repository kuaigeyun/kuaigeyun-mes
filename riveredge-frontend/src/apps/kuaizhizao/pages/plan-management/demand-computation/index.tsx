/**
 * 统一需求计算页面
 *
 * 提供统一的需求计算功能，支持MRP和LRP两种计算类型。
 *
 * 根据《☆ 用户使用全场景推演.md》的设计理念，将MRP和LRP合并为统一的需求计算。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDigit, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, message } from 'antd';
import { PlayCircleOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  listDemandComputations,
  getDemandComputation,
  createDemandComputation,
  executeDemandComputation,
  DemandComputation,
  DemandComputationItem
} from '../../../services/demand-computation';
import { listDemands, Demand } from '../../../services/demand';

const DemandComputationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  
  // Modal 相关状态（新建计算）
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDemandId, setSelectedDemandId] = useState<number | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentComputation, setCurrentComputation] = useState<DemandComputation | null>(null);
  
  // 需求列表（用于选择需求）
  const [demandList, setDemandList] = useState<Demand[]>([]);

  /**
   * 处理新建计算
   */
  const handleCreate = async () => {
    try {
      // 加载已审核通过的需求列表
      const demands = await listDemands({ status: '已审核', review_status: '通过', limit: 100 });
      setDemandList(demands.data || []);
      setSelectedDemandId(null);
      setModalVisible(true);
      formRef.current?.resetFields();
    } catch (error: any) {
      messageApi.error('加载需求列表失败');
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getDemandComputation(id, true);
        setCurrentComputation(data);
        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取计算详情失败');
      }
    }
  };

  /**
   * 处理执行计算
   */
  const handleExecute = async (record: DemandComputation) => {
    Modal.confirm({
      title: '执行需求计算',
      content: `确认要执行计算 ${record.computation_code} 吗？`,
      onOk: async () => {
        try {
          await executeDemandComputation(record.id!);
          messageApi.success('计算执行成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error('计算执行失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DemandComputation>[] = [
    {
      title: '计算编码',
      dataIndex: 'computation_code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '需求编码',
      dataIndex: 'demand_code',
      width: 150,
    },
    {
      title: '计算类型',
      dataIndex: 'computation_type',
      width: 100,
      render: (text: string) => (
        <Tag color={text === 'MRP' ? 'blue' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '计算状态',
      dataIndex: 'computation_status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '进行中': 'processing',
          '计算中': 'processing',
          '完成': 'success',
          '失败': 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'computation_start_time',
      width: 160,
      valueType: 'dateTime',
    },
    {
      title: '结束时间',
      dataIndex: 'computation_end_time',
      width: 160,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          {record.computation_status === '进行中' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(record)}
            >
              执行
            </Button>
          )}
        </Space>
      ),
    },
  ];
