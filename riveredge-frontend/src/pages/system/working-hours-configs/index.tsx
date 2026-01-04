/**
 * 工作时间段配置管理页面
 *
 * 提供工作时间段配置的CRUD功能，用于配置组织的工作时间段。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormSelect, ProFormSwitch, ProFormDigit, ProFormTextArea, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { apiRequest } from '../../../services/api';

/**
 * 工作时间段配置接口定义
 */
interface WorkingHoursConfig {
  id?: number;
  name?: string;
  scope_type?: string;
  scope_id?: number;
  scope_name?: string;
  day_of_week?: number;
  start_date?: string;
  end_date?: string;
  working_hours?: Array<{ start: string; end: string }>;
  is_enabled?: boolean;
  priority?: number;
  remarks?: string;
  created_at?: string;
}

/**
 * 工作时间段配置管理页面组件
 */
const WorkingHoursConfigsPage: React.FC = () => {
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
  const [currentRecord, setCurrentRecord] = useState<WorkingHoursConfig | null>(null);

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
  const handleEdit = async (record: WorkingHoursConfig) => {
    if (record.id) {
      setIsEdit(true);
      setCurrentId(record.id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const detailData = await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'GET' });
        formRef.current?.setFieldsValue({
          name: detailData.name,
          scope_type: detailData.scope_type,
          scope_id: detailData.scope_id,
          day_of_week: detailData.day_of_week,
          start_date: detailData.start_date,
          end_date: detailData.end_date,
          working_hours: detailData.working_hours,
          is_enabled: detailData.is_enabled,
          priority: detailData.priority,
          remarks: detailData.remarks,
        });
      } catch (error) {
        messageApi.error('获取配置详情失败');
      }
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: WorkingHoursConfig) => {
    if (record.id) {
      try {
        await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'DELETE' });
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
  const handleDetail = async (record: WorkingHoursConfig) => {
    if (record.id) {
      try {
        const detailData = await apiRequest(`/core/working-hours-configs/${record.id}`, { method: 'GET' });
        setCurrentRecord(detailData);
        setDetailDrawerVisible(true);
      } catch (error) {
        messageApi.error('获取配置详情失败');
      }
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<WorkingHoursConfig>[] = [
    {
      title: '配置名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '适用范围类型',
      dataIndex: 'scope_type',
      width: 120,
      valueEnum: {
        all: { text: '全部', status: 'default' },
        warehouse: { text: '仓库', status: 'processing' },
        work_center: { text: '工作中心', status: 'success' },
        department: { text: '部门', status: 'warning' },
      },
    },
    {
      title: '适用范围',
      dataIndex: 'scope_name',
      width: 150,
      ellipsis: true,
      render: (_, record) => record.scope_name || '全部',
    },
    {
      title: '星期几',
      dataIndex: 'day_of_week',
      width: 100,
      render: (_, record) => {
        if (record.day_of_week === null || record.day_of_week === undefined) {
          return '全部工作日';
        }
        const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        return days[record.day_of_week] || '-';
      },
    },
    {
      title: '工作时间段',
      dataIndex: 'working_hours',
      width: 200,
      ellipsis: true,
      render: (_, record) => {
        if (!record.working_hours || record.working_hours.length === 0) {
          return '-';
        }
        return record.working_hours.map((h: any) => `${h.start}-${h.end}`).join(', ');
      },
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
            title="确定要删除这条配置吗？"
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
        await apiRequest(`/core/working-hours-configs/${currentId}`, {
          method: 'PUT',
          data: values,
        });
        messageApi.success('更新成功');
      } else {
        await apiRequest('/core/working-hours-configs', {
          method: 'POST',
          data: values,
        });
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
        headerTitle="工作时间段配置"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/core/working-hours-configs', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取配置列表失败');
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
            新建配置
          </Button>,
        ]}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑工作时间段配置' : '新建工作时间段配置'}
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
          scope_type: 'all',
          is_enabled: true,
          priority: 0,
          working_hours: [{ start: '09:00', end: '18:00' }],
        }}
      >
        <ProFormText
          name="name"
          label="配置名称"
          placeholder="请输入配置名称"
          rules={[{ required: true, message: '请输入配置名称' }]}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="scope_type"
          label="适用范围类型"
          placeholder="请选择适用范围类型"
          rules={[{ required: true, message: '请选择适用范围类型' }]}
          options={[
            { label: '全部', value: 'all' },
            { label: '仓库', value: 'warehouse' },
            { label: '工作中心', value: 'work_center' },
            { label: '部门', value: 'department' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="day_of_week"
          label="星期几"
          placeholder="请选择星期几（留空表示所有工作日）"
          options={[
            { label: '全部工作日', value: null },
            { label: '周一', value: 0 },
            { label: '周二', value: 1 },
            { label: '周三', value: 2 },
            { label: '周四', value: 3 },
            { label: '周五', value: 4 },
            { label: '周六', value: 5 },
            { label: '周日', value: 6 },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="start_date"
          label="生效开始日期"
          placeholder="请选择生效开始日期（可选）"
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="end_date"
          label="生效结束日期"
          placeholder="请选择生效结束日期（可选）"
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        {/* TODO: 添加工作时间段配置组件（支持多个时间段） */}
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
        title={`配置详情 - ${currentRecord?.name || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>配置名称：</strong>{currentRecord.name}</p>
              <p><strong>适用范围类型：</strong>{currentRecord.scope_type}</p>
              <p><strong>适用范围：</strong>{currentRecord.scope_name || '全部'}</p>
              <p><strong>星期几：</strong>
                {currentRecord.day_of_week === null || currentRecord.day_of_week === undefined
                  ? '全部工作日'
                  : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][currentRecord.day_of_week]}
              </p>
              <p><strong>工作时间段：</strong>
                {currentRecord.working_hours && currentRecord.working_hours.length > 0
                  ? currentRecord.working_hours.map((h: any) => `${h.start}-${h.end}`).join(', ')
                  : '-'}
              </p>
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

export default WorkingHoursConfigsPage;

