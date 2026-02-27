/**
 * 工单委外管理页面
 *
 * 提供工单委外的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持委外发料、委外收货等功能。
 *
 * 根据功能点2.1.10：工单委外管理（核心功能，新增）
 *
 * Author: Auto (AI Assistant)
 * Date: 2026-01-16
 * Updated: 2026-01-20（重命名为工单委外）
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { outsourceWorkOrderApi, outsourceMaterialIssueApi, outsourceMaterialReceiptApi } from '../../../services/production';
import { getOutsourceWorkOrderLifecycle } from '../../../utils/outsourceWorkOrderLifecycle';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import dayjs from 'dayjs';

interface OutsourceWorkOrder {
  id?: number;
  tenantId?: number;
  code?: string;
  name?: string;
  productId?: number;
  productCode?: string;
  productName?: string;
  quantity?: number;
  supplierId?: number;
  supplierCode?: string;
  supplierName?: string;
  outsourceOperation?: string;
  unitPrice?: number;
  totalAmount?: number;
  status?: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  receivedQuantity?: number;
  qualifiedQuantity?: number;
  unqualifiedQuantity?: number;
  issuedQuantity?: number;
  isFrozen?: boolean;
  freezeReason?: string;
  frozenAt?: string;
  frozenBy?: number;
  frozenByName?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const OutsourceWorkOrdersTable: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // 产品列表状态（只显示委外件）
  const [productList, setProductList] = useState<any[]>([]);
  // 供应商列表状态
  const [supplierList, setSupplierList] = useState<any[]>([]);
  // 仓库列表状态
  const [warehouseList, setWarehouseList] = useState<any[]>([]);

  // Modal 相关状态（创建/编辑工单委外）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<OutsourceWorkOrder | null>(null);
  const formRef = useRef<any>(null);

  // 详情 Drawer 相关状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<OutsourceWorkOrder | null>(null);

  // 委外发料 Modal 相关状态
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [currentWorkOrderForIssue, setCurrentWorkOrderForIssue] = useState<OutsourceWorkOrder | null>(null);
  const issueFormRef = useRef<any>(null);

  // 委外收货 Modal 相关状态
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [currentWorkOrderForReceipt, setCurrentWorkOrderForReceipt] = useState<OutsourceWorkOrder | null>(null);
  const receiptFormRef = useRef<any>(null);

  // 当前选中产品的物料来源信息
  const [selectedMaterialSourceInfo, setSelectedMaterialSourceInfo] = useState<{
    sourceType?: string;
    sourceTypeName?: string;
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
    outsourceOperation?: string;
    unitPrice?: number;
    validationErrors?: string[];
    canCreateWorkOrder?: boolean;
  } | null>(null);

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载产品列表（只显示委外件）
        const products = await materialApi.list({ isActive: true });
        // 过滤出委外件（sourceType === 'Outsource'）
        const outsourceProducts = products.filter((p: any) =>
          (p.sourceType === 'Outsource' || p.source_type === 'Outsource')
        );
        setProductList(outsourceProducts);

        // 加载供应商列表
        const suppliers = await supplierApi.list({ isActive: true });
        setSupplierList(suppliers);

        // 加载仓库列表
        const warehouses = await warehouseApi.list({ isActive: true });
        setWarehouseList(warehouses);
      } catch (error) {
        console.error('获取数据失败:', error);
        messageApi.error('获取数据失败');
      }
    };
    loadData();
  }, []);

  /**
   * 处理新建工单委外
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setSelectedMaterialSourceInfo(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑工单委外
   */
  const handleEdit = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentWorkOrder(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          productId: detail.productId || detail.product_id,
          quantity: detail.quantity,
          supplierId: detail.supplierId || detail.supplier_id,
          outsourceOperation: detail.outsourceOperation || detail.outsource_operation,
          unitPrice: detail.unitPrice || detail.unit_price,
          priority: detail.priority,
          plannedStartDate: (detail.plannedStartDate || detail.planned_start_date) ? dayjs(detail.plannedStartDate || detail.planned_start_date) : undefined,
          plannedEndDate: (detail.plannedEndDate || detail.planned_end_date) ? dayjs(detail.plannedEndDate || detail.planned_end_date) : undefined,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理删除工单委外
   */
  const handleDelete = async (record: OutsourceWorkOrder) => {
    try {
      await outsourceWorkOrderApi.delete(record.id!.toString());
      messageApi.success('工单委外删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setWorkOrderDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      // 物料来源验证
      if (values.productId && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error('该物料来源类型不允许创建工单委外，请选择其他物料');
          throw new Error('物料来源类型不允许创建工单委外');
        }
      }

      // 处理日期格式（转换为下划线命名）
      if (values.plannedStartDate) {
        values.planned_start_date = values.plannedStartDate.format('YYYY-MM-DD HH:mm:ss');
        delete values.plannedStartDate;
      }
      if (values.plannedEndDate) {
        values.planned_end_date = values.plannedEndDate.format('YYYY-MM-DD HH:mm:ss');
        delete values.plannedEndDate;
      }

      // 处理产品信息（转换为下划线命名）
      if (values.productId) {
        values.product_id = values.productId;
        delete values.productId;
        const selectedProduct = productList.find(p => p.id === values.product_id);
        if (selectedProduct) {
          values.product_code = selectedProduct.code || selectedProduct.mainCode;
          values.product_name = selectedProduct.name;
        }
      }

      // 处理供应商信息（转换为下划线命名）
      if (values.supplierId) {
        values.supplier_id = values.supplierId;
        delete values.supplierId;
        const selectedSupplier = supplierList.find(s => s.id === values.supplier_id);
        if (selectedSupplier) {
          values.supplier_code = selectedSupplier.code;
          values.supplier_name = selectedSupplier.name;
        }
      }

      // 如果从物料来源信息中获取了委外工序和单价，使用它们（转换为下划线命名）
      if (selectedMaterialSourceInfo) {
        if (!values.outsource_operation && selectedMaterialSourceInfo.outsourceOperation) {
          values.outsource_operation = selectedMaterialSourceInfo.outsourceOperation;
        }
        if (!values.unit_price && selectedMaterialSourceInfo.unitPrice) {
          values.unit_price = selectedMaterialSourceInfo.unitPrice;
        }
        if (!values.supplier_id && selectedMaterialSourceInfo.supplierId) {
          values.supplier_id = selectedMaterialSourceInfo.supplierId;
          values.supplier_code = selectedMaterialSourceInfo.supplierCode;
          values.supplier_name = selectedMaterialSourceInfo.supplierName;
        }
      }

      // 处理委外工序（转换为下划线命名）
      if (values.outsourceOperation) {
        values.outsource_operation = values.outsourceOperation;
        delete values.outsourceOperation;
      }

      // 计算总金额（转换为下划线命名）
      if (values.quantity && values.unit_price) {
        values.total_amount = values.quantity * values.unit_price;
      } else if (values.quantity && values.unitPrice) {
        values.unit_price = values.unitPrice;
        delete values.unitPrice;
        values.total_amount = values.quantity * values.unit_price;
      }

      if (isEdit && currentWorkOrder?.id) {
        await outsourceWorkOrderApi.update(currentWorkOrder.id.toString(), values);
        messageApi.success('工单委外更新成功');
      } else {
        await outsourceWorkOrderApi.create(values);
        messageApi.success('工单委外创建成功');
      }
      setModalVisible(false);
      setSelectedMaterialSourceInfo(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理委外发料
   */
  const handleIssue = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForIssue(detail);
      setIssueModalVisible(true);
      setTimeout(() => {
        issueFormRef.current?.resetFields();
      }, 100);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交委外发料
   */
  const handleSubmitIssue = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForIssue?.id) {
        throw new Error('工单委外信息不存在');
      }

      const submitData = {
        outsource_work_order_id: currentWorkOrderForIssue.id,
        outsource_work_order_code: currentWorkOrderForIssue.code,
        material_id: values.materialId,
        material_code: values.materialCode,
        material_name: values.materialName,
        quantity: values.quantity,
        unit: values.unit,
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        location_id: values.locationId,
        location_name: values.locationName,
        batch_number: values.batchNumber,
        remarks: values.remarks,
      };

      await outsourceMaterialIssueApi.create(submitData);
      messageApi.success('委外发料单创建成功');
      setIssueModalVisible(false);
      setCurrentWorkOrderForIssue(null);
      issueFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建委外发料单失败');
      throw error;
    }
  };

  /**
   * 处理委外收货
   */
  const handleReceipt = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForReceipt(detail);
      setReceiptModalVisible(true);
      setTimeout(() => {
        receiptFormRef.current?.setFieldsValue({
          quantity: detail.quantity! - (detail.receivedQuantity || 0),
          qualifiedQuantity: detail.quantity! - (detail.receivedQuantity || 0),
          unit: 'PC', // 默认单位
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交委外收货
   */
  const handleSubmitReceipt = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForReceipt?.id) {
        throw new Error('工单委外信息不存在');
      }

      const submitData = {
        outsource_work_order_id: currentWorkOrderForReceipt.id,
        outsource_work_order_code: currentWorkOrderForReceipt.code,
        quantity: values.quantity,
        qualified_quantity: values.qualifiedQuantity || 0,
        unqualified_quantity: values.unqualifiedQuantity || 0,
        unit: values.unit || 'PC',
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        location_id: values.locationId,
        location_name: values.locationName,
        batch_number: values.batchNumber,
        remarks: values.remarks,
      };

      await outsourceMaterialReceiptApi.create(submitData);
      messageApi.success('委外收货单创建成功');
      setReceiptModalVisible(false);
      setCurrentWorkOrderForReceipt(null);
      receiptFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建委外收货单失败');
      throw error;
    }
  };

  // 定义表格列
  const columns: ProColumns<OutsourceWorkOrder>[] = [
    {
      title: '工单委外编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工单委外名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品编码',
      dataIndex: ['productCode', 'product_code'],
      width: 120,
      render: (_, record) => record.productCode || record.product_code,
    },
    {
      title: '产品名称',
      dataIndex: ['productName', 'product_name'],
      width: 200,
      ellipsis: true,
      render: (_, record) => record.productName || record.product_name,
    },
    {
      title: '委外数量',
      dataIndex: 'quantity',
      width: 100,
      render: (_, record) => record.quantity?.toFixed(2),
    },
    {
      title: '委外供应商',
      dataIndex: ['supplierName', 'supplier_name'],
      width: 150,
      render: (_, record) => record.supplierName || record.supplier_name,
    },
    {
      title: '委外工序',
      dataIndex: ['outsourceOperation', 'outsource_operation'],
      width: 150,
      render: (_, record) => record.outsourceOperation || record.outsource_operation,
    },
    {
      title: '委外单价',
      dataIndex: ['unitPrice', 'unit_price'],
      width: 100,
      render: (_, record) => {
        const price = record.unitPrice || record.unit_price;
        return price ? `¥${Number(price).toFixed(2)}` : '-';
      },
    },
    {
      title: '委外总金额',
      dataIndex: ['totalAmount', 'total_amount'],
      width: 120,
      render: (_, record) => {
        const amount = record.totalAmount || record.total_amount;
        return amount ? `¥${Number(amount).toFixed(2)}` : '-';
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getOutsourceWorkOrderLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = { 草稿: 'default', 已下达: 'processing', 执行中: 'processing', 已完成: 'success', 已取消: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_, record) => {
        const priorityMap: Record<string, { color: string; text: string }> = {
          low: { color: 'default', text: '低' },
          normal: { color: 'blue', text: '正常' },
          high: { color: 'orange', text: '高' },
          urgent: { color: 'red', text: '紧急' },
        };
        const priority = priorityMap[record.priority || 'normal'] || { color: 'default', text: record.priority || '正常' };
        return <Tag color={priority.color}>{priority.text}</Tag>;
      },
    },
    {
      title: '已发料数量',
      dataIndex: ['issuedQuantity', 'issued_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.issuedQuantity || record.issued_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '已收货数量',
      dataIndex: ['receivedQuantity', 'received_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.receivedQuantity || record.received_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '合格数量',
      dataIndex: ['qualifiedQuantity', 'qualified_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.qualifiedQuantity || record.qualified_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '计划开始时间',
      dataIndex: ['plannedStartDate', 'planned_start_date'],
      width: 150,
      render: (_, record) => {
        const date = record.plannedStartDate || record.planned_start_date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: '计划结束时间',
      dataIndex: ['plannedEndDate', 'planned_end_date'],
      width: 150,
      render: (_, record) => {
        const date = record.plannedEndDate || record.planned_end_date;
        return date ? dayjs(date).format('YYYY-MM-DD') : '-';
      },
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
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            disabled={record.status === 'completed' || record.status === 'cancelled'}
          >
            编辑
          </Button>
          {(record.status === 'released' || record.status === 'in_progress') && (
            <Button
              type="link"
              size="small"
              onClick={() => handleIssue(record)}
            >
              发料
            </Button>
          )}
          {(record.status === 'released' || record.status === 'in_progress') && (
            <Button
              type="link"
              size="small"
              onClick={() => handleReceipt(record)}
            >
              收货
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 定义详情列
  const detailColumns: ProDescriptionsItemType<OutsourceWorkOrder>[] = [
    {
      title: '工单委外编码',
      dataIndex: 'code',
    },
    {
      title: '工单委外名称',
      dataIndex: 'name',
    },
    {
      title: '产品编码',
      dataIndex: ['productCode', 'product_code'],
      render: (_, record) => record.productCode || record.product_code,
    },
    {
      title: '产品名称',
      dataIndex: ['productName', 'product_name'],
      render: (_, record) => record.productName || record.product_name,
    },
    {
      title: '委外数量',
      dataIndex: 'quantity',
      render: (_, record) => record.quantity?.toFixed(2),
    },
    {
      title: '委外供应商',
      dataIndex: ['supplierName', 'supplier_name'],
      render: (_, record) => record.supplierName || record.supplier_name,
    },
    {
      title: '委外工序',
      dataIndex: ['outsourceOperation', 'outsource_operation'],
      render: (_, record) => record.outsourceOperation || record.outsource_operation,
    },
    {
      title: '委外单价',
      dataIndex: ['unitPrice', 'unit_price'],
      render: (_, record) => {
        const price = record.unitPrice || record.unit_price;
        return price ? `¥${Number(price).toFixed(2)}` : '-';
      },
    },
    {
      title: '委外总金额',
      dataIndex: ['totalAmount', 'total_amount'],
      render: (_, record) => {
        const amount = record.totalAmount || record.total_amount;
        return amount ? `¥${Number(amount).toFixed(2)}` : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: '草稿' },
          released: { color: 'processing', text: '已下达' },
          in_progress: { color: 'processing', text: '执行中' },
          completed: { color: 'success', text: '已完成' },
          cancelled: { color: 'error', text: '已取消' },
        };
        const status = statusMap[record.status || 'draft'] || { color: 'default', text: record.status || '未知' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      render: (_, record) => {
        const priorityMap: Record<string, { color: string; text: string }> = {
          low: { color: 'default', text: '低' },
          normal: { color: 'blue', text: '正常' },
          high: { color: 'orange', text: '高' },
          urgent: { color: 'red', text: '紧急' },
        };
        const priority = priorityMap[record.priority || 'normal'] || { color: 'default', text: record.priority || '正常' };
        return <Tag color={priority.color}>{priority.text}</Tag>;
      },
    },
    {
      title: '已发料数量',
      dataIndex: ['issuedQuantity', 'issued_quantity'],
      render: (_, record) => {
        const qty = record.issuedQuantity || record.issued_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '已收货数量',
      dataIndex: ['receivedQuantity', 'received_quantity'],
      render: (_, record) => {
        const qty = record.receivedQuantity || record.received_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '合格数量',
      dataIndex: ['qualifiedQuantity', 'qualified_quantity'],
      render: (_, record) => {
        const qty = record.qualifiedQuantity || record.qualified_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '不合格数量',
      dataIndex: ['unqualifiedQuantity', 'unqualified_quantity'],
      render: (_, record) => {
        const qty = record.unqualifiedQuantity || record.unqualified_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '计划开始时间',
      dataIndex: ['plannedStartDate', 'planned_start_date'],
      render: (_, record) => {
        const date = record.plannedStartDate || record.planned_start_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '计划结束时间',
      dataIndex: ['plannedEndDate', 'planned_end_date'],
      render: (_, record) => {
        const date = record.plannedEndDate || record.planned_end_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '实际开始时间',
      dataIndex: ['actualStartDate', 'actual_start_date'],
      render: (_, record) => {
        const date = record.actualStartDate || record.actual_start_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '实际结束时间',
      dataIndex: ['actualEndDate', 'actual_end_date'],
      render: (_, record) => {
        const date = record.actualEndDate || record.actual_end_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
    },
  ];

  return (
    <>
      <UniTable<OutsourceWorkOrder>
        headerTitle="工单委外管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const response = await outsourceWorkOrderApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...params,
            });

            if (Array.isArray(response)) {
              return {
                data: response,
                success: true,
                total: response.length,
              };
            } else if (response && typeof response === 'object') {
              return {
                data: response.data || response.items || [],
                success: response.success !== false,
                total: response.total || (response.data || response.items || []).length,
              };
            }

            return {
              data: [],
              success: false,
              total: 0,
            };
          } catch (error) {
            console.error('获取工单委外列表失败:', error);
            messageApi.error('获取工单委外列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建工单委外
          </Button>,
        ]}
        onDelete={handleDelete}
      />

      {/* 创建/编辑工单委外 Modal */}
      < FormModalTemplate
        title={isEdit ? '编辑工单委外' : '新建工单委外'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentWorkOrder(null);
          setSelectedMaterialSourceInfo(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        {/* 基本信息组 */}
        < Divider > 基本信息</Divider >
        <ProFormText
          name="name"
          label="工单委外名称"
          placeholder="请输入工单委外名称（可选）"
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="productId"
          label="产品选择"
          placeholder="请选择产品（委外件）"
          options={productList.map(product => ({
            label: `${product.code || product.mainCode} - ${product.name}`,
            value: product.id,
          }))}
          rules={[{ required: true, message: '请选择产品' }]}
          disabled={isEdit}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            onChange: async (value: number | undefined) => {
              if (value) {
                const selectedMaterial = productList.find(p => p.id === value);
                if (selectedMaterial) {
                  try {
                    const materialDetail = await materialApi.get(selectedMaterial.uuid);
                    const sourceType = materialDetail.sourceType || materialDetail.source_type;
                    const sourceConfig = materialDetail.sourceConfig || materialDetail.source_config || {};

                    const sourceTypeNames: Record<string, string> = {
                      'Make': '自制件',
                      'Buy': '采购件',
                      'Phantom': '虚拟件',
                      'Outsource': '委外件',
                      'Configure': '配置件',
                    };

                    if (sourceType === 'Outsource') {
                      // 委外件，获取委外配置
                      const supplierId = sourceConfig.outsource_supplier_id;
                      const supplierCode = sourceConfig.outsource_supplier_code;
                      const supplierName = sourceConfig.outsource_supplier_name;
                      const outsourceOperation = sourceConfig.outsource_operation;
                      const unitPrice = sourceConfig.outsource_price;

                      setSelectedMaterialSourceInfo({
                        sourceType,
                        sourceTypeName: sourceTypeNames[sourceType] || sourceType,
                        supplierId,
                        supplierCode,
                        supplierName,
                        outsourceOperation,
                        unitPrice,
                        canCreateWorkOrder: true,
                      });

                      // 自动填充表单
                      if (supplierId) {
                        formRef.current?.setFieldsValue({
                          supplierId,
                          outsourceOperation,
                          unitPrice,
                        });
                      }
                    } else {
                      setSelectedMaterialSourceInfo({
                        sourceType,
                        sourceTypeName: sourceTypeNames[sourceType] || sourceType,
                        canCreateWorkOrder: false,
                        validationErrors: [`物料来源类型不是委外件（Outsource），当前类型：${sourceType}`],
                      });
                    }
                  } catch (error) {
                    console.error('获取物料详情失败:', error);
                    setSelectedMaterialSourceInfo(null);
                  }
                } else {
                  setSelectedMaterialSourceInfo(null);
                }
              } else {
                setSelectedMaterialSourceInfo(null);
              }
            }
          }}
          colProps={{ span: 12 }}
        />
        {/* 物料来源信息显示 */}
        {
          selectedMaterialSourceInfo && (
            <div style={{ marginTop: -16, marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: 4, gridColumn: 'span 24' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 'bold' }}>物料来源类型：</span>
                <Tag color="cyan">
                  {selectedMaterialSourceInfo.sourceTypeName || selectedMaterialSourceInfo.sourceType || '未配置'}
                </Tag>
              </div>
              {selectedMaterialSourceInfo.validationErrors && selectedMaterialSourceInfo.validationErrors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {selectedMaterialSourceInfo.validationErrors.map((error, index) => (
                    <div key={index} style={{ color: '#ff4d4f', marginBottom: 4 }}>
                      ❌ {error}
                    </div>
                  ))}
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder === false && (
                <div style={{ marginTop: 8, color: '#ff4d4f', fontWeight: 'bold' }}>
                  该物料来源类型不允许创建工单委外，请选择委外件物料
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder && (
                <div style={{ marginTop: 8, color: '#52c41a' }}>
                  ✓ 物料来源验证通过，可以创建工单委外
                  {selectedMaterialSourceInfo.supplierName && (
                    <span style={{ marginLeft: 16 }}>
                      默认供应商：{selectedMaterialSourceInfo.supplierName}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.outsourceOperation && (
                    <span style={{ marginLeft: 16 }}>
                      委外工序：{selectedMaterialSourceInfo.outsourceOperation}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.unitPrice && (
                    <span style={{ marginLeft: 16 }}>
                      委外单价：¥{selectedMaterialSourceInfo.unitPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        }
        <ProFormDigit
          name="quantity"
          label="计划委外数量"
          placeholder="请输入计划委外数量"
          min={0}
          precision={2}
          rules={[{ required: true, message: '请输入计划委外数量' }]}
          fieldProps={{
            onChange: (value: number | null) => {
              if (value !== null && value !== undefined) {
                const unitPrice = formRef.current?.getFieldValue('unitPrice');
                if (unitPrice) {
                  formRef.current?.setFieldsValue({
                    totalAmount: value * unitPrice,
                  });
                }
              }
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="supplierId"
          label="委外供应商"
          placeholder="请选择委外供应商"
          options={supplierList.map(supplier => ({
            label: `${supplier.code} - ${supplier.name}`,
            value: supplier.id,
          }))}
          rules={[{ required: true, message: '请选择委外供应商' }]}
          disabled={isEdit}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="outsourceOperation"
          label="委外工序"
          placeholder="请输入委外工序（将从物料配置中自动填充）"
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="unitPrice"
          label="委外单价"
          placeholder="请输入委外单价（将从物料配置中自动填充）"
          min={0}
          precision={2}
          fieldProps={{
            onChange: (value: number | null) => {
              if (value !== null && value !== undefined) {
                const quantity = formRef.current?.getFieldValue('quantity');
                if (quantity) {
                  formRef.current?.setFieldsValue({
                    totalAmount: quantity * value,
                  });
                }
              }
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="totalAmount"
          label="委外总金额"
          placeholder="自动计算（数量 × 单价）"
          disabled={true}
          colProps={{ span: 12 }}
          fieldProps={{
            formatter: (value) => value ? `¥${Number(value).toFixed(2)}` : '¥0.00',
          }}
        />

        {/* 优先级和时间组 */}
        <Divider>优先级和时间</Divider>
        <ProFormSelect
          name="priority"
          label="优先级"
          placeholder="请选择优先级"
          options={[
            { label: '低', value: 'low' },
            { label: '正常', value: 'normal' },
            { label: '高', value: 'high' },
            { label: '紧急', value: 'urgent' },
          ]}
          initialValue="normal"
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="plannedStartDate"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          width="md"
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="plannedEndDate"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          width="md"
          colProps={{ span: 12 }}
        />

        {/* 备注组 */}
        <Divider>备注信息</Divider>
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{
            rows: 4,
          }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate >

      {/* 工单委外详情 Drawer */}
      < DetailDrawerTemplate<OutsourceWorkOrder>
        title={`工单委外详情 - ${workOrderDetail?.code || ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setWorkOrderDetail(null);
        }}
        dataSource={workOrderDetail || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.HALF_WIDTH}
      />

      {/* 委外发料 Modal */}
      < FormModalTemplate
        title="委外发料"
        open={issueModalVisible}
        onClose={() => {
          setIssueModalVisible(false);
          setCurrentWorkOrderForIssue(null);
          issueFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitIssue}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={issueFormRef}
      >
        {currentWorkOrderForIssue && (
          <>
            <Divider>工单委外信息</Divider>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div><strong>工单委外编码：</strong>{currentWorkOrderForIssue.code}</div>
              <div><strong>产品名称：</strong>{currentWorkOrderForIssue.productName || currentWorkOrderForIssue.product_name}</div>
              <div><strong>委外数量：</strong>{currentWorkOrderForIssue.quantity?.toFixed(2)}</div>
              <div><strong>已发料数量：</strong>{(currentWorkOrderForIssue.issuedQuantity || currentWorkOrderForIssue.issued_quantity || 0).toFixed(2)}</div>
            </div>
            <Divider>发料信息</Divider>
            <ProFormSelect
              name="materialId"
              label="原材料"
              placeholder="请选择原材料"
              rules={[{ required: true, message: '请选择原材料' }]}
              request={async () => {
                try {
                  const materials = await materialApi.list({ isActive: true, materialType: 'RAW' });
                  return materials.map((m: any) => ({
                    label: `${m.code || m.mainCode} - ${m.name}`,
                    value: m.id,
                  }));
                } catch (error) {
                  return [];
                }
              }}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                onChange: async (value: number | undefined) => {
                  if (value) {
                    const materials = await materialApi.list({ isActive: true });
                    const material = materials.find((m: any) => m.id === value);
                    if (material) {
                      issueFormRef.current?.setFieldsValue({
                        materialCode: material.code || material.mainCode,
                        materialName: material.name,
                        unit: material.baseUnit || 'PC',
                      });
                    }
                  }
                }
              }}
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="materialCode"
              label="物料编码"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="materialName"
              label="物料名称"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="quantity"
              label="发料数量"
              placeholder="请输入发料数量"
              min={0}
              precision={2}
              rules={[{ required: true, message: '请输入发料数量' }]}
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="unit"
              label="单位"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormSelect
              name="warehouseId"
              label="仓库"
              placeholder="请选择仓库"
              options={warehouseList.map(warehouse => ({
                label: `${warehouse.code} - ${warehouse.name}`,
                value: warehouse.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                onChange: (value: number | undefined) => {
                  if (value) {
                    const warehouse = warehouseList.find(w => w.id === value);
                    if (warehouse) {
                      issueFormRef.current?.setFieldsValue({
                        warehouseName: warehouse.name,
                      });
                    }
                  }
                }
              }}
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="warehouseName"
              label="仓库名称"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="batchNumber"
              label="批次号"
              placeholder="请输入批次号（可选）"
              colProps={{ span: 12 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{
                rows: 4,
              }}
              colProps={{ span: 24 }}
            />
          </>
        )}
      </FormModalTemplate >

      {/* 委外收货 Modal */}
      < FormModalTemplate
        title="委外收货"
        open={receiptModalVisible}
        onClose={() => {
          setReceiptModalVisible(false);
          setCurrentWorkOrderForReceipt(null);
          receiptFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitReceipt}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={receiptFormRef}
      >
        {currentWorkOrderForReceipt && (
          <>
            <Divider>工单委外信息</Divider>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <div><strong>工单委外编码：</strong>{currentWorkOrderForReceipt.code}</div>
              <div><strong>产品名称：</strong>{currentWorkOrderForReceipt.productName || currentWorkOrderForReceipt.product_name}</div>
              <div><strong>委外数量：</strong>{currentWorkOrderForReceipt.quantity?.toFixed(2)}</div>
              <div><strong>已收货数量：</strong>{(currentWorkOrderForReceipt.receivedQuantity || currentWorkOrderForReceipt.received_quantity || 0).toFixed(2)}</div>
              <div><strong>剩余数量：</strong>{(currentWorkOrderForReceipt.quantity! - (currentWorkOrderForReceipt.receivedQuantity || currentWorkOrderForReceipt.received_quantity || 0)).toFixed(2)}</div>
            </div>
            <Divider>收货信息</Divider>
            <ProFormDigit
              name="quantity"
              label="收货数量"
              placeholder="请输入收货数量"
              min={0}
              precision={2}
              rules={[{ required: true, message: '请输入收货数量' }]}
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="qualifiedQuantity"
              label="合格数量"
              placeholder="请输入合格数量"
              min={0}
              precision={2}
              rules={[{ required: true, message: '请输入合格数量' }]}
              colProps={{ span: 12 }}
            />
            <ProFormDigit
              name="unqualifiedQuantity"
              label="不合格数量"
              placeholder="请输入不合格数量"
              min={0}
              precision={2}
              initialValue={0}
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="unit"
              label="单位"
              initialValue="PC"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormSelect
              name="warehouseId"
              label="仓库"
              placeholder="请选择仓库"
              options={warehouseList.map(warehouse => ({
                label: `${warehouse.code} - ${warehouse.name}`,
                value: warehouse.id,
              }))}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
                onChange: (value: number | undefined) => {
                  if (value) {
                    const warehouse = warehouseList.find(w => w.id === value);
                    if (warehouse) {
                      receiptFormRef.current?.setFieldsValue({
                        warehouseName: warehouse.name,
                      });
                    }
                  }
                }
              }}
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="warehouseName"
              label="仓库名称"
              disabled
              colProps={{ span: 12 }}
            />
            <ProFormText
              name="batchNumber"
              label="批次号"
              placeholder="请输入批次号（可选）"
              colProps={{ span: 12 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{
                rows: 4,
              }}
              colProps={{ span: 24 }}
            />
          </>
        )}
      </FormModalTemplate >
    </>
  );
};

const OutsourceWorkOrdersPage: React.FC = () => {
  return (
    <ListPageTemplate>
      <OutsourceWorkOrdersTable />
    </ListPageTemplate>
  );
};

export default OutsourceWorkOrdersPage;
