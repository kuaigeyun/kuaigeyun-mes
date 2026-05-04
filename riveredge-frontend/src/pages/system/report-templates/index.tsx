/**
 * 报表模板管理页面
 *
 * 提供报表模板的列表、创建、编辑、删除等功能
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../components/uni-table';
import { flushDrawerOpen, ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../components/uni-detail';
import { apiRequest } from '../../../services/api';

/**
 * 报表模板接口定义
 */
interface ReportTemplate {
  id?: number;
  uuid?: string;
  name?: string;
  code?: string;
  type?: string;
  category?: string;
  status?: string;
  is_default?: boolean;
  description?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 报表模板管理页面组件
 */
const ReportTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const reportTemplateDetailReqRef = useRef(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<ReportTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const formRef = useRef<any>(null);

  const reportDetailDescColumns = useMemo<ProDescriptionsItemProps<ReportTemplate>[]>(
    () => [
      { title: t('pages.system.reportTemplates.columnName'), dataIndex: 'name' },
      { title: t('pages.system.reportTemplates.columnCode'), dataIndex: 'code' },
      {
        title: t('pages.system.reportTemplates.columnType'),
        dataIndex: 'type',
        render: (_: unknown, record: ReportTemplate) => {
          const map: Record<string, string> = {
            inventory: t('pages.system.reportTemplates.typeInventory'),
            production: t('pages.system.reportTemplates.typeProduction'),
            quality: t('pages.system.reportTemplates.typeQuality'),
            custom: t('pages.system.reportTemplates.typeCustom'),
          };
          const v = record.type;
          return v ? map[v] ?? v : '—';
        },
      },
      {
        title: t('pages.system.reportTemplates.columnCategory'),
        dataIndex: 'category',
        render: (_: unknown, record: ReportTemplate) => {
          const map: Record<string, string> = {
            system: t('pages.system.reportTemplates.categorySystem'),
            department: t('pages.system.reportTemplates.categoryDepartment'),
            personal: t('pages.system.reportTemplates.categoryPersonal'),
          };
          const v = record.category;
          return v ? map[v] ?? v : '—';
        },
      },
      {
        title: t('pages.system.reportTemplates.columnStatus'),
        dataIndex: 'status',
        render: (_: unknown, record: ReportTemplate) => {
          const map: Record<string, { text: string; color: string }> = {
            draft: { text: t('pages.system.reportTemplates.statusDraft'), color: 'default' },
            published: { text: t('pages.system.reportTemplates.statusPublished'), color: 'success' },
            archived: { text: t('pages.system.reportTemplates.statusArchived'), color: 'error' },
          };
          const v = record.status;
          if (!v) return '—';
          const item = map[v] ?? { text: v, color: 'default' };
          return <Tag color={item.color}>{item.text}</Tag>;
        },
      },
      {
        title: t('pages.system.reportTemplates.columnIsDefault'),
        dataIndex: 'is_default',
        render: (_: unknown, record: ReportTemplate) =>
          record.is_default ? (
            <Tag color="green">{t('pages.system.reportTemplates.yes')}</Tag>
          ) : (
            <Tag>{t('pages.system.reportTemplates.no')}</Tag>
          ),
      },
      { title: t('pages.system.reportTemplates.labelDescription'), dataIndex: 'description' },
      { title: t('pages.system.reportTemplates.columnCreatedBy'), dataIndex: 'created_by_name' },
      { title: t('pages.system.reportTemplates.columnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t]
  );

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
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const data = await apiRequest(`/core/reports/templates/${id}`, {
          method: 'GET',
        });
        formRef.current?.setFieldsValue(data);
      } catch (error) {
        messageApi.error(t('pages.system.reportTemplates.loadFailed'));
      }
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length !== 1) return;
    const id = Number(keys[0]);
    const req = ++reportTemplateDetailReqRef.current;
    flushDrawerOpen(() => {
      setCurrentId(id);
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const data = await apiRequest(`/core/reports/templates/${id}`, {
        method: 'GET',
      });
      if (reportTemplateDetailReqRef.current !== req) return;
      setDetailData(data as ReportTemplate);
    } catch {
      if (reportTemplateDetailReqRef.current === req) {
        messageApi.error(t('pages.system.reportTemplates.loadFailed'));
      }
    } finally {
      if (reportTemplateDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
      await Promise.all(
        keys.map((key) =>
          apiRequest(`/core/reports/templates/${key}`, {
            method: 'DELETE',
          })
        )
      );
      messageApi.success(t('pages.system.reportTemplates.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(t('pages.system.reportTemplates.deleteFailed'));
    }
  };

  /**
   * 处理保存
   */
  const handleSave = async (values: any) => {
    try {
      if (isEdit && currentId) {
        await apiRequest(`/core/reports/templates/${currentId}`, {
          method: 'PUT',
          data: values,
        });
        messageApi.success(t('pages.system.reportTemplates.updateSuccess'));
      } else {
        await apiRequest('/core/reports/templates', {
          method: 'POST',
          data: values,
        });
        messageApi.success(t('pages.system.reportTemplates.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(isEdit ? t('pages.system.reportTemplates.updateFailed') : t('pages.system.reportTemplates.createFailed'));
    }
  };

  /**
   * 处理设计报表
   */
  const handleDesign = (record: ReportTemplate) => {
    navigate(`/system/report-templates/${record.id}/design`);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportTemplate>[] = [
    {
      title: t('pages.system.reportTemplates.columnName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.reportTemplates.columnCode'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.reportTemplates.columnType'),
      dataIndex: 'type',
      width: 120,
      valueEnum: {
        inventory: { text: t('pages.system.reportTemplates.typeInventory'), status: 'default' },
        production: { text: t('pages.system.reportTemplates.typeProduction'), status: 'processing' },
        quality: { text: t('pages.system.reportTemplates.typeQuality'), status: 'success' },
        custom: { text: t('pages.system.reportTemplates.typeCustom'), status: 'warning' },
      },
    },
    {
      title: t('pages.system.reportTemplates.columnCategory'),
      dataIndex: 'category',
      width: 100,
      valueEnum: {
        system: { text: t('pages.system.reportTemplates.categorySystem'), status: 'default' },
        department: { text: t('pages.system.reportTemplates.categoryDepartment'), status: 'processing' },
        personal: { text: t('pages.system.reportTemplates.categoryPersonal'), status: 'warning' },
      },
    },
    {
      title: t('pages.system.reportTemplates.columnStatus'),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: t('pages.system.reportTemplates.statusDraft'), status: 'default' },
        published: { text: t('pages.system.reportTemplates.statusPublished'), status: 'success' },
        archived: { text: t('pages.system.reportTemplates.statusArchived'), status: 'error' },
      },
    },
    {
      title: t('pages.system.reportTemplates.columnIsDefault'),
      dataIndex: 'is_default',
      width: 100,
      render: (_, record) => (
        record.is_default ? <Tag color="green">{t('pages.system.reportTemplates.yes')}</Tag> : <Tag>{t('pages.system.reportTemplates.no')}</Tag>
      ),
    },
    {
      title: t('pages.system.reportTemplates.columnCreatedBy'),
      dataIndex: 'created_by_name',
      width: 100,
    },
    {
      title: t('pages.system.reportTemplates.columnCreatedAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('pages.system.reportTemplates.columnActions'),
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            {t('pages.system.reportTemplates.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleDesign(record)}
          >
            {t('pages.system.reportTemplates.design')}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete([record.id!])}
          >
            {t('pages.system.reportTemplates.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  const formFields = [
    { name: 'name', label: t('pages.system.reportTemplates.labelName'), type: 'input' as const, required: true, rules: [{ required: true, message: t('pages.system.reportTemplates.nameRequired') }] },
    { name: 'code', label: t('pages.system.reportTemplates.labelCode'), type: 'input' as const, required: true, rules: [{ required: true, message: t('pages.system.reportTemplates.codeRequired') }] },
    { name: 'type', label: t('pages.system.reportTemplates.labelType'), type: 'select' as const, required: true, options: [
      { label: t('pages.system.reportTemplates.typeInventory'), value: 'inventory' },
      { label: t('pages.system.reportTemplates.typeProduction'), value: 'production' },
      { label: t('pages.system.reportTemplates.typeQuality'), value: 'quality' },
      { label: t('pages.system.reportTemplates.typeCustom'), value: 'custom' },
    ], rules: [{ required: true, message: t('pages.system.reportTemplates.typeRequired') }] },
    { name: 'category', label: t('pages.system.reportTemplates.labelCategory'), type: 'select' as const, required: true, options: [
      { label: t('pages.system.reportTemplates.categorySystem'), value: 'system' },
      { label: t('pages.system.reportTemplates.categoryDepartment'), value: 'department' },
      { label: t('pages.system.reportTemplates.categoryPersonal'), value: 'personal' },
    ], rules: [{ required: true, message: t('pages.system.reportTemplates.categoryRequired') }] },
    { name: 'status', label: t('pages.system.reportTemplates.labelStatus'), type: 'select' as const, required: true, options: [
      { label: t('pages.system.reportTemplates.statusDraft'), value: 'draft' },
      { label: t('pages.system.reportTemplates.statusPublished'), value: 'published' },
      { label: t('pages.system.reportTemplates.statusArchived'), value: 'archived' },
    ], rules: [{ required: true, message: t('pages.system.reportTemplates.statusRequired') }] },
    { name: 'is_default', label: t('pages.system.reportTemplates.labelIsDefault'), type: 'switch' as const },
    { name: 'description', label: t('pages.system.reportTemplates.labelDescription'), type: 'textarea' as const },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('pages.system.reportTemplates.headerTitle')}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/core/reports/templates', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                type: params.type,
                category: params.category,
                status: params.status,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error(t('pages.system.reportTemplates.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton
        createButtonText={t('pages.system.reportTemplates.createButton')}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDetail={handleDetail}
        showDeleteButton
        onDelete={handleDelete}
        deleteButtonText={t('common.batchDelete')}
        deleteConfirmTitle={t('pages.system.reportTemplates.batchDeleteTitle')}
        deleteConfirmDescription={(c) => t('pages.system.reportTemplates.batchDeleteDescription', { count: c })}
        showAdvancedSearch={true}
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, _keys, pageData) => {
          try {
            const result = await apiRequest('/core/reports/templates', {
              method: 'GET',
              params: { skip: 0, limit: 10000 },
            });
            const items = Array.isArray(result) ? result : [];
            const toExport = type === 'currentPage' && pageData?.length ? pageData : items;
            if (toExport.length === 0) {
              messageApi.warning(t('pages.system.reportTemplates.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-templates-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.reportTemplates.exportSuccess', { count: toExport.length }));
          } catch (error: any) {
            messageApi.error(t('pages.system.reportTemplates.exportFailed'));
          }
        }}
      />

      {/* 表单Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.reportTemplates.modalEdit') : t('pages.system.reportTemplates.modalCreate')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={async () => {
          const values = await formRef.current?.validateFields();
          await handleSave(values);
        }}
        formRef={formRef}
        fields={formFields}
        width={MODAL_CONFIG.SMALL_WIDTH}
      />

      {/* 详情Drawer */}
      <UniDetail
        title={`${t('pages.system.reportTemplates.detailTitle')} - ${currentId || ''}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetailData(null);
          setCurrentId(null);
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        basic={
          detailData ? (
            <Descriptions
              column={1}
              items={detailDrawerDescriptionItems(reportDetailDescColumns, detailData)}
            />
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default ReportTemplatesPage;

