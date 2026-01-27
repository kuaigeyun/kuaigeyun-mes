/**
 * 销售订单管理页面
 *
 * 提供销售订单的独立管理功能，支持MTO模式。
 * 销售订单可以下推到需求管理（需求计算）。
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, Input, InputNumber, Popconfirm, Select, Row, Col } from 'antd';
import { EyeOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { 
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  submitSalesOrder,
  approveSalesOrder,
  rejectSalesOrder,
  pushSalesOrderToComputation,
  SalesOrder,
  SalesOrderItem,
  type PushToComputationResponse
} from '../../../services/sales-order';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentRelationDisplay from '../../../../../components/document-relation-display';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';

const SalesOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  
  // Modal 相关状态（新建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSalesOrder, setCurrentSalesOrder] = useState<SalesOrder | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);
  
  // 订单明细状态
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  
  // 物料列表（用于物料选择器）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  // 新建时预览的订单编码（用于提交时判断是否需正式占号）
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
        messageApi.error('加载物料列表失败');
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, [messageApi]);

  /**
   * 处理新建销售订单
   * 若启用编码规则，用 testGenerateCode 预填订单编码（不占用序号）
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentId(null);
    setOrderItems([]);
    setEditingItemIndex(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    if (isAutoGenerateEnabled('kuaizhizao-sales-order')) {
      const ruleCode = getPageRuleCode('kuaizhizao-sales-order');
      if (ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ order_code: preview ?? '' });
        } catch (error: any) {
          console.warn('销售订单编码预生成失败:', error);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } else {
      setPreviewCode(null);
    }
  };

  /**
   * 处理编辑销售订单
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getSalesOrder(id, true);  // includeItems=true
        formRef.current?.setFieldsValue(data);
        // 加载订单明细，如果material_id不存在，尝试通过物料编码或名称匹配
        const items = (data.items || []).map(item => {
          // 如果已经有material_id，直接使用
          if (item.material_id) {
            return item;
          }
          // 否则尝试从物料列表中查找匹配的物料
          const matchedMaterial = materials.find(m => 
            (m.mainCode || m.code) === item.material_code || m.name === item.material_name
          );
          if (matchedMaterial) {
            return {
              ...item,
              material_id: matchedMaterial.id,
              material_code: matchedMaterial.mainCode || matchedMaterial.code || item.material_code,
              material_name: matchedMaterial.name || item.material_name,
              material_spec: matchedMaterial.specification || item.material_spec,
              material_unit: matchedMaterial.baseUnit || item.material_unit,
            };
          }
          return item;
        });
        setOrderItems(items);
        setEditingItemIndex(null);
      } catch (error: any) {
        messageApi.error('获取销售订单详情失败');
      }
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getSalesOrder(id, true, true);  // includeItems=true, includeDuration=true
        setCurrentSalesOrder(data);
        
        // 获取单据关联关系（使用 sales_order 作为文档类型）
        try {
          const relations = await getDocumentRelations('sales_order', id);
          setDocumentRelations(relations);
        } catch (error) {
          console.error('获取单据关联关系失败:', error);
          setDocumentRelations(null);
        }
        
        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取销售订单详情失败');
      }
    }
  };

  /**
   * 处理删除销售订单
   */
  const handleDelete = async (_keys: React.Key[]) => {
    // TODO: 实现删除功能
    messageApi.info('删除功能待实现');
  };

  /**
   * 处理提交表单
   * 新建且启用编码规则时：若订单编码未改或为空，则正式生成编码再创建
   */
  const handleSubmit = async (values: any) => {
    try {
      // 验证明细
      if (!orderItems || orderItems.length === 0) {
        messageApi.warning('请至少添加一条订单明细');
        return;
      }
      values.items = orderItems;
      if (isEdit && currentId) {
        await updateSalesOrder(currentId, values);
        messageApi.success('销售订单更新成功');
      } else {
        if (isAutoGenerateEnabled('kuaizhizao-sales-order')) {
          const ruleCode = getPageRuleCode('kuaizhizao-sales-order');
          const currentCode = values.order_code;
          if (ruleCode && (currentCode === previewCode || !currentCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.order_code = codeResponse.code;
            } catch (error: any) {
              console.warn('正式生成订单编码失败，使用预览编码:', error);
            }
          }
        }
        await createSalesOrder(values);
        messageApi.success('销售订单创建成功');
      }
      setModalVisible(false);
      setPreviewCode(null);
      setOrderItems([]);
      setEditingItemIndex(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 添加订单明细
   */
  const handleAddItem = () => {
    const newItem: SalesOrderItem = {
      material_id: undefined,
      material_code: '',
      material_name: '',
      material_spec: '',
      material_unit: '',
      required_quantity: 0,
      delivery_date: '',
      unit_price: 0,
      item_amount: 0,
    };
    setOrderItems([...orderItems, newItem]);
    setEditingItemIndex(orderItems.length);
  };

  /**
   * 删除订单明细
   */
  const handleDeleteItem = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
    } else if (editingItemIndex !== null && editingItemIndex > index) {
      setEditingItemIndex(editingItemIndex - 1);
    }
  };

  /**
   * 更新订单明细
   */
  const handleUpdateItem = (index: number, field: keyof SalesOrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    
    // 自动计算金额
    if (field === 'required_quantity' || field === 'unit_price') {
      const quantity = field === 'required_quantity' ? value : (newItems[index].required_quantity || 0);
      const price = field === 'unit_price' ? value : (newItems[index].unit_price || 0);
      newItems[index].item_amount = quantity * price;
    }
    
    setOrderItems(newItems);
  };

  /**
   * 处理物料选择
   */
  const handleMaterialSelect = (index: number, materialUuid: string) => {
    const material = materials.find(m => m.uuid === materialUuid);
    if (material) {
      const newItems = [...orderItems];
      newItems[index] = {
        ...newItems[index],
        material_id: material.id,
        material_code: material.mainCode || material.code || '',
        material_name: material.name || '',
        material_spec: material.specification || '',
        material_unit: material.baseUnit || '',
      };
      setOrderItems(newItems);
    }
  };

  /**
   * 处理提交销售订单
   */
  const handleSubmitDemand = async (id: number) => {
    Modal.confirm({
      title: '提交销售订单',
      content: '确定要提交此销售订单吗？提交后将进入审核流程。',
      onOk: async () => {
        try {
          await submitSalesOrder(id);
          messageApi.success('销售订单提交成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交失败');
        }
      },
    });
  };

  /**
   * 处理审核通过
   */
  const handleApprove = async (id: number) => {
    Modal.confirm({
      title: '审核通过',
      content: '确定要审核通过此销售订单吗？',
      onOk: async () => {
        try {
          await approveSalesOrder(id);
          messageApi.success('销售订单审核通过');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '审核失败');
        }
      },
    });
  };

  /**
   * 处理下推到需求计算
   */
  const handlePushToComputation = async (id: number) => {
    Modal.confirm({
      title: '下推到需求计算',
      content: '确定要将此销售订单下推到需求计算吗？',
      onOk: async () => {
        try {
          await pushSalesOrderToComputation(id);
          messageApi.success('下推成功，已创建需求计算任务');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推失败');
        }
      },
    });
  };

  /**
   * 处理批量导入
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
      return;
    }

    try {
      // 第一行是表头，从第二行开始是数据
      const headers = data[0];
      const rows = data.slice(1);

      // 字段映射（表头名称 -> 字段名）（订单名称已去掉，不填时后端以订单编码作为展示名）
      const fieldMap: Record<string, string> = {
        '订单日期': 'order_date',
        '交货日期': 'delivery_date',
        '客户ID': 'customer_id',
        '客户名称': 'customer_name',
        '客户联系人': 'customer_contact',
        '客户电话': 'customer_phone',
        '销售员ID': 'salesman_id',
        '销售员姓名': 'salesman_name',
        '收货地址': 'shipping_address',
        '发货方式': 'shipping_method',
        '付款条件': 'payment_terms',
        '备注': 'notes',
      };

      // 转换数据
      const salesOrders: Partial<SalesOrder>[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
          continue; // 跳过空行
        }

        const salesOrder: any = {
          status: '草稿',
          review_status: '待审核',
        };

        // 映射字段
        for (let j = 0; j < headers.length && j < row.length; j++) {
          const header = headers[j]?.toString().trim();
          const value = row[j]?.toString().trim();
          
          if (!header || !value) continue;

          const fieldName = fieldMap[header];
          if (fieldName) {
            // 处理日期字段
            if (fieldName.includes('date')) {
              salesOrder[fieldName] = value;
            }
            // 处理数字字段
            else if (fieldName.includes('_id')) {
              salesOrder[fieldName] = value ? parseInt(value, 10) : null;
            }
            // 其他字段直接赋值
            else {
              salesOrder[fieldName] = value;
            }
          }
        }

        salesOrders.push(salesOrder);
      }

      if (salesOrders.length === 0) {
        messageApi.warning('没有有效的数据行');
        return;
      }

      // 批量创建销售订单
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ row: number; error: string }> = [];
      
      for (let i = 0; i < salesOrders.length; i++) {
        const order = salesOrders[i];
        try {
          await createSalesOrder(order);
          successCount++;
        } catch (error: any) {
          failureCount++;
          errors.push({
            row: i + 2, // +2 因为第一行是表头，索引从0开始
            error: error.message || '创建失败',
          });
          console.error('创建销售订单失败:', error);
        }
      }
      
      if (failureCount === 0) {
        messageApi.success(`批量导入成功！成功导入 ${successCount} 条销售订单`);
        actionRef.current?.reload();
      } else {
        messageApi.warning(
          `批量导入完成，成功 ${successCount} 条，失败 ${failureCount} 条`
        );
        // 显示错误详情
        if (errors.length > 0) {
          const errorMessages = errors
            .slice(0, 10) // 只显示前10个错误
            .map(err => `第 ${err.row} 行: ${err.error}`)
            .join('\n');
          Modal.error({
            title: '导入错误详情',
            content: <pre style={{ whiteSpace: 'pre-wrap' }}>{errorMessages}</pre>,
            width: 600,
          });
        }
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || '批量导入失败');
    }
  };

  // 定义表格列
  const columns: ProColumns<SalesOrder>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
      width: 150,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'Default' },
        '已提交': { text: '已提交', status: 'Processing' },
        '已审核': { text: '已审核', status: 'Success' },
        '已生效': { text: '已生效', status: 'Success' },
        '已完成': { text: '已完成', status: 'Success' },
        '已取消': { text: '已取消', status: 'Error' },
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      valueEnum: {
        '待审核': { text: '待审核', status: 'Processing' },
        '审核通过': { text: '审核通过', status: 'Success' },
        '审核驳回': { text: '审核驳回', status: 'Error' },
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      valueType: 'option',
      render: (_: any, record: SalesOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit([record.id!])}
            >
              编辑
            </Button>
          )}
          {record.status === '草稿' && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleSubmitDemand(record.id!)}
            >
              提交
            </Button>
          )}
          {record.review_status === '待审核' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record.id!)}
            >
              审核
            </Button>
          )}
          {record.review_status === '审核通过' && (
            <Button
              type="link"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handlePushToComputation(record.id!)}
            >
              下推
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<SalesOrder>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            
            // 处理搜索参数
            if (searchFormValues?.status) {
              apiParams.status = searchFormValues.status;
            }
            if (searchFormValues?.review_status) {
              apiParams.review_status = searchFormValues.review_status;
            }
            if (searchFormValues?.customer_name) {
              apiParams.customer_name = searchFormValues.customer_name;
            }
            
            // 处理排序
            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }
            
            try {
              const response = await listSalesOrders(apiParams);
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          showCreateButton={true}
          onCreate={handleCreate}
          showEditButton={true}
          onEdit={handleEdit}
          showDeleteButton={true}
          onDelete={handleDelete}
          onDetail={handleDetail}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={[
            '订单日期',
            '交货日期',
            '客户ID',
            '客户名称',
            '客户联系人',
            '客户电话',
            '销售员ID',
            '销售员姓名',
            '收货地址',
            '发货方式',
            '付款条件',
            '备注',
          ]}
          importExampleRow={[
            '2026-01-01',
            '2026-01-31',
            '',
            '客户A',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '批量导入示例',
          ]}
        />
      </ListPageTemplate>
      
      {/* 新建/编辑 Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setPreviewCode(null);
        }}
        title={isEdit ? '编辑销售订单' : '新建销售订单'}
        width={900}
        footer={null}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  <Button type="primary" onClick={() => formRef.current?.submit()}>
                    {isEdit ? '更新' : '创建'}
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="order_code"
                label="订单编码"
                placeholder={isAutoGenerateEnabled('kuaizhizao-sales-order') ? '编码将根据编码规则自动生成，可修改' : '请输入订单编码'}
                rules={[{ required: true, message: '请输入订单编码' }]}
                fieldProps={{ disabled: isEdit }}
              />
            </Col>
            <Col span={12}>
              <ProFormDatePicker
                name="order_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
              />
            </Col>
            <Col span={12}>
              <ProFormDatePicker
                name="delivery_date"
                label="交货日期"
                rules={[{ required: true, message: '请选择交货日期' }]}
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="customer_name"
                label="客户名称"
                rules={[{ required: true, message: '请输入客户名称' }]}
                placeholder="请输入客户名称"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="customer_contact"
                label="客户联系人"
                placeholder="请输入客户联系人"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="customer_phone"
                label="客户电话"
                placeholder="请输入客户电话"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="salesman_name"
                label="销售员姓名"
                placeholder="请输入销售员姓名"
              />
            </Col>
            <Col span={24}>
              <ProFormText
                name="shipping_address"
                label="收货地址"
                placeholder="请输入收货地址"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="shipping_method"
                label="发货方式"
                placeholder="请输入发货方式"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="payment_terms"
                label="付款条件"
                placeholder="请输入付款条件"
              />
            </Col>
            <Col span={24}>
              <ProFormTextArea
                name="notes"
                label="备注"
                placeholder="请输入备注"
              />
            </Col>
          </Row>

          {/* 订单明细 */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0 }}>订单明细</h4>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
                添加明细
              </Button>
            </div>
            <Table<SalesOrderItem>
              size="small"
              dataSource={orderItems}
              rowKey={(record, index) => `item-${index}`}
              pagination={false}
              bordered
              columns={[
                {
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 200,
                  render: (materialId: number, record: SalesOrderItem, index: number) => {
                    if (editingItemIndex === index) {
                      // 查找当前选中的物料
                      const selectedMaterial = materials.find(m => m.id === materialId);
                      const materialUuid = selectedMaterial?.uuid || '';
                      
                      return (
                        <Select
                          value={materialUuid}
                          onChange={(value) => {
                            const material = materials.find(m => m.uuid === value);
                            if (material) {
                              handleMaterialSelect(index, value);
                            }
                          }}
                          placeholder="请选择物料"
                          showSearch
                          allowClear
                          style={{ width: '100%' }}
                          loading={materialsLoading}
                          filterOption={(input, option) => {
                            const label = option?.label as string || '';
                            return label.toLowerCase().includes(input.toLowerCase());
                          }}
                          options={materials.map(m => ({
                            label: `${m.mainCode || m.code || ''} - ${m.name || ''}`,
                            value: m.uuid,
                          }))}
                        />
                      );
                    } else {
                      // 显示模式：物料编码 - 物料名称
                      const material = materials.find(m => m.id === materialId);
                      if (material) {
                        return `${material.mainCode || material.code || ''} - ${material.name || ''}`;
                      }
                      return record.material_code && record.material_name 
                        ? `${record.material_code} - ${record.material_name}`
                        : '-';
                    }
                  },
                },
                {
                  title: '规格',
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (text: string, record: SalesOrderItem, index: number) => (
                    editingItemIndex === index ? (
                      <Input
                        value={text}
                        onChange={(e) => handleUpdateItem(index, 'material_spec', e.target.value)}
                        placeholder="规格"
                      />
                    ) : (
                      text || '-'
                    )
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 80,
                  render: (text: string, record: SalesOrderItem, index: number) => (
                    editingItemIndex === index ? (
                      <Input
                        value={text}
                        onChange={(e) => handleUpdateItem(index, 'material_unit', e.target.value)}
                        placeholder="单位"
                      />
                    ) : (
                      text || '-'
                    )
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'required_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (text: number, record: SalesOrderItem, index: number) => (
                    editingItemIndex === index ? (
                      <InputNumber
                        value={text}
                        onChange={(value) => handleUpdateItem(index, 'required_quantity', value || 0)}
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      text || 0
                    )
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (text: number, record: SalesOrderItem, index: number) => (
                    editingItemIndex === index ? (
                      <InputNumber
                        value={text}
                        onChange={(value) => handleUpdateItem(index, 'unit_price', value || 0)}
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        prefix="¥"
                      />
                    ) : (
                      text ? `¥${Number(text).toLocaleString()}` : '-'
                    )
                  ),
                },
                {
                  title: '金额',
                  dataIndex: 'item_amount',
                  width: 120,
                  align: 'right' as const,
                  render: (text: number) => text ? `¥${Number(text).toLocaleString()}` : '-',
                },
                {
                  title: '交货日期',
                  dataIndex: 'delivery_date',
                  width: 120,
                  render: (text: string, record: SalesOrderItem, index: number) => (
                    editingItemIndex === index ? (
                      <Input
                        type="date"
                        value={text}
                        onChange={(e) => handleUpdateItem(index, 'delivery_date', e.target.value)}
                      />
                    ) : (
                      text || '-'
                    )
                  ),
                },
                {
                  title: '操作',
                  width: 100,
                  fixed: 'right' as const,
                  render: (_: any, record: SalesOrderItem, index: number) => (
                    <Space>
                      {editingItemIndex === index ? (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setEditingItemIndex(null)}
                        >
                          完成
                        </Button>
                      ) : (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setEditingItemIndex(index)}
                        >
                          编辑
                        </Button>
                      )}
                      <Popconfirm
                        title="确定删除这条明细吗？"
                        onConfirm={() => handleDeleteItem(index)}
                      >
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
            />
            {orderItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                暂无订单明细，请点击"添加明细"按钮添加
              </div>
            )}
          </div>
        </ProForm>
      </Modal>
      
      {/* 详情 Drawer */}
      <Drawer
        title="销售订单详情"
        size={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {currentSalesOrder && (
          <>
            <ProDescriptions<SalesOrder>
              dataSource={currentSalesOrder}
              column={2}
              columns={[
                {
                  title: '订单编号',
                  dataIndex: 'order_code',
                },
                {
                  title: '订单日期',
                  dataIndex: 'order_date',
                  valueType: 'date',
                },
                {
                  title: '交货日期',
                  dataIndex: 'delivery_date',
                  valueType: 'date',
                },
                {
                  title: '客户名称',
                  dataIndex: 'customer_name',
                },
                {
                  title: '客户联系人',
                  dataIndex: 'customer_contact',
                },
                {
                  title: '客户电话',
                  dataIndex: 'customer_phone',
                },
                {
                  title: '销售员姓名',
                  dataIndex: 'salesman_name',
                },
                {
                  title: '收货地址',
                  dataIndex: 'shipping_address',
                  span: 2,
                },
                {
                  title: '发货方式',
                  dataIndex: 'shipping_method',
                },
                {
                  title: '付款条件',
                  dataIndex: 'payment_terms',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (_, record) => (
                    <Tag color={record.status === '已生效' ? 'success' : 'default'}>
                      {record.status}
                    </Tag>
                  ),
                },
                {
                  title: '审核状态',
                  dataIndex: 'review_status',
                  render: (_, record) => (
                    <Tag color={record.review_status === '审核通过' ? 'success' : 'default'}>
                      {record.review_status}
                    </Tag>
                  ),
                },
                {
                  title: '备注',
                  dataIndex: 'notes',
                  span: 2,
                },
              ]}
            />
            
            {/* 订单明细 */}
            {currentSalesOrder.items && currentSalesOrder.items.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3>订单明细</h3>
                <Table<SalesOrderItem>
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 200 },
                    { title: '物料规格', dataIndex: 'material_spec', width: 120 },
                    { title: '单位', dataIndex: 'material_unit', width: 80 },
                    { title: '数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                    { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (text) => text ? `¥${Number(text).toLocaleString()}` : '-' },
                    { title: '金额', dataIndex: 'item_amount', width: 120, align: 'right' as const, render: (text) => text ? `¥${Number(text).toLocaleString()}` : '-' },
                    { title: '交货日期', dataIndex: 'delivery_date', width: 120 },
                    { title: '已交货数量', dataIndex: 'delivered_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                    { title: '剩余数量', dataIndex: 'remaining_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                  ]}
                  dataSource={currentSalesOrder.items}
                  rowKey="id"
                  pagination={false}
                  bordered
                />
              </div>
            )}
            
            {/* 单据关联 */}
            {documentRelations && (
              <div style={{ marginTop: 24 }}>
                <DocumentRelationDisplay relations={documentRelations} />
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default SalesOrdersPage;
