/**
 * 条码映射规则管理页面
 *
 * 提供条码映射规则的CRUD功能，用于配置客户来料条码到内部物料的映射规则。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Popconfirm, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';

/**
 * 条码映射规则接口定义
 */
interface BarcodeMappingRule {
  id?: number;
  code?: string;
  name?: string;
  customer_id?: number;
  customer_name?: string;
  barcode_pattern?: string;
  barcode_type?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  is_enabled?: boolean;
  priority?: number;
  created_at?: string;
}

/**
 * 条码映射规则管理页面组件
 */
const BarcodeMappingRulesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<BarcodeMappingRule | null>(null);

  /**
   * 处理新建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: BarcodeMappingRule) => {
    if (record.id) {
      setIsEdit(true);
      setCurrentId(record.id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const detailData = await warehouseApi.barcodeMappingRule.get(record.id.toString());
        formRef.current?.setFieldsValue({
          name: detailData.name,
          customer_id: detailData.customer_id,
          barcode_pattern: detailData.barcode_pattern,
          barcode_type: detailData.barcode_type,
          material_id: detailData.material_id,
          is_enabled: detailData.is_enabled,
          priority: detailData.priority,
          remarks: detailData.remarks,
        });
      } catch (error) {
        messageApi.error('获取规则详情失败');
      }
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: BarcodeMappingRule) => {
    if (record.id) {
      try {
        await warehouseApi.barcodeMappingRule.delete(record.id.toString());
        messageApi.success('删除成功');
        actionRef.current?.reload();
      } catch (error) {
        messageApi.error('删除失败');
      }
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: BarcodeMappingRule) => {
    if (record.id) {
      try {
        const detailData = await warehouseApi.barcodeMappingRule.get(record.id.toString());
        setCurrentRecord(detailData);
        setDetailDrawerVisible(true);
      } catch (error) {
        messageApi.error('获取规则详情失败');
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<BarcodeMappingRule>[] = [
    {
      title: '规则编码',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.customer_name || '全部客户',
    },
    {
      title: '条码模式',
      dataIndex: 'barcode_pattern',
      width: 200,
      ellipsis: true,
    },
    {
      title: '条码类型',
      dataIndex: 'barcode_type',
      width: 100,
      render: (_, record) => (
        <Tag color={record.barcode_type === '2d' ? 'blue' : 'default'}>
          {record.barcode_type === '2d' ? '二维码' : '一维码'}
        </Tag>
      ),
    },
    {
      title: '映射物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '映射物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '启用状态',
      dataIndex: 'is_enabled',
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_enabled ? 'success' : 'default'}>
          {record.is_enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'right',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 180,
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
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条映射规则吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
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
  ];

  /**
   * 处理表单提交
   */
  const handleFormFinish = async (values: any) => {
    try {
      setFormLoading(true);
      if (isEdit && currentId) {
        await warehouseApi.barcodeMappingRule.update(currentId.toString(), values);
        messageApi.success('更新成功');
      } else {
        await warehouseApi.barcodeMappingRule.create(values);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="条码映射规则"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showCreateButton={true}
        createButtonText="新建条码映射规则"
        onCreate={handleCreate}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条条码映射规则吗？`,
            onOk: async () => {
              try {
                for (const id of keys) {
                  await warehouseApi.barcodeMappingRule.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '删除失败');
              }
            },
          });
        }}
        request={async (params) => {
          try {
            const result = await warehouseApi.barcodeMappingRule.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取规则列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑映射规则' : '新建映射规则'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleFormFinish}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        layout="vertical"
        grid={true}
        initialValues={{
          barcode_type: '1d',
          is_enabled: true,
          priority: 0,
        }}
      >
        <ProFormText
          name="name"
          label="规则名称"
          placeholder="请输入规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="customer_id"
          label="客户"
          placeholder="请选择客户（留空则适用于所有客户）"
          request={async () => {
            try {
              const customers = await customerApi.list();
              return customers.map(c => ({ label: c.name, value: c.id }));
            } catch {
              return [];
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="barcode_type"
          label="条码类型"
          placeholder="请选择条码类型"
          rules={[{ required: true, message: '请选择条码类型' }]}
          options={[
            { label: '一维码', value: '1d' },
            { label: '二维码', value: '2d' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="barcode_pattern"
          label="条码模式（正则表达式）"
          placeholder="请输入条码模式，例如：^CUST\\d+$"
          rules={[{ required: true, message: '请输入条码模式' }]}
          colProps={{ span: 24 }}
          extra="使用正则表达式匹配条码，例如：^CUST\\d+$ 匹配以CUST开头的数字条码"
        />
        <ProFormSelect
          name="material_id"
          label="映射物料"
          placeholder="请选择要映射的物料"
          rules={[{ required: true, message: '请选择映射物料' }]}
          request={async (params) => {
            try {
              const materials = await materialApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
                keyword: params.keyWords,
              });
              return materials.map(m => ({
                label: `${m.code} - ${m.name}`,
                value: m.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch
          name="is_enabled"
          label="启用状态"
          colProps={{ span: 12 }}
        />
        <ProFormDigit
          name="priority"
          label="优先级"
          placeholder="请输入优先级（数字越大优先级越高）"
          fieldProps={{ min: 0 }}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`规则详情 - ${currentRecord?.code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>规则编码：</strong>{currentRecord.code}</p>
              <p><strong>规则名称：</strong>{currentRecord.name}</p>
              <p><strong>客户：</strong>{currentRecord.customer_name || '全部客户'}</p>
              <p><strong>条码模式：</strong>{currentRecord.barcode_pattern}</p>
              <p><strong>条码类型：</strong>
                <Tag color={currentRecord.barcode_type === '2d' ? 'blue' : 'default'}>
                  {currentRecord.barcode_type === '2d' ? '二维码' : '一维码'}
                </Tag>
              </p>
              <p><strong>映射物料编码：</strong>{currentRecord.material_code}</p>
              <p><strong>映射物料名称：</strong>{currentRecord.material_name}</p>
              <p><strong>启用状态：</strong>
                <Tag color={currentRecord.is_enabled ? 'success' : 'default'}>
                  {currentRecord.is_enabled ? '启用' : '禁用'}
                </Tag>
              </p>
              <p><strong>优先级：</strong>{currentRecord.priority}</p>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default BarcodeMappingRulesPage;

