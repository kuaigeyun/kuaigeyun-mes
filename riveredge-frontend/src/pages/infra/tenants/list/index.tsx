/**
 * 超级管理员组织列表页面
 * 
 * 用于超级管理员查看和管理所有组织。
 * 支持组织注册审核、启用/禁用等功能。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDateTimePicker, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, Progress, List, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getTenantList,
  getPackageConfig,
  getPackageConfigs,
  Tenant,
  TenantStatus,
  TenantPlan,
  CreateTenantData,
  UpdateTenantData,
  PackageConfig,
  activateTenant,
  deactivateTenant,
  deleteTenantBySuperAdmin,
} from '../../../../services/tenant';
// 使用 apiRequest 统一处理 HTTP 请求

// @ts-ignore
import { apiRequest } from '../../../../services/api';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';

const statusTagMap: Record<TenantStatus, { color: string; textKey: string }> = {
  [TenantStatus.ACTIVE]: { color: 'success', textKey: 'pages.infra.tenant.statusActive' },
  [TenantStatus.INACTIVE]: { color: 'default', textKey: 'pages.infra.tenant.statusInactive' },
  [TenantStatus.EXPIRED]: { color: 'warning', textKey: 'pages.infra.tenant.statusExpired' },
  [TenantStatus.SUSPENDED]: { color: 'error', textKey: 'pages.infra.tenant.statusSuspended' },
};

const planTagMap: Record<TenantPlan, { color: string; textKey: string }> = {
  [TenantPlan.TRIAL]: { color: 'default', textKey: 'pages.infra.tenant.planTrial' },
  [TenantPlan.BASIC]: { color: 'blue', textKey: 'pages.infra.tenant.planBasic' },
  [TenantPlan.PROFESSIONAL]: { color: 'purple', textKey: 'pages.infra.tenant.planProfessional' },
  [TenantPlan.ENTERPRISE]: { color: 'gold', textKey: 'pages.infra.tenant.planEnterprise' },
};


/**
 * 超级管理员组织列表页面组件
 */
const SuperAdminTenantList: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState<number | null>(null);
  const [tenantDetail, setTenantDetail] = useState<Tenant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [packageConfigs, setPackageConfigs] = useState<Record<string, PackageConfig>>({});
  const [selectedPlan, setSelectedPlan] = useState<TenantPlan>(TenantPlan.TRIAL);
  
  /**
   * 审核通过组织注册
   * 
   * @param tenantId - 组织 ID
   */
  const approveTenant = async (tenantId: number) => {
    try {
      await apiRequest(`/infra/tenants/${tenantId}/approve`, {
        method: 'POST',
      });
      message.success(t('pages.infra.tenant.approveSuccess'));
      return true;
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.approveFailed'));
      return false;
    }
  };

  /**
   * 审核拒绝组织注册
   * 
   * @param tenantId - 组织 ID
   * @param reason - 拒绝原因
   */
  const rejectTenant = async (tenantId: number, reason?: string) => {
    try {
      await apiRequest(`/infra/tenants/${tenantId}/reject`, {
        method: 'POST',
        data: { reason },
      });
      message.success(t('pages.infra.tenant.rejectSuccess'));
      return true;
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.rejectFailed'));
      return false;
    }
  };

  // 表头字段映射（随语言变化，用于导入解析）
  const headerToFieldMap = useMemo(() => {
    const m: Record<string, string> = {
      'name': 'name', '*name': 'name',
      'domain': 'domain', '*domain': 'domain',
      'plan': 'plan', 'status': 'status',
      'max_users': 'max_users', 'max_storage': 'max_storage', 'expires_at': 'expires_at',
    };
    m[t('pages.infra.tenant.importHeaderName')] = 'name';
    m[t('pages.infra.tenant.name')] = 'name';
    m[t('pages.infra.tenant.nameShort')] = 'name';
    m[t('pages.infra.tenant.importHeaderDomain')] = 'domain';
    m[t('pages.infra.tenant.domain')] = 'domain';
    m[t('pages.infra.tenant.importHeaderPlan')] = 'plan';
    m[t('pages.infra.tenant.plan')] = 'plan';
    m[t('pages.infra.tenant.planType')] = 'plan';
    m[t('pages.infra.tenant.importHeaderStatus')] = 'status';
    m[t('pages.infra.tenant.status')] = 'status';
    m[t('pages.infra.tenant.importHeaderMaxUsers')] = 'max_users';
    m[t('pages.infra.tenant.maxUsers')] = 'max_users';
    m[t('pages.infra.tenant.maxUsersShort')] = 'max_users';
    m[t('pages.infra.tenant.importHeaderMaxStorage')] = 'max_storage';
    m[t('pages.infra.tenant.maxStorage')] = 'max_storage';
    m[t('pages.infra.tenant.maxStorageShort')] = 'max_storage';
    m[t('pages.infra.tenant.storageShort')] = 'max_storage';
    m[t('pages.infra.tenant.importHeaderExpiresAt')] = 'expires_at';
    m[t('pages.infra.tenant.expiresAt')] = 'expires_at';
    m[t('pages.infra.tenant.expiresAtShort')] = 'expires_at';
    return m;
  }, [t]);

  /**
   * 处理导入数据
   * 
   * 支持从 Excel 导入组织数据，批量创建组织
   * 数据格式：第一行为表头，后续行为数据
   * 表头字段：组织名称、域名、套餐类型、状态、最大用户数、存储空间(MB)、过期时间
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      message.warning(t('pages.infra.tenant.importEmpty'));
      return;
    }

    const headers = data[0] || [];
    const rows = data.slice(2);

    if (rows.length === 0) {
      message.warning(t('pages.infra.tenant.importNoRows'));
      return;
    }

    const headerMap = headerToFieldMap;

    // 找到表头索引
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((header, index) => {
      const normalizedHeader = String(header || '').trim();
      if (headerMap[normalizedHeader]) {
        headerIndexMap[headerMap[normalizedHeader]] = index;
      }
    });

    // 验证必需字段
    const requiredFields = ['name', 'domain'];
    const missingFields = requiredFields.filter(field => headerIndexMap[field] === undefined);
    if (missingFields.length > 0) {
      const fieldLabels: Record<string, string> = { name: t('pages.infra.tenant.name'), domain: t('pages.infra.tenant.domain') };
      const missingLabels = missingFields.map(f => fieldLabels[f] || f).join('、');
      message.error(t('pages.infra.tenant.importMissingFields', { fields: missingLabels }));
      return;
    }

    // 过滤空行（所有单元格都为空的行）
    const nonEmptyRows = rows
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) => {
        // 检查行中是否有任何非空单元格
        return row.some(cell => {
          const value = cell !== null && cell !== undefined ? String(cell).trim() : '';
          return value !== '';
        });
      });

    if (nonEmptyRows.length === 0) {
      message.warning(t('pages.infra.tenant.importNoRowsAllEmpty'));
      return;
    }

    // 解析数据行
    const importData: Array<{ data: CreateTenantData; rowIndex: number; rawRow: any[] }> = [];
    const errors: Array<{ rowIndex: number; message: string }> = [];

    nonEmptyRows.forEach(({ row, originalIndex }) => {
      // Excel 行号：originalIndex 是从第3行开始的索引（0开始），所以实际行号是 originalIndex + 3
      // 例如：originalIndex=0 对应第3行，originalIndex=1 对应第4行
      const rowIndex = originalIndex + 3; // Excel 行号（从 3 开始，因为第 1 行是表头，第 2 行是示例数据）
      const rowData: any = {};

      // 提取字段值
      Object.keys(headerIndexMap).forEach(field => {
        const colIndex = headerIndexMap[field];
        if (colIndex !== undefined && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
          rowData[field] = String(row[colIndex]).trim();
        }
      });

      if (!rowData.name || !rowData.domain) {
        errors.push({
          rowIndex,
          message: t('pages.infra.tenant.importRowMissing', { row: rowIndex }),
        });
        return;
      }

      const domainRegex = /^[a-zA-Z0-9_-]+$/;
      if (!domainRegex.test(rowData.domain)) {
        errors.push({
          rowIndex,
          message: t('pages.infra.tenant.importRowDomainInvalid', { row: rowIndex }),
        });
        return;
      }

      // 解析套餐类型（支持当前语言与英文）
      let plan: TenantPlan = TenantPlan.TRIAL;
      if (rowData.plan) {
        const planMap: Record<string, TenantPlan> = {
          'trial': TenantPlan.TRIAL,
          [t('pages.infra.tenant.planTrial')]: TenantPlan.TRIAL,
          'basic': TenantPlan.BASIC,
          [t('pages.infra.tenant.planBasic')]: TenantPlan.BASIC,
          'professional': TenantPlan.PROFESSIONAL,
          [t('pages.infra.tenant.planProfessional')]: TenantPlan.PROFESSIONAL,
          'enterprise': TenantPlan.ENTERPRISE,
          [t('pages.infra.tenant.planEnterprise')]: TenantPlan.ENTERPRISE,
        };
        const normalizedPlan = String(rowData.plan).trim();
        const normalizedPlanLower = normalizedPlan.toLowerCase();
        if (planMap[normalizedPlan]) {
          plan = planMap[normalizedPlan];
        } else if (planMap[normalizedPlanLower]) {
          plan = planMap[normalizedPlanLower];
        }
      }

      // 解析状态（支持当前语言与英文）
      let status: TenantStatus = TenantStatus.INACTIVE;
      if (rowData.status) {
        const statusMap: Record<string, TenantStatus> = {
          'active': TenantStatus.ACTIVE,
          [t('pages.infra.tenant.statusActive')]: TenantStatus.ACTIVE,
          'inactive': TenantStatus.INACTIVE,
          [t('pages.infra.tenant.statusInactive')]: TenantStatus.INACTIVE,
          'expired': TenantStatus.EXPIRED,
          [t('pages.infra.tenant.statusExpired')]: TenantStatus.EXPIRED,
          'suspended': TenantStatus.SUSPENDED,
          [t('pages.infra.tenant.statusSuspended')]: TenantStatus.SUSPENDED,
        };
        const normalizedStatus = String(rowData.status).trim();
        const normalizedStatusLower = normalizedStatus.toLowerCase();
        if (statusMap[normalizedStatus]) {
          status = statusMap[normalizedStatus];
        } else if (statusMap[normalizedStatusLower]) {
          status = statusMap[normalizedStatusLower];
        }
      }

      // 解析数字字段
      const maxUsers = rowData.max_users ? parseInt(rowData.max_users, 10) : undefined;
      const maxStorage = rowData.max_storage ? parseInt(rowData.max_storage, 10) : undefined;

      // 解析过期时间
      let expiresAt: string | undefined = undefined;
      if (rowData.expires_at) {
        try {
          // 尝试解析日期字符串
          const date = new Date(rowData.expires_at);
          if (!isNaN(date.getTime())) {
            expiresAt = date.toISOString();
          }
        } catch (e) {
          // 日期解析失败，忽略
        }
      }

      // 构建创建数据
      const createData: CreateTenantData = {
        name: rowData.name,
        domain: rowData.domain,
        plan,
        status,
        max_users: maxUsers,
        max_storage: maxStorage,
        expires_at: expiresAt,
      };

      importData.push({
        data: createData,
        rowIndex,
        rawRow: row,
      });
    });

    if (errors.length > 0) {
      Modal.error({
        title: t('pages.infra.tenant.importValidationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('pages.infra.tenant.importValidationHint')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">{item.message}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    const progressModal = Modal.info({
      title: t('pages.infra.tenant.importing'),
      width: 600,
      content: (
        <div>
          <Progress percent={0} status="active" />
          <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.importPreparing', { count: importData.length })}</p>
        </div>
      ),
      okButtonProps: { style: { display: 'none' } },
    });

    // 批量创建组织
    const results: Array<{ success: boolean; rowIndex: number; message: string; data?: Tenant }> = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < importData.length; i++) {
      const item = importData[i];
      const percent = Math.round(((i + 1) / importData.length) * 100);

      try {
        // 使用平台超级管理员接口创建组织
        const tenant = await apiRequest<Tenant>('/infra/tenants', {
          method: 'POST',
          data: item.data,
        });

        successCount++;
        results.push({
          success: true,
          rowIndex: item.rowIndex,
          message: t('pages.infra.tenant.importRowSuccess', { name: item.data.name, domain: item.data.domain }),
          data: tenant,
        });

        progressModal.update({
          content: (
            <div>
              <Progress percent={percent} status="active" />
              <p style={{ marginTop: 16 }}>
                {t('pages.infra.tenant.importProgress', { current: i + 1, total: importData.length })}
              </p>
              <p style={{ marginTop: 8, color: '#52c41a' }}>
                {t('pages.infra.tenant.importProgressCount', { success: successCount, fail: failCount })}
              </p>
            </div>
          ),
        });
      } catch (error: any) {
        failCount++;
        const errorMessage = error?.message || error?.detail || t('pages.infra.tenant.operationFailed');
        results.push({
          success: false,
          rowIndex: item.rowIndex,
          message: t('pages.infra.tenant.importRowFail', { row: item.rowIndex, message: errorMessage }),
        });

        progressModal.update({
          content: (
            <div>
              <Progress percent={percent} status="active" />
              <p style={{ marginTop: 16 }}>
                {t('pages.infra.tenant.importProgress', { current: i + 1, total: importData.length })}
              </p>
              <p style={{ marginTop: 8, color: '#52c41a' }}>
                {t('pages.infra.tenant.importProgressCount', { success: successCount, fail: failCount })}
              </p>
            </div>
          ),
        });
      }
    }

    // 关闭进度 Modal，显示结果
    progressModal.destroy();

    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      Modal.warning({
        title: t('pages.infra.tenant.importPartialTitle'),
        width: 700,
        content: (
          <div>
            <p>
              <strong>{t('pages.infra.tenant.importResult', { success: successCount, fail: failCount })}</strong>
            </p>
            <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.importFailedRecords')}</p>
            <List
              size="small"
              dataSource={failedResults}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">{item.message}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
        onOk: () => actionRef.current?.reload(),
      });
    } else {
      Modal.success({
        title: t('pages.infra.tenant.importSuccessTitle'),
        content: t('pages.infra.tenant.importSuccessContent', { count: successCount }),
        onOk: () => actionRef.current?.reload(),
      });
    }
  };

  /**
   * 加载组织详情
   */
  const loadTenantDetail = async (tenantId: number) => {
    setDetailLoading(true);
    try {
      // 使用平台超级管理员接口获取组织详情
      const data = await apiRequest<Tenant>(`/infra/tenants/${tenantId}`, {
        method: 'GET',
      });
      setTenantDetail(data);
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.loadDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (tenantId: number) => {
    setCurrentTenantId(tenantId);
    setDrawerVisible(true);
    loadTenantDetail(tenantId);
  };

  /**
   * 关闭详情 Drawer
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentTenantId(null);
    setTenantDetail(null);
  };

  /**
   * 处理导出数据
   */
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Tenant[]
  ) => {
    let exportInfo = '';
    switch (type) {
      case 'selected':
        exportInfo = t('pages.infra.tenant.exportSelected', { count: selectedRowKeys?.length || 0 });
        break;
      case 'currentPage':
        exportInfo = t('pages.infra.tenant.exportCurrentPage', { count: currentPageData?.length || 0 });
        break;
      case 'all':
        exportInfo = t('pages.infra.tenant.exportAll');
        break;
    }
    message.info(t('pages.infra.tenant.exportDeveloping', { info: exportInfo }));
    // TODO: 实现导出功能
    // 根据 type 调用不同的导出逻辑
    // - selected: 导出 selectedRowKeys 对应的数据
    // - currentPage: 导出 currentPageData
    // - all: 调用 API 获取全部数据并导出
  };

  /**
   * 加载套餐配置
   */
  useEffect(() => {
    // 加载所有套餐配置（用于显示套餐信息）
    getPackageConfigs()
      .then((configs) => {
        // 将后端返回的套餐配置转换为前端需要的格式
        const formattedConfigs: Record<string, PackageConfig> = {};
        Object.keys(configs).forEach((planKey) => {
          const config = configs[planKey];
          formattedConfigs[planKey] = {
            name: config.name,
            max_users: config.max_users,
            max_storage_mb: config.max_storage_mb,
            allow_pro_apps: config.allow_pro_apps || false,
            description: config.description || '',
          };
        });
        setPackageConfigs(formattedConfigs);
      })
      .catch((error: any) => {
        // 静默处理错误，避免 401 错误导致页面刷新
        // 如果套餐配置加载失败，不影响页面正常使用
        console.warn('⚠️ 加载套餐配置失败（将使用默认配置）:', error);
        // 设置默认套餐配置，确保页面可以正常使用
        setPackageConfigs({
          trial: {
            name: t('pages.infra.tenant.planTrial'),
            max_users: 10,
            max_storage_mb: 1024,
            allow_pro_apps: false,
            description: t('pages.infra.tenant.planDescriptionTrial'),
          },
          basic: {
            name: t('pages.infra.tenant.planBasic'),
            max_users: 50,
            max_storage_mb: 5120,
            allow_pro_apps: false,
            description: t('pages.infra.tenant.planDescriptionBasic'),
          },
          professional: {
            name: t('pages.infra.tenant.planProfessional'),
            max_users: 200,
            max_storage_mb: 20480,
            allow_pro_apps: true,
            description: t('pages.infra.tenant.planDescriptionProfessional'),
          },
          enterprise: {
            name: t('pages.infra.tenant.planEnterprise'),
            max_users: 1000,
            max_storage_mb: 102400,
            allow_pro_apps: true,
            description: t('pages.infra.tenant.planDescriptionEnterprise'),
          },
        });
      });
  }, [t]);

  /**
   * 处理套餐选择变化
   * 根据选择的套餐自动设置 max_users 和 max_storage
   */
  const handlePlanChange = async (plan: TenantPlan) => {
    setSelectedPlan(plan);
    try {
      // 优先使用已加载的套餐配置
      const planKey = plan.toLowerCase();
      if (packageConfigs[planKey]) {
        // 使用已加载的配置
        formRef.current?.setFieldsValue({
          max_users: packageConfigs[planKey].max_users,
          max_storage: packageConfigs[planKey].max_storage_mb,
        });
      } else {
        // 如果配置未加载，尝试从 API 获取
        const config = await getPackageConfig(plan);
        formRef.current?.setFieldsValue({
          max_users: config.max_users,
          max_storage: config.max_storage_mb,
        });
      }
    } catch (error: any) {
      // 如果获取失败，使用默认值
      console.warn('⚠️ 获取套餐配置失败，使用默认值:', error);
      const defaultConfigs: Record<string, { max_users: number; max_storage_mb: number }> = {
        trial: { max_users: 10, max_storage_mb: 1024 },
        basic: { max_users: 50, max_storage_mb: 5120 },
        professional: { max_users: 200, max_storage_mb: 20480 },
        enterprise: { max_users: 1000, max_storage_mb: 102400 },
      };
      const planKey = plan.toLowerCase();
      if (defaultConfigs[planKey]) {
        formRef.current?.setFieldsValue({
          max_users: defaultConfigs[planKey].max_users,
          max_storage: defaultConfigs[planKey].max_storage_mb,
        });
      }
    }
  };

  /**
   * 打开新建 Modal
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTenantId(null);
    setSelectedPlan(TenantPlan.TRIAL);
    setModalVisible(true);
    // 重置表单
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        status: TenantStatus.INACTIVE,
        plan: TenantPlan.TRIAL,
      });
    }, 0);
  };

  /**
   * 打开编辑 Modal
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const tenantId = Number(keys[0]);
      setIsEdit(true);
      setCurrentTenantId(tenantId);
      setModalVisible(true);
      setFormLoading(true);
      
      try {
        // 使用平台超级管理员接口获取组织详情
        const data = await apiRequest<Tenant>(`/infra/tenants/${tenantId}`, {
          method: 'GET',
        });
        setSelectedPlan(data.plan);
        // 设置表单初始值
        setTimeout(() => {
          formRef.current?.setFieldsValue({
            name: data.name,
            domain: data.domain,
            status: data.status,
            plan: data.plan,
            max_users: data.max_users,
            max_storage: data.max_storage,
            expires_at: data.expires_at,
          });
        }, 0);
      } catch (error: any) {
        message.error(error.message || t('pages.infra.tenant.loadDetailFailed'));
        setModalVisible(false);
      } finally {
        setFormLoading(false);
      }
    }
  };

  /**
   * 关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setIsEdit(false);
    setCurrentTenantId(null);
    setFormLoading(false);
    formRef.current?.resetFields();
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentTenantId) {
        // 更新组织
        const updateData: UpdateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status,
          plan: values.plan,
          settings: values.settings || {},
          max_users: values.max_users,
          max_storage: values.max_storage,
          expires_at: values.expires_at,
        };
        // 使用平台超级管理员接口更新组织
        await apiRequest<Tenant>(`/infra/tenants/${currentTenantId}`, {
          method: 'PUT',
          data: updateData,
        });
        message.success(t('pages.infra.tenant.updateSuccess'));
      } else {
        const createData: CreateTenantData = {
          name: values.name,
          domain: values.domain,
          status: values.status || TenantStatus.INACTIVE,
          plan: values.plan || TenantPlan.TRIAL,
          settings: values.settings || {},
          expires_at: values.expires_at,
        };
        await apiRequest<Tenant>('/infra/tenants', {
          method: 'POST',
          data: createData,
        });
        message.success(t('pages.infra.tenant.createSuccess'));
      }

      handleCloseModal();
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error.message || t('pages.infra.tenant.operationFailed'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理删除
   * 
   * 支持批量删除组织（软删除）
   * 
   * @param keys - 要删除的组织 ID 数组
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      message.warning(t('pages.infra.tenant.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('pages.infra.tenant.deleteConfirmTitle'),
      content: t('pages.infra.tenant.deleteConfirmContent', { count: keys.length }),
      okText: t('pages.infra.tenant.deleteConfirmOk'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const progressModal = Modal.info({
            title: t('pages.infra.tenant.deleting'),
            width: 600,
            content: (
              <div>
                <Progress percent={0} status="active" />
                <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.deletePreparing', { count: keys.length })}</p>
              </div>
            ),
            okButtonProps: { style: { display: 'none' } },
          });

          const tenantIds = keys.map(key => Number(key));
          const results: Array<{ success: boolean; tenantId: number; message: string }> = [];
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < tenantIds.length; i++) {
            const tenantId = tenantIds[i];
            const percent = Math.round(((i + 1) / tenantIds.length) * 100);

            try {
              await deleteTenantBySuperAdmin(tenantId);
              successCount++;
              results.push({
                success: true,
                tenantId,
                message: t('pages.infra.tenant.deleteRowSuccess', { id: tenantId }),
              });

              progressModal.update({
                content: (
                  <div>
                    <Progress percent={percent} status="active" />
                    <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.deleteProgress', { current: i + 1, total: tenantIds.length })}</p>
                    <p style={{ marginTop: 8, color: '#52c41a' }}>{t('pages.infra.tenant.deleteProgressCount', { success: successCount, fail: failCount })}</p>
                  </div>
                ),
              });
            } catch (error: any) {
              failCount++;
              const errorMessage = error?.message || error?.detail || t('pages.infra.tenant.operationFailed');
              results.push({
                success: false,
                tenantId,
                message: t('pages.infra.tenant.deleteRowFail', { id: tenantId, message: errorMessage }),
              });

              progressModal.update({
                content: (
                  <div>
                    <Progress percent={percent} status="active" />
                    <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.deleteProgress', { current: i + 1, total: tenantIds.length })}</p>
                    <p style={{ marginTop: 8, color: '#52c41a' }}>{t('pages.infra.tenant.deleteProgressCount', { success: successCount, fail: failCount })}</p>
                  </div>
                ),
              });
            }
          }

          progressModal.destroy();

          const failedResults = results.filter(r => !r.success);
          if (failedResults.length > 0) {
            Modal.warning({
              title: t('pages.infra.tenant.deletePartialTitle'),
              width: 700,
              content: (
                <div>
                  <p><strong>{t('pages.infra.tenant.deleteResult', { success: successCount, fail: failCount })}</strong></p>
                  <p style={{ marginTop: 16 }}>{t('pages.infra.tenant.deleteFailedRecords')}</p>
                  <List
                    size="small"
                    dataSource={failedResults}
                    renderItem={(item) => (
                      <List.Item>
                        <Typography.Text type="danger">{item.message}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </div>
              ),
              onOk: () => {
                actionRef.current?.reload();
                setSelectedRowKeys([]);
              },
            });
          } else {
            Modal.success({
              title: t('pages.infra.tenant.deleteSuccessTitle'),
              content: t('pages.infra.tenant.deleteSuccessContent', { count: successCount }),
              onOk: () => {
                actionRef.current?.reload();
                setSelectedRowKeys([]);
              },
            });
          }
        } catch (error: any) {
          message.error(t('pages.infra.tenant.deleteOpFailed', { message: error?.message || '' }));
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Tenant>[] = [
    {
      title: t('pages.infra.tenant.name'),
      dataIndex: 'name',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取组织名称选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         name: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.name} (${tenant.domain})`,
        //       value: tenant.name,
        //     }));
        //   } catch (error) {
        //     return [];
        //   }
        // },
      },
    },
    {
      title: t('pages.infra.tenant.domain'),
      dataIndex: 'domain',
      ellipsis: true,
      sorter: true,
      responsive: ['md'],
      fieldProps: {
        // 自动完成功能：从后端获取域名选项（暂时移除，先完成基础功能）
        // autoCompleteApi: async (keyword: string) => {
        //   if (!keyword || keyword.length < 1) {
        //     return [];
        //   }
        //   try {
        //     const result = await getTenantList(
        //       {
        //         page: 1,
        //         page_size: 20,
        //         domain: keyword,
        //       },
        //       true // 超级管理员接口
        //     );
        //     return result.items.map((tenant) => ({
        //       label: `${tenant.domain} (${tenant.name})`,
        //       value: tenant.domain,
        //     }));
        //   } catch (error) {
        //     return [];
        //   }
        // },
      },
    },
    {
      title: t('pages.infra.tenant.status'),
      dataIndex: 'status',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantStatus.ACTIVE]: { text: t('pages.infra.tenant.statusActive') },
        [TenantStatus.INACTIVE]: { text: t('pages.infra.tenant.statusInactive') },
        [TenantStatus.EXPIRED]: { text: t('pages.infra.tenant.statusExpired') },
        [TenantStatus.SUSPENDED]: { text: t('pages.infra.tenant.statusSuspended') },
      },
      render: (_, record) => {
        const statusInfo = statusTagMap[record.status] ?? { color: 'default', textKey: '' };
        return <Tag color={statusInfo.color}>{statusInfo.textKey ? t(statusInfo.textKey) : (record.status ?? '-')}</Tag>;
      },
    },
    {
      title: t('pages.infra.tenant.plan'),
      dataIndex: 'plan',
      valueType: 'select',
      sorter: true,
      valueEnum: {
        [TenantPlan.TRIAL]: { text: t('pages.infra.tenant.planTrial') },
        [TenantPlan.BASIC]: { text: t('pages.infra.tenant.planBasic') },
        [TenantPlan.PROFESSIONAL]: { text: t('pages.infra.tenant.planProfessional') },
        [TenantPlan.ENTERPRISE]: { text: t('pages.infra.tenant.planEnterprise') },
      },
      render: (_, record) => {
        const planInfo = planTagMap[record.plan] ?? { color: 'default', textKey: '' };
        return <Tag color={planInfo.color}>{planInfo.textKey ? t(planInfo.textKey) : (record.plan ?? '-')}</Tag>;
      },
    },
    {
      title: t('pages.infra.tenant.maxUsers'),
      dataIndex: 'max_users',
      width: 120,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: t('pages.infra.tenant.maxStorage'),
      dataIndex: 'max_storage',
      width: 150,
      hideInSearch: true,
      sorter: true,
      responsive: ['lg'],
    },
    {
      title: t('pages.infra.tenant.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
      sorter: true,
      responsive: ['xl'],
    },
    {
      title: t('pages.infra.tenant.actions'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record) => {
        const isInactive = record.status === TenantStatus.INACTIVE;
        const isActive = record.status === TenantStatus.ACTIVE;
        const isSuspended = record.status === TenantStatus.SUSPENDED;

        return (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenDetail(record.id)}
            >
              {t('pages.infra.tenant.detail')}
            </Button>
            {isInactive && (
              <Popconfirm
                title={t('pages.infra.tenant.approveConfirm')}
                onConfirm={async () => {
                  const success = await approveTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  {t('pages.infra.tenant.approve')}
                </Button>
              </Popconfirm>
            )}
            {isInactive && (
              <Popconfirm
                title={t('pages.infra.tenant.rejectConfirm')}
                onConfirm={async () => {
                  const success = await rejectTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  {t('pages.infra.tenant.reject')}
                </Button>
              </Popconfirm>
            )}
            {isSuspended && (
              <Popconfirm
                title={t('pages.infra.tenant.activateConfirm')}
                onConfirm={async () => {
                  const success = await activateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                  {t('pages.infra.tenant.activate')}
                </Button>
              </Popconfirm>
            )}
            {isActive && (
              <Popconfirm
                title={t('pages.infra.tenant.deactivateConfirm')}
                onConfirm={async () => {
                  const success = await deactivateTenant(record.id);
                  if (success) {
                    actionRef.current?.reload();
                  }
                }}
              >
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>
                  {t('pages.infra.tenant.deactivate')}
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Tenant>
      actionRef={actionRef}
      columns={columns}
      rowKey="id"
      showAdvancedSearch={true}
      enableRowSelection={true}
      onRowSelectionChange={(keys) => {
        setSelectedRowKeys(keys);
      }}
      showCreateButton={true}
      createButtonText={t('pages.infra.tenant.createButton')}
      onCreate={handleCreate}
      showEditButton={true}
      onEdit={handleEdit}
      showDeleteButton={true}
      deleteButtonText={t('pages.infra.tenant.batchDeleteButton')}
      onDelete={handleDelete}
      showImportButton={true}
      onImport={handleImport}
      importHeaders={[t('pages.infra.tenant.importHeaderName'), t('pages.infra.tenant.importHeaderDomain'), t('pages.infra.tenant.importHeaderPlan'), t('pages.infra.tenant.importHeaderStatus'), t('pages.infra.tenant.importHeaderMaxUsers'), t('pages.infra.tenant.importHeaderMaxStorage'), t('pages.infra.tenant.importHeaderExpiresAt')]}
      importExampleRow={[t('pages.infra.tenant.importExampleName'), 'example', t('pages.infra.tenant.planTrial'), t('pages.infra.tenant.statusInactive'), '10', '1024', '']}
      showExportButton={true}
      onExport={handleExport}
      viewTypes={['table', 'help']}
      defaultViewType="table"
      request={async (params, sort, _filter, searchFormValues) => {
        // 处理排序参数
        let sortField: string | undefined;
        let sortOrder: 'asc' | 'desc' | undefined;
        
        if (sort && Object.keys(sort).length > 0) {
          // 获取第一个排序字段
          const firstSortKey = Object.keys(sort)[0];
          const firstSortValue = sort[firstSortKey];
          sortField = firstSortKey;
          sortOrder = firstSortValue === 'ascend' ? 'asc' : 'desc';
        }

        // 处理搜索参数
        const apiParams: any = {
          page: params.current || 1,
          page_size: params.pageSize || 10,
          sort: sortField,
          order: sortOrder,
        };
        
        // 状态和套餐筛选
        // ⭐ 修复：确保只有明确选择的状态才会被传递，避免意外过滤
        if (searchFormValues?.status && searchFormValues.status !== '' && searchFormValues.status !== undefined && searchFormValues.status !== null) {
          apiParams.status = searchFormValues.status as TenantStatus;
        }
        if (searchFormValues?.plan && searchFormValues.plan !== '' && searchFormValues.plan !== undefined && searchFormValues.plan !== null) {
          apiParams.plan = searchFormValues.plan as TenantPlan;
        }
        
        // 搜索条件处理：name 和 domain 使用模糊搜索
        if (searchFormValues?.name) {
          apiParams.name = searchFormValues.name as string;
        }
        if (searchFormValues?.domain) {
          apiParams.domain = searchFormValues.domain as string;
        }

        try {
          const result = await getTenantList(
            apiParams,
            true  // 平台超级管理员接口
          );

          return {
            data: result.items,
            success: true,
            total: result.total,
          };
        } catch (error: any) {
          // 如果获取数据失败，返回空列表而不是抛出错误
          // 避免错误导致页面跳转
          console.error('获取组织列表失败:', error);
          message.error(error?.message || t('pages.infra.tenant.listLoadFailed'));
          return {
            data: [],
            success: false,
            total: 0,
          };
        }
      }}
      scroll={{ x: 1200 }}
        />
      </ListPageTemplate>
    
    {/* 组织详情 Drawer */}
    <DetailDrawerTemplate<Tenant>
      title={t('pages.infra.tenant.detailTitle')}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      open={drawerVisible}
      onClose={handleCloseDetail}
      loading={detailLoading}
      dataSource={tenantDetail || {}}
      columns={[
            {
              title: t('pages.infra.tenant.name'),
              dataIndex: 'name',
            },
            {
              title: t('pages.infra.tenant.domain'),
              dataIndex: 'domain',
            },
            {
              title: t('pages.infra.tenant.status'),
              dataIndex: 'status',
              render: (_, record) => {
                const statusInfo = statusTagMap[record.status] ?? { color: 'default', textKey: '' };
                return <Tag color={statusInfo.color}>{statusInfo.textKey ? t(statusInfo.textKey) : (record.status ?? '-')}</Tag>;
              },
            },
            {
              title: t('pages.infra.tenant.plan'),
              dataIndex: 'plan',
              render: (_, record) => {
                const planInfo = planTagMap[record.plan] ?? { color: 'default', textKey: '' };
                return <Tag color={planInfo.color}>{planInfo.textKey ? t(planInfo.textKey) : (record.plan ?? '-')}</Tag>;
              },
            },
            {
              title: t('pages.infra.tenant.maxUsers'),
              dataIndex: 'max_users',
            },
            {
              title: t('pages.infra.tenant.maxStorage'),
              dataIndex: 'max_storage',
            },
            {
              title: t('pages.infra.tenant.expiresAt'),
              dataIndex: 'expires_at',
              valueType: 'dateTime',
            },
            {
              title: t('pages.infra.tenant.createdAt'),
              dataIndex: 'created_at',
              valueType: 'dateTime',
            },
            {
              title: t('pages.infra.tenant.updatedAt'),
              dataIndex: 'updated_at',
              valueType: 'dateTime',
            },
            {
              title: t('pages.infra.tenant.settings'),
              dataIndex: 'settings',
              span: 2,
              render: (value) => {
                if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
                  return '-';
                }
                try {
                  const jsonStr = typeof value === 'string'
                    ? value
                    : JSON.stringify(value, null, 2);
                  return (
                    <pre style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontSize: '12px',
                      fontFamily: CODE_FONT_FAMILY,
                      backgroundColor: '#f5f5f5',
                      padding: '8px',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {jsonStr}
                    </pre>
                  );
                } catch (error) {
                  return <span style={{ color: '#ff4d4f' }}>{t('pages.infra.tenant.configError')}</span>;
                }
              },
            },
          ]}
        />
    
    {/* 新建/编辑组织 Modal */}
    <FormModalTemplate
      title={isEdit ? t('pages.infra.tenant.editTitle') : t('pages.infra.tenant.createTitle')}
      open={modalVisible}
      onClose={handleCloseModal}
      onFinish={handleSubmit}
      isEdit={isEdit}
      loading={formLoading}
      width={MODAL_CONFIG.STANDARD_WIDTH}
      formRef={formRef}
      initialValues={{
        status: TenantStatus.INACTIVE,
        plan: TenantPlan.TRIAL,
      }}
    >
        <ProFormText
          name="name"
          label={t('pages.infra.tenant.name')}
          placeholder={t('pages.infra.tenant.namePlaceholder')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('pages.infra.tenant.nameRequired') },
            { min: 1, max: 100, message: t('pages.infra.tenant.nameLength') },
          ]}
        />
        <ProFormText
          name="domain"
          label={t('pages.infra.tenant.formDomainLabel')}
          placeholder={t('pages.infra.tenant.formDomainPlaceholder')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('pages.infra.tenant.formDomainRequired') },
            { min: 1, max: 100, message: t('pages.infra.tenant.domainLength') },
            { pattern: /^[a-z0-9-]+$/, message: t('pages.infra.tenant.formDomainPattern') },
          ]}
        />
        <SafeProFormSelect
          name="status"
          label={t('pages.infra.tenant.formStatusLabel')}
          placeholder={t('pages.infra.tenant.formStatusPlaceholder')}
          colProps={{ span: 12 }}
          options={[
            { label: t('pages.infra.tenant.statusActive'), value: TenantStatus.ACTIVE },
            { label: t('pages.infra.tenant.statusInactive'), value: TenantStatus.INACTIVE },
            { label: t('pages.infra.tenant.statusExpired'), value: TenantStatus.EXPIRED },
            { label: t('pages.infra.tenant.statusSuspended'), value: TenantStatus.SUSPENDED },
          ]}
        />
        <SafeProFormSelect
          name="plan"
          label={t('pages.infra.tenant.formPlanLabel')}
          placeholder={t('pages.infra.tenant.formPlanPlaceholder')}
          colProps={{ span: 12 }}
          options={[
            { label: t('pages.infra.tenant.planTrial'), value: TenantPlan.TRIAL },
            { label: t('pages.infra.tenant.planBasic'), value: TenantPlan.BASIC },
            { label: t('pages.infra.tenant.planProfessional'), value: TenantPlan.PROFESSIONAL },
            { label: t('pages.infra.tenant.planEnterprise'), value: TenantPlan.ENTERPRISE },
          ]}
          fieldProps={{
            onChange: (value: TenantPlan) => {
              handlePlanChange(value);
            },
          }}
          extra={
            selectedPlan && packageConfigs[selectedPlan]
              ? t('pages.infra.tenant.planDescriptionExtra', {
                  description: packageConfigs[selectedPlan].description,
                  maxUsers: packageConfigs[selectedPlan].max_users,
                  maxStorage: packageConfigs[selectedPlan].max_storage_mb,
                })
              : undefined
          }
        />
        <ProFormDigit
          name="max_users"
          label={t('pages.infra.tenant.maxUsers')}
          placeholder={t('pages.infra.tenant.formMaxUsersPlaceholder')}
          colProps={{ span: 12 }}
          min={1}
          rules={[{ required: true, message: t('pages.infra.tenant.formMaxUsersRequired') }]}
          extra={t('pages.infra.tenant.formPlanExtra')}
        />
        <ProFormDigit
          name="max_storage"
          label={t('pages.infra.tenant.formMaxStorageLabel')}
          placeholder={t('pages.infra.tenant.formMaxStoragePlaceholder')}
          colProps={{ span: 12 }}
          min={0}
          rules={[{ required: true, message: t('pages.infra.tenant.formMaxStorageRequired') }]}
          extra={t('pages.infra.tenant.formPlanExtra')}
        />
        <ProFormDateTimePicker
          name="expires_at"
          label={t('pages.infra.tenant.formExpiresAtLabel')}
          placeholder={t('pages.infra.tenant.formExpiresAtPlaceholder')}
          colProps={{ span: 12 }}
        />
    </FormModalTemplate>
    </>
  );
};

export default SuperAdminTenantList;

