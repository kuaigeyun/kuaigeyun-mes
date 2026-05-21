/**
 * 设备管理页面
 *
 * 提供设备的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持设备基础信息管理、序列号管理、关联工作中心等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DescriptionsProps } from 'antd';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormSwitch,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Modal,
  Tabs,
  Table,
  Form,
  Input,
  DatePicker,
  Select,
  Row,
  Col,
  Descriptions,
  Typography,
  Empty,
  Spin,
  theme as AntdTheme,
} from 'antd';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import CodeField from '../../../../../components/code-field';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { getEquipmentAssetLifecycle } from '../../../utils/equipmentLifecycle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';
import { equipmentApi } from '../../../services/equipment';
import { workshopApi } from '../../../../master-data/services/factory';
import { batchImport } from '../../../../../utils/batchOperations';
import dayjs from 'dayjs';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { EquipmentTraceBriefPrimaryActions } from '../EquipmentTraceBriefFooter';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
    }
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
      content = (col.render as (dom: React.ReactNode, entity: T, i: number) => React.ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderEquipmentRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

interface Equipment {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  technical_parameters?: any;
  workstation_id?: number;
  workstation_code?: string;
  workstation_name?: string;
  work_center_id?: number;
  work_center_code?: string;
  work_center_name?: string;
  status?: string;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
  lifecycle?: { main_stages?: Array<unknown> };
}

const EquipmentPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const equipmentDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态（创建/编辑设备）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState<Equipment | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [equipmentDetail, setEquipmentDetail] = useState<Equipment | null>(null);

  const [eqTrackingRefreshKey, setEqTrackingRefreshKey] = useState(0);

  const equipmentTracking = useDocumentTracking(
    drawerVisible && equipmentDetail?.id ? 'equipment' : undefined,
    equipmentDetail?.id,
    eqTrackingRefreshKey,
  );

  // 追溯相关状态
  const [traceVisible, setTraceVisible] = useState(false);
  const [traceData, setTraceData] = useState<any>(null);

  // 校验记录 Modal
  const [calibModalVisible, setCalibModalVisible] = useState(false);
  const [calibForm] = Form.useForm();

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentEquipment(null);
    // destroyOnHidden 下 ProForm 每次打开都会重新挂载，initialValues 为空即可
    setFormInitialValues(undefined);
    setModalVisible(true);
  };

  /**
   * 处理编辑设备
   */
  const handleEdit = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setIsEdit(true);
      setCurrentEquipment(detail);
      // 用 initialValues 替代 setTimeout + setFieldsValue
      setFormInitialValues({
        code: detail.code,
        name: detail.name,
        type: detail.type,
        category: detail.category,
        brand: detail.brand,
        model: detail.model,
        serial_number: detail.serial_number,
        manufacturer: detail.manufacturer,
        supplier: detail.supplier,
        purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
        installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
        warranty_period: detail.warranty_period,
        workstation_id: detail.workstation_id,
        work_center_id: detail.work_center_id,
        status: detail.status,
        is_active: detail.is_active,
        description: detail.description,
      });
      setModalVisible(true);
    } catch (error) {
      messageApi.error('获取设备详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const detail = await equipmentApi.get(record.uuid);
      setEquipmentDetail(detail);
      setDrawerVisible(true);
      setEqTrackingRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error('获取设备详情失败');
    }
  };

  /**
   * 处理批量删除设备（keys 为 uuid 数组）
   */
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 台设备吗？`,
      onOk: async () => {
        try {
          for (const uuid of keys) {
            await equipmentApi.delete(String(uuid));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          setSelectedRowKeys([]);
          if (equipmentDetail?.uuid && keys.map(String).includes(String(equipmentDetail.uuid))) {
            setDrawerVisible(false);
            setEquipmentDetail(null);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理查看设备追溯
   */
  const handleTrace = async (record: Equipment) => {
    try {
      if (!record.uuid) {
        messageApi.error('设备UUID不存在');
        return;
      }
      const data = await equipmentApi.getTrace(record.uuid);
      setTraceData(data);
      setTraceVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取设备追溯失败');
    }
  };

  const handleCreateCalibration = () => {
    calibForm.resetFields();
    calibForm.setFieldsValue({ calibration_date: dayjs(), result: '合格' });
    setCalibModalVisible(true);
  };

  const handleSubmitCalibration = async () => {
    try {
      const values = await calibForm.validateFields();
      const equipmentUuid = traceData?.equipment?.uuid;
      if (!equipmentUuid) return;
      const data = {
        calibration_date: values.calibration_date?.format?.('YYYY-MM-DD') || values.calibration_date,
        result: values.result,
        certificate_no: values.certificate_no,
        expiry_date: values.expiry_date?.format?.('YYYY-MM-DD') || values.expiry_date,
        remark: values.remark,
      };
      await equipmentApi.createCalibration(equipmentUuid, data);
      messageApi.success('校验记录已保存');
      setCalibModalVisible(false);
      const refreshed = await equipmentApi.getTrace(equipmentUuid);
      setTraceData(refreshed);
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(e?.message || '保存失败');
    }
  };

  useSubmitShortcut(handleSubmitCalibration, calibModalVisible);

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null,
      };

      const editedUuid = isEdit ? currentEquipment?.uuid : undefined;
      if (isEdit && editedUuid) {
        await equipmentApi.update(editedUuid, submitData);
        messageApi.success('设备更新成功');
      } else {
        await equipmentApi.create(submitData);
        messageApi.success('设备创建成功');
      }
      setModalVisible(false);
      setCurrentEquipment(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
      if (editedUuid && equipmentDetail?.uuid === editedUuid) {
        try {
          const fresh = await equipmentApi.get(editedUuid);
          setEquipmentDetail(fresh);
          setEqTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<Equipment>[] = useMemo(
    () => [
    {
      title: '设备编号',
      dataIndex: 'code',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'name',
    },
    {
      title: '设备类型',
      dataIndex: 'type',
    },
    {
      title: '设备分类',
      dataIndex: 'category',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
    },
    {
      title: '型号',
      dataIndex: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.serial_number ?? '') }}>{r.serial_number ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: '安装日期',
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: '保修期（月）',
      dataIndex: 'warranty_period',
    },
    {
      title: '工位',
      dataIndex: 'workstation_name',
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, record) => {
        const status = record.status;
        const statusMap: Record<string, { text: string; color: string }> = {
          正常: { text: '正常', color: 'success' },
          维修中: { text: '维修中', color: 'warning' },
          停用: { text: '停用', color: 'default' },
          报废: { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
    ],
    []
  );

  const renderEquipmentRowNodes = (record: Equipment): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [
      <Button
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>,
      <Button
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        编辑
      </Button>,
      <Button
        key="del"
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除设备"${record.name}"吗？`,
            onOk: () => record.uuid && handleDelete([record.uuid]),
          });
        }}
      >
        删除
      </Button>,
      <Button
        key="trace"
        type="link"
        size="small"
        icon={<HistoryOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleTrace(record);
        }}
      >
        追溯
      </Button>,
    ];
    return nodes;
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Equipment>[] = [
    {
      title: '设备编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '设备分类',
      dataIndex: 'category',
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.serial_number ?? '') }} ellipsis>
          {r.serial_number ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getEquipmentAssetLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderEquipmentRowActions(renderEquipmentRowNodes(record), `eq-${record.uuid ?? 'row'}`),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Equipment>
          headerTitle="设备管理"
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.equipment"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await equipmentApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
                keyword: (params as any).keyword,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取设备列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          onRowSelectionChange={setSelectedRowKeys}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
          showDeleteButton={true}
          onDelete={handleDelete}
          showCreateButton={true}
          createButtonText="新建设备"
          onCreate={handleCreate}
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('导入数据为空或格式不正确');
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const getIdx = (...keys: string[]) => {
              for (const k of keys) {
                const i = headers.findIndex((h: string) => h.includes(k) || h.replace(/\*/g, '').toLowerCase().includes(k.toLowerCase()));
                if (i >= 0) return i;
              }
              return -1;
            };
            const codeIdx = getIdx('编号', 'code');
            const nameIdx = getIdx('名称', 'name');
            if (nameIdx < 0) {
              messageApi.error('导入表头需包含设备名称');
              return;
            }
            const items: any[] = [];
            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;
              const name = String(row[nameIdx] ?? '').trim();
              if (!name) continue;
              const code = codeIdx >= 0 ? String(row[codeIdx] ?? '').trim() : undefined;
              const typeIdx = getIdx('类型', 'type');
              const catIdx = getIdx('分类', 'category');
              const brandIdx = getIdx('品牌', 'brand');
              const modelIdx = getIdx('型号', 'model');
              items.push({
                code: code || undefined,
                name,
                type: typeIdx >= 0 ? String(row[typeIdx] ?? '').trim() : undefined,
                category: catIdx >= 0 ? String(row[catIdx] ?? '').trim() : undefined,
                brand: brandIdx >= 0 ? String(row[brandIdx] ?? '').trim() : undefined,
                model: modelIdx >= 0 ? String(row[modelIdx] ?? '').trim() : undefined,
              });
            }
            if (items.length === 0) {
              messageApi.warning('没有可导入的有效数据');
              return;
            }
            const result = await batchImport({
              items,
              importFn: async (item) => equipmentApi.create(item),
              title: '导入设备',
              concurrency: 5,
            });
            if (result.successCount > 0) {
              messageApi.success(`成功导入 ${result.successCount} 条设备`);
              actionRef.current?.reload();
            }
            if (result.failureCount > 0) {
              messageApi.warning(`部分失败 ${result.failureCount} 条`);
            }
          }}
          importHeaders={['设备编号', '*设备名称', '设备类型', '设备分类', '品牌', '型号']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await equipmentApi.list({ skip: 0, limit: 10000 });
              let items = (res as any)?.items || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: Equipment) => d.uuid && keys.includes(d.uuid));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `equipment-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          scroll={{ x: 2000 }}
        />
      </ListPageTemplate>

      {/* 创建/编辑设备 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑设备' : '新建设备'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentEquipment(null);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-equipment-management-equipment"
              name="code"
              label="设备编号"
              required={false}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="name"
              label="设备名称"
              placeholder="请输入设备名称"
              rules={[{ required: true, message: '请输入设备名称' }]}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="EQUIPMENT_TYPE"
              name="type"
              label="设备类型"
              placeholder="请选择设备类型"
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="category"
              label="设备分类"
              placeholder="请输入设备分类（如：CNC、注塑机、冲压机等）"
            />
          </Col>
          <Col span={12}>
            <ProFormText name="brand" label="品牌" placeholder="请输入品牌" />
          </Col>
          <Col span={12}>
            <ProFormText name="model" label="型号" placeholder="请输入型号" />
          </Col>
          <Col span={12}>
            <ProFormText name="serial_number" label="序列号" placeholder="请输入序列号" />
          </Col>
          <Col span={12}>
            <ProFormText name="manufacturer" label="制造商" placeholder="请输入制造商" />
          </Col>
          <Col span={12}>
            <ProFormText name="supplier" label="供应商" placeholder="请输入供应商" />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="purchase_date"
              label="采购日期"
              placeholder="请选择采购日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="installation_date"
              label="安装日期"
              placeholder="请选择安装日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="warranty_period"
              label="保修期（月）"
              placeholder="请输入保修期（月）"
              min={0}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="workstation_id"
              label="关联工位"
              placeholder="请选择工位（可选）"
              request={async () => {
                try {
                  await workshopApi.list({ limit: 1000 });
                  return [];
                } catch (error) {
                  return [];
                }
              }}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="work_center_id"
              label="关联工作中心"
              placeholder="请选择工作中心（可选）"
              request={async () => {
                try {
                  return [];
                } catch (error) {
                  return [];
                }
              }}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <DictionarySelect
              dictionaryCode="EQUIPMENT_STATUS"
              name="status"
              label="设备状态"
              placeholder="请选择设备状态"
              required={true}
              rules={[{ required: true, message: '请选择设备状态' }]}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea
              name="description"
              label="描述"
              placeholder="请输入描述（可选）"
              fieldProps={{ rows: 3 }}
            />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label="是否启用" />
          </Col>
        </Row>
      </FormModalTemplate>

      {/* 设备详情 Drawer */}
      <DetailDrawerTemplate
        title="设备详情"
        open={drawerVisible}
        zIndex={equipmentDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setEquipmentDetail(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={equipmentDetail || undefined}
        customContent={
          equipmentDetail ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(equipmentDetail, detailBaseColumns)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getEquipmentAssetLifecycle(equipmentDetail as Record<string, unknown>);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {equipmentDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="equipment"
                      documentId={equipmentDetail.id}
                      active={drawerVisible}
                      selfDocumentId={equipmentDetail.id}
                      renderBriefActions={(doc) => (
                        <EquipmentTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDrawerVisible(false);
                            setEquipmentDetail(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="设备台账无明细行表" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                {equipmentTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {equipmentTracking.error && !equipmentTracking.loading && (
                  <Typography.Text type="danger">{equipmentTracking.error}</Typography.Text>
                )}
                {equipmentTracking.data && !equipmentTracking.loading && (
                  <DocumentTrackingTimelineBody data={equipmentTracking.data} />
                )}
                {!equipmentTracking.loading && !equipmentTracking.data && !equipmentTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />

      {/* 设备追溯 Modal */}
      <Modal
        title={`设备追溯 - ${traceData?.equipment?.name || ''}`}
        open={traceVisible}
        onCancel={() => {
          setTraceVisible(false);
          setTraceData(null);
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        footer={[
          <Button key="close" onClick={() => {
            setTraceVisible(false);
            setTraceData(null);
          }}>
            关闭
          </Button>,
        ]}
      >
        {traceData && (
          <Tabs
            defaultActiveKey="maintenance_plans"
            items={[
              {
                key: 'maintenance_plans',
                label: `维护计划 (${traceData.maintenance_plans?.length || 0})`,
                children: (
                  <Table
                    dataSource={traceData.maintenance_plans || []}
                    columns={[
                      { title: '计划编号', dataIndex: 'plan_no', width: 140 },
                      { title: '计划名称', dataIndex: 'plan_name', width: 200 },
                      { title: '计划类型', dataIndex: 'plan_type', width: 120 },
                      { title: '维护类型', dataIndex: 'maintenance_type', width: 120 },
                      { title: '状态', dataIndex: 'status', width: 100, render: (status) => <Tag>{status}</Tag> },
                      { title: '计划开始日期', dataIndex: 'planned_start_date', width: 120 },
                      { title: '计划结束日期', dataIndex: 'planned_end_date', width: 120 },
                      { title: '创建时间', dataIndex: 'created_at', width: 160 },
                    ]}
                    rowKey="uuid"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'maintenance_executions',
                label: `维护执行 (${traceData.maintenance_executions?.length || 0})`,
                children: (
                  <Table
                    dataSource={traceData.maintenance_executions || []}
                    columns={[
                      { title: '执行编号', dataIndex: 'execution_no', width: 140 },
                      { title: '执行日期', dataIndex: 'execution_date', width: 120 },
                      { title: '执行人', dataIndex: 'executor_name', width: 100 },
                      { title: '执行结果', dataIndex: 'execution_result', width: 120 },
                      { title: '状态', dataIndex: 'status', width: 100, render: (status) => <Tag>{status}</Tag> },
                      { title: '维护费用', dataIndex: 'maintenance_cost', width: 100, render: (cost) => cost ? `¥${cost}` : '-' },
                      { title: '创建时间', dataIndex: 'created_at', width: 160 },
                    ]}
                    rowKey="uuid"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'equipment_faults',
                label: `故障记录 (${traceData.equipment_faults?.length || 0})`,
                children: (
                  <Table
                    dataSource={traceData.equipment_faults || []}
                    columns={[
                      { title: '故障编号', dataIndex: 'fault_no', width: 140 },
                      { title: '故障日期', dataIndex: 'fault_date', width: 120 },
                      { title: '故障类型', dataIndex: 'fault_type', width: 120 },
                      { title: '故障级别', dataIndex: 'fault_level', width: 100, render: (level) => <Tag>{level}</Tag> },
                      { title: '状态', dataIndex: 'status', width: 100, render: (status) => <Tag>{status}</Tag> },
                      { title: '需要维修', dataIndex: 'repair_required', width: 100, render: (required) => <Tag color={required ? 'warning' : 'success'}>{required ? '是' : '否'}</Tag> },
                      { title: '创建时间', dataIndex: 'created_at', width: 160 },
                    ]}
                    rowKey="uuid"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'equipment_repairs',
                label: `维修记录 (${traceData.equipment_repairs?.length || 0})`,
                children: (
                  <Table
                    dataSource={traceData.equipment_repairs || []}
                    columns={[
                      { title: '维修编号', dataIndex: 'repair_no', width: 140 },
                      { title: '维修日期', dataIndex: 'repair_date', width: 120 },
                      { title: '维修类型', dataIndex: 'repair_type', width: 120 },
                      { title: '维修人', dataIndex: 'repairer_name', width: 100 },
                      { title: '维修时长（小时）', dataIndex: 'repair_duration', width: 120 },
                      { title: '维修费用', dataIndex: 'repair_cost', width: 100, render: (cost) => cost ? `¥${cost}` : '-' },
                      { title: '状态', dataIndex: 'status', width: 100, render: (status) => <Tag>{status}</Tag> },
                      { title: '维修结果', dataIndex: 'repair_result', width: 120 },
                      { title: '创建时间', dataIndex: 'created_at', width: 160 },
                    ]}
                    rowKey="uuid"
                    pagination={false}
                    size="small"
                  />
                ),
              },
              {
                key: 'equipment_calibrations',
                label: `校验记录 (${traceData.equipment_calibrations?.length || 0})`,
                children: (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreateCalibration}>
                        新建校验记录
                      </Button>
                    </div>
                    <Table
                      dataSource={traceData.equipment_calibrations || []}
                      columns={[
                        { title: '校验日期', dataIndex: 'calibration_date', width: 120 },
                        { title: '结果', dataIndex: 'result', width: 100, render: (r) => <Tag>{r}</Tag> },
                        { title: '证书编号', dataIndex: 'certificate_no', width: 140 },
                        { title: '有效期', dataIndex: 'expiry_date', width: 120 },
                        { title: '备注', dataIndex: 'remark', ellipsis: true },
                        { title: '创建时间', dataIndex: 'created_at', width: 160 },
                      ]}
                      rowKey="uuid"
                      pagination={false}
                      size="small"
                    />
                  </>
                ),
              },
            ]}
          />
        )}
      </Modal>

      <Modal title="新建校验记录" open={calibModalVisible} onOk={handleSubmitCalibration} okText={'确定' + SUBMIT_SHORTCUT_HINT} onCancel={() => setCalibModalVisible(false)} destroyOnHidden width={MODAL_CONFIG.SMALL_WIDTH}>
        <Form form={calibForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="calibration_date" label="校验日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="result" label="校验结果" rules={[{ required: true }]}>
            <Select options={[
              { label: '合格', value: '合格' },
              { label: '不合格', value: '不合格' },
              { label: '限制使用', value: '限制使用' },
            ]} />
          </Form.Item>
          <Form.Item name="certificate_no" label="证书编号">
            <Input placeholder="请输入证书编号" />
          </Form.Item>
          <Form.Item name="expiry_date" label="有效期至">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default EquipmentPage;

