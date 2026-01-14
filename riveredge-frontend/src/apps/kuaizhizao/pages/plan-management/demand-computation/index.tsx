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
