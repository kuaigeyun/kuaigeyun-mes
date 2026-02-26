/**
 * 成本核算规则管理页面
 *
 * 提供成本核算规则的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持材料成本、人工成本、制造费用等核算规则配置。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormTextArea, ProFormSwitch, ProFormJsonSchema } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { costRuleApi } from '../../../services/cost';
import dayjs from 'dayjs';

interface CostRule {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  rule_type?: string;
  cost_type?: string;
  calculation_method?: string;
  calculation_formula?: any;
  rule_parameters?: any;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

const CostRulePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑规则）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentCostRule, setCurrentCostRule] = useState<CostRule | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [costRuleDetail, setCostRuleDetail] = useState<CostRule | null>(null);

  /**
   * 处理新建规则
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentCostRule(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
    });
  };

  /**
   * 处理编辑规则
   */
  const handleEdit = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error('规则UUID不存在');
        return;
      }
      const detail = await costRuleApi.get(record.uuid);
      setIsEdit(true);
      setCurrentCostRule(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          rule_type: detail.rule_type,
          cost_type: detail.cost_type,
          calculation_method: detail.calculation_method,
          calculation_formula: detail.calculation_formula ? JSON.stringify(detail.calculation_formula, null, 2) : '',
          rule_parameters: detail.rule_parameters ? JSON.stringify(detail.rule_parameters, null, 2) : '',
          is_active: detail.is_active,
          description: detail.description,
        });
      }, 100);
    } catch (error: any) {
      messageApi.error(error.message || '获取规则详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error('规则UUID不存在');
        return;
      }
      const detail = await costRuleApi.get(record.uuid);
      setCostRuleDetail(detail);
      setDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取规则详情失败');
    }
  };

  /**
   * 处理删除规则
   */
  const handleDelete = async (record: CostRule) => {
    try {
      if (!record.uuid) {
        messageApi.error('规则UUID不存在');
        return;
      }
      await costRuleApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理保存规则
   */
  const handleSave = async (values: any) => {
    try {
      // 处理 JSON 字段
      if (values.calculation_formula) {
        try {
          values.calculation_formula = JSON.parse(values.calculation_formula);
        } catch (e) {
          messageApi.error('计算公式格式错误，必须是有效的JSON格式');
          return;
        }
      }
      if (values.rule_parameters) {
        try {
          values.rule_parameters = JSON.parse(values.rule_parameters);
        } catch (e) {
          messageApi.error('规则参数格式错误，必须是有效的JSON格式');
          return;
        }
      }

      if (isEdit && currentCostRule?.uuid) {
        await costRuleApi.update(currentCostRule.uuid, values);
        messageApi.success('更新成功');
      } else {
        await costRuleApi.create(values);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CostRule>[] = [
    {
      title: '规则编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '规则类型',
      dataIndex: 'rule_type',
      key: 'rule_type',
      width: 120,
      render: (text: string) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          '材料成本': { color: 'blue', text: '材料成本' },
          '人工成本': { color: 'green', text: '人工成本' },
          '制造费用': { color: 'orange', text: '制造费用' },
        };
        const type = typeMap[text] || { color: 'default', text: text };
        return <Tag color={type.color}>{type.text}</Tag>;
      },
    },
    {
      title: '成本类型',
      dataIndex: 'cost_type',
      key: 'cost_type',
      width: 120,
    },
    {
      title: '计算方法',
      dataIndex: 'calculation_method',
      key: 'calculation_method',
      width: 120,
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (text: boolean) => (
        <Tag color={text ? 'green' : 'red'}>{text ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: CostRule) => (
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
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 详情描述项
   */
  const detailItems: ProDescriptionsItemType<CostRule>[] = [
    {
      title: '规则编码',
      dataIndex: 'code',
    },
    {
      title: '规则名称',
      dataIndex: 'name',
    },
    {
      title: '规则类型',
      dataIndex: 'rule_type',
    },
    {
      title: '成本类型',
      dataIndex: 'cost_type',
    },
    {
      title: '计算方法',
      dataIndex: 'calculation_method',
    },
    {
      title: '计算公式',
      dataIndex: 'calculation_formula',
      render: (text: any) => text ? JSON.stringify(text, null, 2) : '-',
    },
    {
      title: '规则参数',
      dataIndex: 'rule_parameters',
      render: (text: any) => text ? JSON.stringify(text, null, 2) : '-',
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (text: boolean) => (
        <Tag color={text ? 'green' : 'red'}>{text ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '更新人',
      dataIndex: 'updated_by_name',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  return (
    <ListPageTemplate
      title="成本核算规则管理"
      onCreate={handleCreate}
      actionRef={actionRef}
    >
      <UniTable<CostRule>
        actionRef={actionRef}
        request={async (params) => {
          // 将 ProTable 的分页参数转换为后端期望的格式
          const queryParams: any = {
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize!,
          };
          
          // 传递其他搜索参数
          if (params.rule_type) queryParams.rule_type = params.rule_type;
          if (params.cost_type) queryParams.cost_type = params.cost_type;
          if (params.is_active !== undefined) queryParams.is_active = params.is_active;
          if (params.search) queryParams.search = params.search;
          
          const response = await costRuleApi.list(queryParams);
          return {
            data: response.items || [],
            success: true,
            total: response.total || 0,
          };
        }}
        columns={columns}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑成本核算规则' : '新建成本核算规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onFinish={handleSave}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="code"
          label="规则编码"
          placeholder="留空则自动生成"
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label="规则名称"
          placeholder="请输入规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
        />
        <ProFormSelect
          name="rule_type"
          label="规则类型"
          placeholder="请选择规则类型"
          options={[
            { label: '材料成本', value: '材料成本' },
            { label: '人工成本', value: '人工成本' },
            { label: '制造费用', value: '制造费用' },
          ]}
          rules={[{ required: true, message: '请选择规则类型' }]}
        />
        <ProFormText
          name="cost_type"
          label="成本类型"
          placeholder="请输入成本类型（如：直接材料、间接材料等）"
          rules={[{ required: true, message: '请输入成本类型' }]}
        />
        <ProFormSelect
          name="calculation_method"
          label="计算方法"
          placeholder="请选择计算方法"
          options={[
            { label: '按数量', value: '按数量' },
            { label: '按工时', value: '按工时' },
            { label: '按比例', value: '按比例' },
            { label: '按固定值', value: '按固定值' },
            { label: '自定义公式', value: '自定义公式' },
          ]}
          rules={[{ required: true, message: '请选择计算方法' }]}
        />
        <ProFormTextArea
          name="calculation_formula"
          label="计算公式（JSON格式）"
          placeholder='请输入计算公式，JSON格式，例如：{"formula": "quantity * price"}'
          fieldProps={{
            rows: 4,
          }}
        />
        <ProFormTextArea
          name="rule_parameters"
          label="规则参数（JSON格式）"
          placeholder='请输入规则参数，JSON格式，例如：{"rate": 0.1, "fixed_value": 100}'
          fieldProps={{
            rows: 4,
          }}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述"
          fieldProps={{
            rows: 3,
          }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="成本核算规则详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        dataSource={costRuleDetail}
        columns={detailItems}
      />
    </ListPageTemplate>
  );
};

export default CostRulePage;

