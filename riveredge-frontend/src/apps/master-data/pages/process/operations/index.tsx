/**
 * 工序信息管理页面
 * 
 * 提供工序信息的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Card, Modal } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate } from '../../../../../components/layout-templates';
import { operationApi, defectTypeApi } from '../../../services/process';
import { getUserList } from '../../../../../services/user';
import { QRCodeGenerator } from '../../../../../components/qrcode';
import { qrcodeApi } from '../../../../../services/qrcode';
import type { Operation, OperationCreate, OperationUpdate, DefectTypeMinimal } from '../../../types/process';
import { MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';

const PAGE_CODE = 'master-data-process-operation';

/**
 * 工序信息管理列表页面组件
 */
const OperationsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOperationUuid, setCurrentOperationUuid] = useState<string | null>(null);
  const [operationDetail, setOperationDetail] = useState<Operation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工序）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  /** 预览编码（自动编码时使用，提交时若未修改则正式生成） */
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  /** 不良品项、用户选项（表单用） */
  const [defectTypeOptions, setDefectTypeOptions] = useState<{ label: string; value: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);

  /** 加载不良品项、用户选项（Modal 打开时） */
  const loadFormOptions = async () => {
    try {
      const [defectsRes, usersRes] = await Promise.all([
        defectTypeApi.list({ limit: 500, is_active: true }),
        getUserList({ is_active: true, page_size: 100 }),
      ]);
      const defects = Array.isArray(defectsRes) ? defectsRes : (defectsRes?.data ?? []);
      setDefectTypeOptions(
        defects.map((d) => ({ label: `${d.code} ${d.name}`, value: d.uuid }))
      );
      const items = usersRes?.items || [];
      setUserOptions(
        items.map((u: any) => ({
          label: (u.full_name || u.username || u.uuid) as string,
          value: u.uuid as string,
        }))
      );
    } catch (e) {
      console.warn('加载不良品项/用户选项失败:', e);
    }
  };

  /**
   * 处理URL参数（从二维码扫描跳转过来时自动打开详情）
   */
  useEffect(() => {
    const operationUuid = searchParams.get('operationUuid');
    const action = searchParams.get('action');
    
    if (operationUuid && action === 'detail') {
      // 自动打开工序详情
      handleOpenDetail({ uuid: operationUuid } as Operation);
      // 清除URL参数
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  /**
   * 处理新建工序
   * 编码规则以后端「编码规则」配置为准：从后端拉取页面配置得到 rule_code，再调用生成接口。
   * 先加载不良品项/用户选项再打开弹窗，保证下拉列表有数据。
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentOperationUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    await loadFormOptions();

    let ruleCode: string | undefined;
    let autoGenerate = false;
    try {
      const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
      ruleCode = pageConfig?.ruleCode;
      autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
    } catch {
      ruleCode = getPageRuleCode(PAGE_CODE);
      autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
    }

    if (autoGenerate && ruleCode) {
      try {
        const codeResponse = await testGenerateCode({ rule_code: ruleCode });
        const previewCodeValue = (codeResponse?.code ?? '').trim();
        setPreviewCode(previewCodeValue || null);
        formRef.current?.setFieldsValue({
          ...(previewCodeValue ? { code: previewCodeValue } : {}),
          isActive: true,
          reportingType: 'quantity',
          allowJump: false,
        });
        if (!previewCodeValue) {
          messageApi.info('未获取到工序编码预览，请检查「编码规则」中是否已为当前组织配置并启用「工序管理」规则；也可直接手动输入编码。');
        }
      } catch (error: any) {
        console.warn('自动生成编码失败:', error);
        setPreviewCode(null);
        formRef.current?.setFieldsValue({
          isActive: true,
          reportingType: 'quantity',
          allowJump: false,
        });
        messageApi.info('自动编码获取失败，请手动输入工序编码，或在「编码规则」中配置「工序管理」后重试。');
      }
    } else {
      setPreviewCode(null);
      formRef.current?.setFieldsValue({
        isActive: true,
        reportingType: 'quantity',
        allowJump: false,
      });
    }
  };

  /**
   * 处理编辑工序
   * 先加载不良品项/用户选项再请求详情并回填，保证下拉有选项时选中项能正确展示。
   */
  const handleEdit = async (record: Operation) => {
    try {
      setIsEdit(true);
      setCurrentOperationUuid(record.uuid);
      setPreviewCode(null);
      setModalVisible(true);
      await loadFormOptions();

      const detail = await operationApi.get(record.uuid);
      const dts = (detail as any).defect_types ?? (detail as any).defectTypes ?? [];
      const defectTypeUuids = Array.isArray(dts) ? dts.map((d: DefectTypeMinimal) => d.uuid) : [];
      const defaultOperatorUuids = (detail as any).default_operator_uuids ?? (detail as any).defaultOperatorUuids ?? [];
      const defaultOperatorUuidsArr = Array.isArray(defaultOperatorUuids) ? defaultOperatorUuids : [];
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        description: detail.description,
        reportingType: detail.reportingType || 'quantity',
        allowJump: detail.allowJump || false,
        isActive: detail.isActive,
        defectTypeUuids: defectTypeUuids.length ? defectTypeUuids : undefined,
        defaultOperatorUuids: defaultOperatorUuidsArr.length ? defaultOperatorUuidsArr : undefined,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工序详情失败');
    }
  };

  /**
   * 处理删除工序
   */
  const handleDelete = async (record: Operation) => {
    try {
      await operationApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除工序
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？删除工序前需要检查是否有关联的工艺路线或SOP。此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await operationApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Operation) => {
    try {
      setCurrentOperationUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await operationApi.get(record.uuid);
      setOperationDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工序详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理批量生成二维码
   */
  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要生成二维码的工序');
      return;
    }

    try {
      // 通过API获取选中的工序数据
      const operations = await Promise.all(
        selectedRowKeys.map(async (key) => {
          try {
            return await operationApi.get(key as string);
          } catch (error) {
            console.error(`获取工序失败: ${key}`, error);
            return null;
          }
        })
      );
      
      const validOperations = operations.filter((op) => op !== null) as Operation[];

      if (validOperations.length === 0) {
        messageApi.error('无法获取选中的工序数据');
        return;
      }

      // 生成二维码
      const qrcodePromises = validOperations.map((operation) =>
        qrcodeApi.generateOperation({
          operation_uuid: operation.uuid,
          operation_code: operation.code || '',
          operation_name: operation.name || '',
        })
      );

      const qrcodes = await Promise.all(qrcodePromises);
      messageApi.success(`成功生成 ${qrcodes.length} 个工序二维码`);
      
      // TODO: 可以打开一个Modal显示所有二维码，或者提供下载功能
    } catch (error: any) {
      messageApi.error(`批量生成二维码失败: ${error.message || '未知错误'}`);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentOperationUuid(null);
    setOperationDetail(null);
  };

  /**
   * 处理提交表单（创建/更新工序）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      // ProForm 的 onFinish 会过滤掉 null/undefined，多选等字段可能缺失，必须用 getFieldsValue 取完整表单值
      const formValues = formRef.current?.getFieldsValue?.() ?? {};
      const defectTypeUuids = Array.isArray(formValues.defectTypeUuids) ? formValues.defectTypeUuids : (Array.isArray(values?.defectTypeUuids) ? values.defectTypeUuids : []);
      const defaultOperatorUuids = Array.isArray(formValues.defaultOperatorUuids) ? formValues.defaultOperatorUuids : (Array.isArray(values?.defaultOperatorUuids) ? values.defaultOperatorUuids : []);

      if (isEdit && currentOperationUuid) {
        const updatePayload: OperationUpdate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
        };
        await operationApi.update(currentOperationUuid, updatePayload);
        messageApi.success('更新成功');
      } else {
        let ruleCode: string | undefined;
        let autoGenerate = false;
        try {
          const pageConfig = await getCodeRulePageConfig(PAGE_CODE);
          ruleCode = pageConfig?.ruleCode;
          autoGenerate = !!(pageConfig?.autoGenerate && ruleCode);
        } catch {
          ruleCode = getPageRuleCode(PAGE_CODE);
          autoGenerate = isAutoGenerateEnabled(PAGE_CODE);
        }
        if (autoGenerate && ruleCode) {
          const currentCode = values.code?.trim?.() ?? '';
          const useAutoCode = !currentCode || currentCode === previewCode;
          if (useAutoCode) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              values.code = codeResponse.code;
            } catch (error: any) {
              if (previewCode) values.code = previewCode;
              console.warn('正式生成编码失败，使用预览编码:', error);
            }
          }
        }
        if (!values.code?.trim?.()) {
          messageApi.error('工序编码不能为空');
          return;
        }
        const createPayload: OperationCreate = {
          ...formValues,
          ...values,
          defectTypeUuids,
          defaultOperatorUuids,
        };
        await operationApi.create(createPayload);
        messageApi.success('创建成功');
      }

      setModalVisible(false);
      setPreviewCode(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setPreviewCode(null);
    formRef.current?.resetFields();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Operation>[] = [
    {
      title: '工序编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '工序名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '报工类型',
      dataIndex: 'reportingType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        quantity: { text: '按数量报工', status: 'Processing' },
        status: { text: '按状态报工', status: 'Success' },
      },
      render: (_, record) => (
        <Tag color={record.reportingType === 'quantity' ? 'blue' : 'green'}>
          {record.reportingType === 'quantity' ? '按数量报工' : '按状态报工'}
        </Tag>
      ),
    },
    {
      title: '允许跳转',
      dataIndex: 'allowJump',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '允许', status: 'Success' },
        false: { text: '不允许', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.allowJump ? 'success' : 'default'}>
          {record.allowJump ? '允许' : '不允许'}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '绑定不良品项',
      dataIndex: ['defect_types', 'defectTypes'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, record: Operation) => {
        const dts = (record as any).defect_types ?? (record as any).defectTypes ?? [];
        const arr = Array.isArray(dts) ? dts : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((d: DefectTypeMinimal) => (
              <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '默认生产人员',
      dataIndex: ['default_operator_names', 'defaultOperatorNames'],
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, record: Operation) => {
        const names = (record as any).default_operator_names ?? (record as any).defaultOperatorNames ?? [];
        const arr = Array.isArray(names) ? names : [];
        if (!arr.length) return '-';
        return (
          <Space size={[0, 4]} wrap>
            {arr.slice(0, 3).map((name: string, idx: number) => (
              <Tag key={idx}>{name}</Tag>
            ))}
            {arr.length > 3 && <Tag>+{arr.length - 3}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenDetail(record)}
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
            title="确定要删除这个工序吗？"
            description="删除工序前需要检查是否有关联的工艺路线或SOP"
            onConfirm={() => handleDelete(record)}
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

  return (
    <ListPageTemplate>
      <UniTable<Operation>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          try {
            const result = await operationApi.list(apiParams);
            // 兼容：接口可能直接返回数组或 { data: [] }，且保证每条含 defect_types
            const listData = Array.isArray(result) ? result : (result?.data ?? []);
            return {
              data: listData,
              success: true,
              total: listData.length,
            };
          } catch (error: any) {
            console.error('获取工序列表失败:', error);
            messageApi.error(error?.message || '获取工序列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建工序
          </Button>,
          <Button
            key="batch-qrcode"
            icon={<QrcodeOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchGenerateQRCode}
          >
            批量生成二维码
          </Button>,
          <Button
            key="batch-delete"
            danger
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchDelete}
          >
            批量删除
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      <DetailDrawerTemplate<Operation>
        title="工序详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={operationDetail || undefined}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        customContent={
          <>
            <ProDescriptions<Operation>
              dataSource={operationDetail || undefined}
              column={2}
              columns={[
                { title: '工序编码', dataIndex: 'code' },
                { title: '工序名称', dataIndex: 'name' },
                { title: '描述', dataIndex: 'description', span: 2 },
                {
                  title: '启用状态',
                  dataIndex: 'isActive',
                  render: (_, record) => (
                    <Tag color={record.isActive ? 'success' : 'default'}>
                      {record.isActive ? '启用' : '禁用'}
                    </Tag>
                  ),
                },
                {
                  title: '绑定不良品项',
                  dataIndex: 'defect_types',
                  span: 2,
                  render: (_, record) => {
                    const dts = (record as any).defect_types ?? (record as any).defectTypes ?? [];
                    const arr = Array.isArray(dts) ? dts : [];
                    if (!arr.length) return '-';
                    return (
                      <Space size={[0, 4]} wrap>
                        {arr.map((d: DefectTypeMinimal) => (
                          <Tag key={d.uuid}>{d.name ?? d.code}</Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                {
                  title: '默认生产人员',
                  dataIndex: 'default_operator_names',
                  span: 2,
                  render: (_, record) => {
                    const names = (record as any).default_operator_names ?? (record as any).defaultOperatorNames ?? [];
                    const arr = Array.isArray(names) ? names : [];
                    if (!arr.length) return '-';
                    return (
                      <Space size={[0, 4]} wrap>
                        {arr.map((name: string, idx: number) => (
                          <Tag key={idx}>{name}</Tag>
                        ))}
                      </Space>
                    );
                  },
                },
                { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
                { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
              ]}
            />
            
            {/* 工序二维码 */}
            {operationDetail && (
              <div style={{ marginTop: 24 }}>
                <Card title="工序二维码">
                  <QRCodeGenerator
                    qrcodeType="OP"
                    data={{
                      operation_uuid: operationDetail.uuid,
                      operation_code: operationDetail.code || '',
                      operation_name: operationDetail.name || '',
                    }}
                    autoGenerate={true}
                  />
                </Card>
              </div>
            )}
          </>
        }
      />

      <FormModalTemplate
        title={isEdit ? '编辑工序' : '新建工序'}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={{ isActive: true, reportingType: 'quantity', allowJump: false }}
      >
        <ProFormText
          name="code"
          label="工序编码"
          placeholder={isAutoGenerateEnabled(PAGE_CODE) ? '编码已根据编码规则自动生成，也可手动编辑' : '请输入工序编码'}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工序编码' },
            { max: 50, message: '工序编码不能超过50个字符' },
          ]}
          fieldProps={{
            style: { textTransform: 'uppercase' },
          }}
        />
        <ProFormText
          name="name"
          label="工序名称"
          placeholder="请输入工序名称"
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: '请输入工序名称' },
            { max: 200, message: '工序名称不能超过200个字符' },
          ]}
        />
        <ProFormSelect
          name="defectTypeUuids"
          label="绑定不良品项"
          placeholder="请选择允许绑定的不良品项（可多选）"
          colProps={{ span: 24 }}
          mode="multiple"
          options={defectTypeOptions}
          fieldProps={{ showSearch: true, optionFilterProp: 'label' }}
        />
        <ProFormSelect
          name="defaultOperatorUuids"
          label="默认生产人员"
          placeholder="请选择默认生产人员（可多选）"
          colProps={{ span: 24 }}
          mode="multiple"
          options={userOptions}
          fieldProps={{ showSearch: true, optionFilterProp: 'label', allowClear: true }}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述"
          colProps={{ span: 24 }}
          fieldProps={{
            rows: 4,
            maxLength: 500,
          }}
        />
        <ProFormSelect
          name="reportingType"
          label="报工类型"
          placeholder="请选择报工类型"
          colProps={{ span: 12 }}
          options={[
            { label: '按数量报工', value: 'quantity' },
            { label: '按状态报工', value: 'status' },
          ]}
          rules={[{ required: true, message: '请选择报工类型' }]}
          extra="按数量报工：需要输入完成数量、合格数量（如：注塑、组装、包装）。按状态报工：只有完成/未完成状态，无数量概念（如：检验、测试、审批）"
        />
        <ProFormSwitch
          name="allowJump"
          label="是否允许跳转"
          colProps={{ span: 12 }}
          extra="允许跳转：可以并行进行，不依赖上道工序完成。不允许跳转：必须完成上道工序才能开始下道工序（默认）"
        />
        <ProFormSwitch
          name="isActive"
          label="是否启用"
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default OperationsPage;
