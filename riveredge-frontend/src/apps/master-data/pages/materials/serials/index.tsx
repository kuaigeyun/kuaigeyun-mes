/**
 * 物料序列号管理页面
 * 
 * 提供物料序列号的 CRUD 功能，支持序列号生成、追溯等功能。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect, ProFormInstance, ProDescriptionsItemType, ProFormDigit } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, InputNumber } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { materialSerialApi, materialApi } from '../../../services/material';
import type { 
  MaterialSerial, 
  MaterialSerialCreate, 
  MaterialSerialUpdate,
  Material 
} from '../../../types/material';

/**
 * 序列号状态选项
 */
const SERIAL_STATUS_OPTIONS = [
  { label: '在库', value: 'in_stock' },
  { label: '已出库', value: 'out_stock' },
  { label: '已销售', value: 'sold' },
  { label: '已报废', value: 'scrapped' },
  { label: '已退货', value: 'returned' },
];

/**
 * 物料序列号管理列表页面组件
 */
const MaterialSerialPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentSerialUuid, setCurrentSerialUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSerial, setCurrentSerial] = useState<MaterialSerial | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // 序列号生成相关状态
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [selectedMaterialUuid, setSelectedMaterialUuid] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [generatedSerialNos, setGeneratedSerialNos] = useState<string[]>([]);

  /**
   * 加载物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理新建序列号
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSerialUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: 'in_stock',
    });
  };

  /**
   * 处理编辑序列号
   */
  const handleEdit = async (record: MaterialSerial) => {
    try {
      setIsEdit(true);
      setCurrentSerialUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await materialSerialApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        materialUuid: detail.materialUuid,
        serialNo: detail.serialNo,
        productionDate: detail.productionDate,
        factoryDate: detail.factoryDate,
        supplierSerialNo: detail.supplierSerialNo,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取序列号详情失败');
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: MaterialSerial) => {
    try {
      setDetailLoading(true);
      const detail = await materialSerialApi.get(record.uuid);
      setCurrentSerial(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取序列号详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除序列号
   */
  const handleDelete = async (record: MaterialSerial) => {
    try {
      await materialSerialApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSerialUuid) {
        await materialSerialApi.update(currentSerialUuid, values as MaterialSerialUpdate);
        messageApi.success('更新成功');
      } else {
        await materialSerialApi.create(values as MaterialSerialCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理批量生成序列号
   */
  const handleGenerateSerials = async () => {
    if (!selectedMaterialUuid) {
      messageApi.warning('请先选择物料');
      return;
    }
    
    if (generateCount < 1 || generateCount > 1000) {
      messageApi.warning('生成数量必须在1-1000之间');
      return;
    }
    
    try {
      const result = await materialSerialApi.generate(selectedMaterialUuid, generateCount);
      setGeneratedSerialNos(result.serial_nos);
      messageApi.success(`成功生成 ${result.count} 个序列号`);
      setGenerateModalVisible(false);
    } catch (error: any) {
      messageApi.error(error.message || '生成序列号失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MaterialSerial>[] = [
    {
      title: '序列号',
      dataIndex: 'serialNo',
      width: 200,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料',
      dataIndex: ['material', 'name'],
      width: 150,
      ellipsis: true,
      render: (_: any, record: MaterialSerial) => record.materialName || '-',
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      width: 120,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '出厂日期',
      dataIndex: 'factoryDate',
      width: 120,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        in_stock: { text: '在库', status: 'Success' },
        out_stock: { text: '已出库', status: 'Warning' },
        sold: { text: '已销售', status: 'Processing' },
        scrapped: { text: '已报废', status: 'Error' },
        returned: { text: '已退货', status: 'Default' },
      },
    },
    {
      title: '供应商序列号',
      dataIndex: 'supplierSerialNo',
      width: 150,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_: any, record: MaterialSerial) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确定要删除这个序列号吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<MaterialSerial>[] = [
    {
      title: '序列号',
      dataIndex: 'serialNo',
    },
    {
      title: '物料',
      dataIndex: 'materialName',
    },
    {
      title: '生产日期',
      dataIndex: 'productionDate',
      valueType: 'date',
    },
    {
      title: '出厂日期',
      dataIndex: 'factoryDate',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          in_stock: { text: '在库', color: 'green' },
          out_stock: { text: '已出库', color: 'orange' },
          sold: { text: '已销售', color: 'blue' },
          scrapped: { text: '已报废', color: 'red' },
          returned: { text: '已退货', color: 'default' },
        };
        const status = statusMap[value] || { text: value, color: 'default' };
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: '供应商序列号',
      dataIndex: 'supplierSerialNo',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      span: 2,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaterialSerial>
          headerTitle="物料序列号管理"
          actionRef={actionRef}
          columns={columns}
          showAdvancedSearch={true}
          request={async (params, sort, _filter, searchFormValues) => {
            const { current = 1, pageSize = 20, ...rest } = params;
            
            const listParams: any = {
              page: current,
              pageSize: pageSize,
              ...searchFormValues,
            };
            
            try {
              const response = await materialSerialApi.list(listParams);
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              console.error('获取序列号列表失败:', error);
              messageApi.error(error?.message || '获取序列号列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          rowKey="uuid"
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建序列号
            </Button>,
            <Button
              key="generate"
              icon={<ReloadOutlined />}
              onClick={() => setGenerateModalVisible(true)}
            >
              批量生成
            </Button>,
          ]}
          search={{
            labelWidth: 'auto',
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑物料序列号' : '新建物料序列号'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={MODAL_CONFIG.width}
        formRef={formRef}
        loading={formLoading}
        onFinish={handleSubmit}
      >
        <SafeProFormSelect
          name="materialUuid"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials.map(m => ({
            label: `${m.mainCode || m.code} - ${m.name}`,
            value: m.uuid,
          }))}
          fieldProps={{
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => {
              const label = option?.label as string || '';
              return label.toLowerCase().includes(input.toLowerCase());
            },
            onChange: (value) => {
              setSelectedMaterialUuid(value as string);
            },
          }}
        />
        <ProFormText
          name="serialNo"
          label="序列号"
          placeholder="请输入序列号"
          rules={[
            { required: true, message: '请输入序列号' },
            { max: 100, message: '序列号不能超过100个字符' },
          ]}
        />
        <ProFormDatePicker
          name="productionDate"
          label="生产日期"
          placeholder="请选择生产日期"
        />
        <ProFormDatePicker
          name="factoryDate"
          label="出厂日期"
          placeholder="请选择出厂日期"
        />
        <ProFormText
          name="supplierSerialNo"
          label="供应商序列号"
          placeholder="请输入供应商序列号"
          fieldProps={{
            maxLength: 100,
          }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          options={SERIAL_STATUS_OPTIONS}
          rules={[{ required: true, message: '请选择状态' }]}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入备注（可选）"
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
      </FormModalTemplate>

      {/* 批量生成序列号 Modal */}
      <Modal
        title="批量生成序列号"
        open={generateModalVisible}
        onOk={handleGenerateSerials}
        onCancel={() => {
          setGenerateModalVisible(false);
          setGeneratedSerialNos([]);
          setGenerateCount(1);
        }}
        width={600}
      >
        <SafeProFormSelect
          name="materialUuid"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materials.map(m => ({
            label: `${m.mainCode || m.code} - ${m.name}`,
            value: m.uuid,
          }))}
          fieldProps={{
            loading: materialsLoading,
            showSearch: true,
            filterOption: (input, option) => {
              const label = option?.label as string || '';
              return label.toLowerCase().includes(input.toLowerCase());
            },
            onChange: (value) => {
              setSelectedMaterialUuid(value as string);
            },
          }}
        />
        <ProFormDigit
          name="count"
          label="生成数量"
          placeholder="请输入生成数量（1-1000）"
          rules={[
            { required: true, message: '请输入生成数量' },
            { type: 'number', min: 1, max: 1000, message: '数量必须在1-1000之间' },
          ]}
          fieldProps={{
            min: 1,
            max: 1000,
            value: generateCount,
            onChange: (value) => setGenerateCount(value || 1),
          }}
        />
        {generatedSerialNos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p>生成的序列号：</p>
            <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #d9d9d9', padding: 8 }}>
              {generatedSerialNos.map((serialNo, index) => (
                <div key={index}>{serialNo}</div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="物料序列号详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        columns={detailColumns}
        dataSource={currentSerial}
        width={DRAWER_CONFIG.width}
      />
    </>
  );
};

export default MaterialSerialPage;
