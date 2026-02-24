/**
 * 物料清单BOM管理页面
 * 
 * 提供物料清单BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProDescriptionsItemType, ProDescriptions, ProFormList, ProFormDateTimePicker, ProFormSelect, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import CodeField from '../../../../../components/code-field';
import { App, Button, Tag, Space, Modal, Input, Tree, Spin, Table, Form as AntForm, Select, Switch, InputNumber, Dropdown, Tabs, Checkbox } from 'antd';
import type { MenuProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined, CopyOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, BranchesOutlined, DiffOutlined, HistoryOutlined, CalculatorOutlined, ApartmentOutlined, EllipsisOutlined, UndoOutlined, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material, BOMBatchCreate, BOMItemCreate, BOMBatchImport, BOMBatchImportItem, BOMVersionCreate, BOMVersionCompare, BOMVersionCompareResult, BOMHierarchy, BOMHierarchyItem, BOMQuantityResult, BOMQuantityComponent } from '../../../types/material';
import { testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';

/**
 * 单位列展示：接收 Form 的 value（单位 code），渲染字典标签，表格渲染前已映射
 */
const UnitDisplayCell: React.FC<{
  value?: string;
  onChange?: (v: string) => void;
  unitValueToLabel: Record<string, string>;
}> = ({ value, unitValueToLabel }) => (
  <span>{value && unitValueToLabel[value] ? unitValueToLabel[value] : (value || '-')}</span>
);

/** 同一 BOM 编码（bomCode + materialId + version）分组后的行，用于树形表格展示 */
interface BOMGroupRow {
  groupKey: string;
  bomCode: string;
  version: string;
  materialId: number;
  approvalStatus: BOM['approvalStatus'];
  firstItem: BOM;
  items: BOM[];
  children?: BOM[]; // 树形数据的子节点
}

/**
 * 物料清单BOM管理列表页面组件
 */
const BOMPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentBOMUuid, setCurrentBOMUuid] = useState<string | null>(null);
  const [bomDetail, setBomDetail] = useState<BOM | null>(null);
  const [bomItems, setBomItems] = useState<BOM[]>([]); // 所有子物料列表
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑BOM）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  /** 编辑时：按主料+版本定位整份 BOM，保存时先删后批量创建 */
  const [editContext, setEditContext] = useState<{ materialId: number; version: string; uuidsToReplace: string[] } | null>(null);
  
  // 审核Modal状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalGroupKey, setApprovalGroupKey] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalRecursive, setApprovalRecursive] = useState(false);
  
  // 批量导入加载状态
  const [batchImportLoading, setBatchImportLoading] = useState(false);
  
  // 版本管理Modal状态
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [versionHistoryModalVisible, setVersionHistoryModalVisible] = useState(false);
  const [currentMaterialId, setCurrentMaterialId] = useState<number | null>(null);
  const versionFormRef = useRef<ProFormInstance>();
  
  // 递归审核选项Ref（批量操作用）
  const recursiveApprovalRef = useRef<boolean>(false);
  // 单条反审核的递归选项Ref
  const recursiveUnapproveRef = useRef<boolean>(false);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionList, setVersionList] = useState<BOM[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<{ version1: string; version2: string } | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<any>(null);
  
  // 层级结构状态（整合到详情中）
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<any>(null);
  const [hierarchyTreeData, setHierarchyTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  
  // 用量计算Modal状态
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [quantityLoading, setQuantityLoading] = useState(false);
  const [quantityResult, setQuantityResult] = useState<BOMQuantityResult | null>(null);
  const [parentQuantity, setParentQuantity] = useState<number>(1.0);
  const quantityFormRef = useRef<ProFormInstance>();
  
  // 物料列表（用于下拉选择）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // 单位字典映射（value -> label）
  const [unitValueToLabel, setUnitValueToLabel] = useState<Record<string, string>>({});

  /** 分组行 groupKey -> 该组内所有 BOM 的 uuid，用于批量删除时解析 */
  const groupKeyToUuidsRef = useRef<Map<string, string[]>>(new Map());

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
   * 加载单位字典
   */
  useEffect(() => {
    const loadUnitDictionary = async () => {
      try {
        const dictionary = await getDataDictionaryByCode('MATERIAL_UNIT');
        const items = await getDictionaryItemList(dictionary.uuid, true);
        
        // 创建value到label的映射
        const valueToLabelMap: Record<string, string> = {};
        items.forEach(item => {
          valueToLabelMap[item.value] = item.label;
        });
        setUnitValueToLabel(valueToLabelMap);
      } catch (error: any) {
        console.error('加载单位字典失败:', error);
      }
    };
    loadUnitDictionary();
  }, []);

  /**
   * 重新生成BOM编码（根据当前表单值）
   */
  const regenerateBOMCode = async () => {
    if (isEdit) {
      return;
    }

    // 直接从后端API获取配置，而不是使用本地配置
    try {
      const config = await getCodeRulePageConfig('master-data-engineering-bom');
      
      if (!config?.autoGenerate || !config?.ruleCode) {
        console.warn('BOM编码自动生成未启用或规则代码不存在:', config);
        return;
      }

      const ruleCode = config.ruleCode;

      // 获取当前表单值
      const formValues = formRef.current?.getFieldsValue();
      const materialId = formValues?.materialId;
      const version = formValues?.version || '1.0';
      
      // 构建编码规则的上下文
      const context: Record<string, any> = {
        version,
      };
      
      // 如果选择了主物料，添加物料信息到上下文
      if (materialId) {
        const selectedMaterial = materials.find(m => m.id === materialId);
        if (selectedMaterial) {
          context.material_code = selectedMaterial.mainCode || selectedMaterial.code;
          context.material_name = selectedMaterial.name;
        }
      }
      
      const codeResponse = await testGenerateCode({ 
        rule_code: ruleCode,
        context,
        check_duplicate: true,
        entity_type: 'bom',
      });
      
      // 如果返回的编码不为空，更新表单字段（总是更新预览）
      if (codeResponse.code) {
        formRef.current?.setFieldsValue({
          bomCode: codeResponse.code,
        });
      }
    } catch (error: any) {
      console.error('获取编码规则配置或生成编码失败:', error?.message || error);
    }
  };

  /**
   * 处理新建BOM
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setEditContext(null);
    setCurrentBOMUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isAlternative: false,
      priority: 0,
    });

    // 如果启用了自动编码，获取预览编码
    // 直接从后端API获取配置，确保配置是最新的
    try {
      const config = await getCodeRulePageConfig('master-data-engineering-bom');
      
      console.log('BOM编码自动生成检查 - 后端配置:', config);
      
      if (config?.autoGenerate && config?.ruleCode) {
        const ruleCode = config.ruleCode;
        
        try {
          // 构建基础context（版本号默认值）
          const context: Record<string, any> = {
            version: '1.0',
          };
          
          console.log('调用testGenerateCode:', { rule_code: ruleCode, context, entity_type: 'bom' });
          
          const codeResponse = await testGenerateCode({ 
            rule_code: ruleCode,
            context,
            check_duplicate: true,
            entity_type: 'bom',
          });
          
          console.log('testGenerateCode响应:', codeResponse);
          
          // 如果返回的编码为空，说明规则不存在或未启用，静默处理
          if (codeResponse.code) {
            formRef.current?.setFieldsValue({
              bomCode: codeResponse.code,
            });
          } else {
            console.warn(`编码规则 ${ruleCode} 不存在或未启用，跳过自动生成。响应:`, codeResponse);
            messageApi.warning(t('app.master-data.bom.codeRuleNotFound', { ruleCode }));
          }
        } catch (error: any) {
          // 处理其他错误（网络错误等）
          console.error('自动生成编码失败:', error?.message || error, error);
          messageApi.error(`${t('app.master-data.bom.autoCodeFailed')}: ${error?.message || error}`);
        }
      } else {
        console.warn('BOM编码自动生成未启用或规则代码不存在:', config);
      }
    } catch (error: any) {
      console.error('获取编码规则配置失败:', error);
    }
  };

  /**
   * 处理编辑BOM（按主料+版本加载完整 BOM 结构，支持增删改子件）
   * @param record 任意一条该 BOM 下的记录（含 materialId、version），用于定位整份 BOM
   */
  const handleEdit = async (record: BOM) => {
    try {
      const list = await bomApi.getByMaterial(record.materialId, record.version, false);
      if (!list?.length) {
        messageApi.error(t('app.master-data.bom.bomNotFound'));
        return;
      }
      const first = list[0]!;
      console.log('编辑BOM - 获取到的数据:', { 
        bomCode: first.bomCode, 
        materialId: first.materialId, 
        version: first.version,
        allBomCodes: list.map(b => b.bomCode)
      });
      setIsEdit(true);
      setEditContext({
        materialId: first.materialId,
        version: first.version ?? '1.0',
        uuidsToReplace: list.map((b) => b.uuid),
      });
      // 确保 BOM 编码正确设置：优先使用第一个记录的 bomCode，如果不存在则尝试从其他记录中获取
      const bomCodeValue = first.bomCode ?? list.find(b => b.bomCode)?.bomCode ?? '';
      const itemsData = list.map((b) => ({
        componentId: b.componentId,
        quantity: b.quantity,
        unit: b.unit,
        wasteRate: b.wasteRate ?? 0,
        isRequired: b.isRequired !== false,
        isAlternative: b.isAlternative,
        alternativeGroupId: b.alternativeGroupId,
        priority: b.priority,
        description: b.description,
        remark: b.remark,
      }));
      
      setModalVisible(true);
      // 使用 setTimeout 确保 Modal 和表单完全渲染后再设置值
      // 对于 AntForm.List，需要更长的延迟确保组件已完全初始化
      setTimeout(() => {
        if (formRef.current) {
          formRef.current.setFieldsValue({
            materialId: first.materialId,
            version: first.version ?? '1.0',
            bomCode: bomCodeValue,
            effectiveDate: first.effectiveDate,
            expiryDate: first.expiryDate,
            approvalStatus: first.approvalStatus,
            description: first.description,
            remark: first.remark,
            isActive: first.isActive,
          });
          // 单独设置 items，确保 AntForm.List 能正确接收数据
          setTimeout(() => {
            formRef.current?.setFieldValue('items', itemsData);
          }, 50);
        }
      }, 150);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.getFailed'));
    }
  };
  
  /**
   * 处理复制BOM
   */
  const handleCopy = async (record: BOM) => {
    try {
      const newBom = await bomApi.copy(record.uuid);
      messageApi.success(t('app.master-data.bom.copySuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.copyFailed'));
    }
  };
  
  /**
   * 处理单条反审核（按组：该 BOM 版本下所有子件行一并反审核，支持可选递归子BOM）
   */
  const handleUnapproveGroup = (record: BOMGroupRow) => {
    const uuids = groupKeyToUuidsRef.current.get(record.groupKey);
    if (!uuids?.length) {
      messageApi.error(t('app.master-data.bom.getRecordFailed'));
      return;
    }
    recursiveUnapproveRef.current = false;
    Modal.confirm({
      title: t('app.master-data.bom.unapproveConfirmTitle'),
      content: (
        <div>
          <p>{t('app.master-data.bom.unapproveConfirmContent', { bomCode: record.bomCode, version: record.version })}</p>
          <p style={{ color: '#ff4d4f' }}>{t('app.master-data.bom.unapproveResetDraft')}</p>
          <div style={{ marginTop: 12 }}>
            <Checkbox onChange={(e) => { recursiveUnapproveRef.current = e.target.checked; }}>
              {t('app.master-data.bom.recursiveUnapprove')}
            </Checkbox>
          </div>
        </div>
      ),
      okText: t('app.master-data.bom.okUnapprove'),
      okType: 'danger',
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.batchApprove(uuids, true, '反审核', recursiveUnapproveRef.current, true);
          messageApi.success(t('app.master-data.bom.unapproveSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.unapproveFailed'));
        }
      },
    });
  };

  /**
   * 处理打开审核Modal
   */
  const handleOpenApproval = (record: BOMGroupRow) => {
    setApprovalGroupKey(record.groupKey);
    setApprovalComment('');
    setApprovalRecursive(false);
    setApprovalModalVisible(true);
  };

  /**
   * 处理审核BOM（支持递归审核子BOM）
   */
  const handleApprove = async (approved: boolean) => {
    if (!approvalGroupKey) return;
    const uuids = groupKeyToUuidsRef.current.get(approvalGroupKey);
    if (!uuids?.length) {
      messageApi.error(t('app.master-data.bom.getRecordFailed'));
      return;
    }

    try {
      setApprovalLoading(true);
      await bomApi.batchApprove(uuids, approved, approvalComment || undefined, approvalRecursive, false);
      messageApi.success(approved ? t('app.master-data.bom.approvePass') : t('app.master-data.bom.approveReject'));
      setApprovalModalVisible(false);
      setApprovalComment('');
      setApprovalGroupKey(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.approveFailed'));
    } finally {
      setApprovalLoading(false);
    }
  };
  
  /**
   * 获取审核状态标签
   */
  const getApprovalStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      draft: { color: 'default', text: t('app.master-data.bom.statusDraft'), icon: <ClockCircleOutlined /> },
      pending: { color: 'processing', text: t('app.master-data.bom.statusPending'), icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: t('app.master-data.bom.statusApproved'), icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: t('app.master-data.bom.statusRejected'), icon: <CloseCircleOutlined /> },
    };
    
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <Tag color={statusInfo.color} icon={statusInfo.icon}>
        {statusInfo.text}
      </Tag>
    );
  };

  /**
   * 处理删除单条BOM（子件级，保留供批量删除等场景）
   */
  const handleDelete = async (record: BOM) => {
    try {
      await bomApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  /**
   * 删除整份BOM（主件下全部子件）
   */
  const handleDeleteGroup = (record: BOMGroupRow) => {
    const uuids = record.items.map((i) => i.uuid);
    if (!uuids.length) return;
    Modal.confirm({
      title: t('app.master-data.bom.deleteConfirmTitle'),
      content: t('app.master-data.bom.deleteConfirmContent', { count: uuids.length }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          for (const uuid of uuids) await bomApi.delete(uuid);
          messageApi.success(t('common.deleteSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || t('common.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理批量删除BOM（支持分组行：groupKey 解析为该组所有 uuid 并删除）
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }

    const toDelete: string[] = [];
    for (const key of selectedRowKeys) {
      const k = String(key);
      if (k.startsWith('group:')) {
        const uuids = groupKeyToUuidsRef.current.get(k);
        if (uuids?.length) toDelete.push(...uuids);
      } else {
        toDelete.push(k);
      }
    }
    const count = toDelete.length;
    if (count === 0) {
      messageApi.warning(t('app.master-data.bom.noDeleteRecords'));
      return;
    }

    Modal.confirm({
      title: t('app.master-data.bom.batchDeleteConfirmTitle'),
      content: t('app.master-data.bom.batchDeleteConfirmContent', { count }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const uuid of toDelete) {
            try {
              await bomApi.delete(uuid);
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('app.master-data.bom.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length ? '：' + errors.join('; ') : '' }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };


  /**
   * 处理批量审核BOM
   */
  /**
   * 处理批量审核BOM
   */
  const handleBatchApprove = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToApprove'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of selectedRowKeys) {
      const k = String(key);
      if (k.startsWith('group:')) {
        const uuids = groupKeyToUuidsRef.current.get(k);
        if (uuids?.length) toProcess.push(...uuids);
      } else {
        toProcess.push(k);
      }
    }
    const count = toProcess.length;
    if (count === 0) {
      messageApi.warning(t('app.master-data.bom.noApproveRecords'));
      return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: t('app.master-data.bom.batchApproveTitle'),
      content: (
        <div>
          <p>{t('app.master-data.bom.batchApproveContent', { count })}</p>
          <div style={{ marginTop: 8 }}>
             <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                {t('app.master-data.bom.recursiveApprove')}
             </Checkbox>
          </div>
        </div>
      ),
      okText: t('app.master-data.bom.okApprove'),
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          // 直接调用批量审核API
          await bomApi.batchApprove(toProcess, true, '批量审核通过', recursiveApprovalRef.current, false);
          messageApi.success(t('app.master-data.bom.approveSuccess', { count }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.batchApproveFailed'));
        }
      },
    });
  };

  /**
   * 处理批量反审核BOM
   */
  const handleBatchUnapprove = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.master-data.bom.selectToOperate'));
      return;
    }

    const toProcess: string[] = [];
    for (const key of selectedRowKeys) {
        const k = String(key);
        if (k.startsWith('group:')) {
            const uuids = groupKeyToUuidsRef.current.get(k);
            if (uuids?.length) toProcess.push(...uuids);
        } else {
            toProcess.push(k);
        }
    }
    const count = toProcess.length;
    if (count === 0) {
        messageApi.warning(t('app.master-data.bom.noOperateRecords'));
        return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: t('app.master-data.bom.batchUnapproveTitle'),
      content: (
          <div>
            <p>{t('app.master-data.bom.batchUnapproveContent', { count })}</p>
            <p style={{ color: '#ff4d4f' }}>{t('app.master-data.bom.unapproveResetDraftTip')}</p>
            <div style={{ marginTop: 8 }}>
                 <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                    {t('app.master-data.bom.recursiveUnapproveShort')}
                 </Checkbox>
            </div>
          </div>
      ),
      okText: t('app.master-data.bom.okUnapprove'),
      okType: 'danger',
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.batchApprove(toProcess, true, '批量反审核', recursiveApprovalRef.current, true);
          messageApi.success(t('app.master-data.bom.unapproveCountSuccess', { count }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.batchUnapproveFailed'));
        }
      },
    });
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: BOM) => {
    try {
      setCurrentBOMUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      setHierarchyLoading(true);
      
      // 获取整个BOM结构（所有子物料）
      const allBomItems = await bomApi.getByMaterial(record.materialId, record.version, false);
      
      if (!allBomItems || allBomItems.length === 0) {
        messageApi.error(t('app.master-data.bom.bomDataNotFound'));
        return;
      }
      
      // 使用第一条记录作为基本信息（包含BOM编码、版本等）
      const firstItem = allBomItems[0]!;
      setBomDetail(firstItem);
      setBomItems(allBomItems);
      
      // 并行加载层级结构
      const hierarchy = await bomApi.getHierarchy(record.materialId, record.version).catch(() => null);
      
      // 处理层级结构数据
      if (hierarchy) {
        console.log('层级结构原始数据:', hierarchy);
        console.log('层级结构items:', hierarchy.items);
        setHierarchyData(hierarchy);
        
        // 转换为Tree组件需要的格式
        const convertToTreeData = (items: BOMHierarchyItem[], parentPath: string = ''): DataNode[] => {
          return items.map((item, index) => {
            const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
            // 直接使用后端返回的 componentCode 和 componentName，如果不存在则尝试从 materials 中查找
            let materialName = '';
            if (item.componentCode && item.componentName) {
              materialName = `${item.componentCode} - ${item.componentName}`;
            } else if (item.componentId) {
              const material = materials.find(m => m.id === item.componentId);
              materialName = material ? `${material.code} - ${material.name}` : `物料ID: ${item.componentId}`;
            } else {
              materialName = t('app.master-data.bom.materialIdUnknown');
            }
            
            // 构建节点标题
            const title = (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>{materialName}</span>
                <Tag color="blue">{item.quantity} {item.unit || ''}</Tag>
                {item.wasteRate > 0 && (
                  <Tag color="orange">损耗率: {item.wasteRate}%</Tag>
                )}
                {!item.isRequired && (
                  <Tag color="default">可选</Tag>
                )}
                <span style={{ color: '#999', fontSize: '12px' }}>
                  层级: {item.level}
                </span>
              </div>
            );
            
            return {
              title,
              key: currentPath,
              children: item.children && item.children.length > 0 ? convertToTreeData(item.children, currentPath) : undefined,
              isLeaf: !item.children || item.children.length === 0,
              data: item,
            };
          });
        };
        
        const treeData = convertToTreeData(hierarchy.items || []);
        setHierarchyTreeData(treeData);
        
        // 默认展开所有节点
        const getAllKeys = (nodes: DataNode[]): React.Key[] => {
          let keys: React.Key[] = [];
          nodes.forEach(node => {
            keys.push(node.key);
            if (node.children && node.children.length > 0) {
              keys = keys.concat(getAllKeys(node.children));
            }
          });
          return keys;
        };
        setExpandedKeys(getAllKeys(treeData));
      } else {
        setHierarchyData(null);
        setHierarchyTreeData([]);
        setExpandedKeys([]);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.getDetailFailed'));
    } finally {
      setDetailLoading(false);
      setHierarchyLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentBOMUuid(null);
    setBomDetail(null);
    setBomItems([]);
    setHierarchyData(null);
    setHierarchyTreeData([]);
    setExpandedKeys([]);
  };

  /**
   * 处理提交表单（创建/更新BOM）
   * 编辑时：先删除原主料+版本下全部 BOM 记录，再按表单批量创建，形成完整主料–子件关系
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      if (!values.items || values.items.length === 0) {
        messageApi.error(t('app.master-data.bom.addAtLeastOneChild'));
        return;
      }
      if (!values.materialId) {
        messageApi.error(t('app.master-data.bom.selectMainMaterial'));
        return;
      }

      const buildBatch = () => {
        return {
          material_id: values.materialId,
          items: values.items.map((item: any) => {
            if (!item.componentId) throw new Error(t('app.master-data.bom.selectChildMaterial'));
            if (!item.quantity || item.quantity <= 0) throw new Error(t('app.master-data.bom.quantityMustBePositive'));
            const unitValue = (item.unit && item.unit.trim()) ? item.unit.trim() : null;
            return {
              component_id: item.componentId,
              quantity: item.quantity,
              unit: unitValue,
              waste_rate: item.wasteRate ?? 0,
              is_required: item.isRequired !== false,
              is_alternative: item.isAlternative || false,
              alternative_group_id: item.alternativeGroupId || null,
              priority: item.priority || 0,
              description: item.description || null,
              remark: item.remark || null,
            };
          }),
          version: values.version || '1.0',
          bom_code: values.bomCode,
          effective_date: values.effectiveDate,
          expiry_date: values.expiryDate,
          approval_status: values.approvalStatus || 'draft',
          description: values.description,
          remark: values.remark,
          is_active: values.isActive !== false,
        };
      };

      if (isEdit && editContext) {
        for (const uuid of editContext.uuidsToReplace) {
          await bomApi.delete(uuid);
        }
        const batchData = buildBatch();
        await bomApi.create(batchData as any);
        messageApi.success(t('app.master-data.bom.structureUpdated', { count: batchData.items.length }));
        setEditContext(null);
      } else {
        const batchData = buildBatch();
        await bomApi.create(batchData as any);
        messageApi.success(t('app.master-data.bom.itemsCreated', { count: batchData.items.length }));
      }

      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? t('common.updateFailed') : t('common.createFailed')));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditContext(null);
    formRef.current?.resetFields();
  };

  /**
   * 获取物料名称（用于列表主物料/子物料列展示）
   */
  const getMaterialName = (materialId: number | undefined | null): string => {
    if (materialId == null) return '-';
    const material = materials.find(m => m.id === materialId);
    if (!material) return `物料ID: ${materialId}`;
    const code = material.code || material.mainCode || '';
    const spec = material.specification ? ` (${material.specification})` : '';
    return `${code} - ${material.name}${spec}`;
  };

  /**
   * 格式化物料显示文本（用于下拉选择器）
   */
  const formatMaterialLabel = (material: Material): string => {
    const code = material.code || material.mainCode || '';
    const spec = material.specification ? ` (${material.specification})` : '';
    return `${code} - ${material.name}${spec}`;
  };

  /**
   * 子物料选择/更新时：根据物料 baseUnit 回填单位，表单存 value，表格展示用字典标签
   * 使用回调的 componentId 更新，避免覆盖 Form 尚未写入的选项
   */
  const handleSubMaterialChange = (index: number, componentId: number | undefined) => {
    const unit = componentId ? (materials.find(m => m.id === componentId)?.baseUnit ?? '') : '';
    const items = formRef.current?.getFieldValue('items') ?? [];
    const next = [...items];
    if (next[index]) {
      const patch: Record<string, unknown> = { unit };
      if (componentId !== undefined) patch.componentId = componentId;
      next[index] = { ...next[index], ...patch };
      formRef.current?.setFieldsValue({ items: next });
    }
  };

  /**
   * 按 bomCode + materialId + version 分组，转换为树形数据结构
   */
  const groupBomsByCode = (list: BOM[]): { groupRows: BOMGroupRow[]; keyToUuids: Map<string, string[]> } => {
    const keyToUuids = new Map<string, string[]>();
    const map = new Map<string, BOM[]>();
    for (const b of list) {
      const k = `${b.bomCode ?? '-'}|${b.materialId}|${b.version ?? '1.0'}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    const groupRows: BOMGroupRow[] = [];
    map.forEach((items, k) => {
      const first = items[0]!;
      const uuids = items.map((i) => i.uuid);
      keyToUuids.set(`group:${k}`, uuids);
      // 将子物料作为 children，每个子物料添加唯一 key
      const children = items.map((item, idx) => ({
        ...item,
        key: `${item.uuid}-child-${idx}`, // 树形数据需要唯一 key
      }));
      groupRows.push({
        groupKey: `group:${k}`,
        bomCode: first.bomCode ?? '-',
        version: first.version ?? '1.0',
        materialId: first.materialId,
        approvalStatus: first.approvalStatus,
        firstItem: first,
        items,
        children: children.length > 0 ? children : undefined,
      });
    });
    return { groupRows, keyToUuids };
  };

  /**
   * 处理批量导入（UniTable导入功能）
   */
  const handleBatchImportConfirm = async (data: any[][]) => {
    try {
      setBatchImportLoading(true);

      // 验证数据格式
      if (!data || data.length < 2) {
        messageApi.error(t('app.master-data.bom.fillAtLeastOneRow'));
        return;
      }

      // 解析数据（第一行是表头，从第二行开始是数据）
      const headers = data[0];
      const rows = data.slice(1);

      // 验证表头
      const expectedHeaders = ['父件编码', '子件编码', '子件数量', '子件单位', '损耗率', '是否必选', '备注'];
      const headerIndexes: Record<string, number> = {};
      expectedHeaders.forEach((header, index) => {
        const foundIndex = headers.findIndex(h => h === header || h?.toString().trim() === header);
        if (foundIndex >= 0) {
          headerIndexes[header] = foundIndex;
        }
      });

      // 必填字段验证
      if (headerIndexes['父件编码'] === undefined || headerIndexes['子件编码'] === undefined || headerIndexes['子件数量'] === undefined) {
        messageApi.error(t('app.master-data.bom.importHeadersRequired'));
        return;
      }

      // 解析数据行
      const importItems: BOMBatchImportItem[] = [];
      const errors: string[] = [];

      rows.forEach((row, rowIndex) => {
        // 跳过空行
        if (!row || row.length === 0 || !row[headerIndexes['父件编码']]) {
          return;
        }

        const parentCode = row[headerIndexes['父件编码']]?.toString().trim();
        const componentCode = row[headerIndexes['子件编码']]?.toString().trim();
        const quantityStr = row[headerIndexes['子件数量']]?.toString().trim();
        const unit = headerIndexes['子件单位'] !== undefined ? row[headerIndexes['子件单位']]?.toString().trim() : undefined;
        const wasteRateStr = headerIndexes['损耗率'] !== undefined ? row[headerIndexes['损耗率']]?.toString().trim() : undefined;
        const isRequiredStr = headerIndexes['是否必选'] !== undefined ? row[headerIndexes['是否必选']]?.toString().trim() : undefined;
        const remark = headerIndexes['备注'] !== undefined ? row[headerIndexes['备注']]?.toString().trim() : undefined;

        // 验证必填字段
        if (!parentCode) {
          errors.push(`第 ${rowIndex + 2} 行：父件编码不能为空`);
          return;
        }
        if (!componentCode) {
          errors.push(`第 ${rowIndex + 2} 行：子件编码不能为空`);
          return;
        }
        if (!quantityStr) {
          errors.push(`第 ${rowIndex + 2} 行：子件数量不能为空`);
          return;
        }

        // 解析数量
        const quantity = parseFloat(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
          errors.push(`第 ${rowIndex + 2} 行：子件数量必须是大于0的数字`);
          return;
        }

        // 解析损耗率（支持百分比格式，如：5% 或 5）
        let wasteRate: number | undefined = undefined;
        if (wasteRateStr) {
          const wasteRateValue = parseFloat(wasteRateStr.replace('%', ''));
          if (!isNaN(wasteRateValue)) {
            if (wasteRateValue < 0 || wasteRateValue > 100) {
              errors.push(`第 ${rowIndex + 2} 行：损耗率必须在0-100之间`);
              return;
            }
            wasteRate = wasteRateValue;
          }
        }

        // 解析是否必选（支持：是/否、true/false、1/0）
        let isRequired: boolean | undefined = undefined;
        if (isRequiredStr) {
          const isRequiredLower = isRequiredStr.toLowerCase();
          if (isRequiredLower === '是' || isRequiredLower === 'true' || isRequiredLower === '1' || isRequiredLower === 'yes') {
            isRequired = true;
          } else if (isRequiredLower === '否' || isRequiredLower === 'false' || isRequiredLower === '0' || isRequiredLower === 'no') {
            isRequired = false;
          }
        }

        importItems.push({
          parentCode,
          componentCode,
          quantity,
          unit: unit || undefined,
          wasteRate: wasteRate !== undefined ? wasteRate : undefined,
          isRequired: isRequired !== undefined ? isRequired : true,
          remark: remark || undefined,
        });
      });

      // 如果有错误，显示错误信息
      if (errors.length > 0) {
        messageApi.error(t('app.master-data.bom.importValidationFailed', { errors: errors.join('\n') }));
        return;
      }

      // 如果没有有效数据，提示
      if (importItems.length === 0) {
        messageApi.error(t('app.master-data.bom.noValidImportData'));
        return;
      }

      // 调用批量导入API
      const batchImportData: BOMBatchImport = {
        items: importItems,
        version: '1.0', // 默认版本
      };

      await bomApi.batchImport(batchImportData);
      messageApi.success(t('app.master-data.bom.importSuccess', { count: importItems.length }));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.batchImportFailed'));
    } finally {
      setBatchImportLoading(false);
    }
  };


  /**
   * 处理创建新版本
   */
  const handleCreateVersion = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      setVersionModalVisible(true);
      // 获取当前版本号，建议新版本号
      const currentVersion = record.version;
      const versionMatch = currentVersion.match(/v?(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = parseInt(versionMatch[1]);
        const minor = parseInt(versionMatch[2]);
        const suggestedVersion = `v${major}.${minor + 1}`;
        versionFormRef.current?.setFieldsValue({
          version: suggestedVersion,
          applyStrategy: 'new_only',
        });
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.openVersionCreateFailed'));
    }
  };

  /**
   * 设为默认版本
   */
  const handleSetAsDefault = async (record: BOM) => {
    if (record.isDefault) {
      messageApi.info(t('app.master-data.bom.alreadyDefaultVersion'));
      return;
    }
    Modal.confirm({
      title: t('app.master-data.bom.setDefaultVersionTitle'),
      content: t('app.master-data.bom.setDefaultVersionContent', { bomCode: record.bomCode, version: record.version }),
      okText: t('app.master-data.bom.ok'),
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          await bomApi.update(record.uuid, { isDefault: true });
          messageApi.success(t('app.master-data.bom.setDefaultSuccess'));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.operationFailed'));
        }
      },
    });
  };

  /**
   * 处理BOM升版 (Revision)
   */
  const handleRevise = async (record: BOM) => {
    Modal.confirm({
      title: t('app.master-data.bom.reviseConfirmTitle'),
      content: t('app.master-data.bom.reviseConfirmContent', { bomCode: record.bomCode, version: record.version }),
      okText: t('app.master-data.bom.okRevise'),
      cancelText: t('app.master-data.bom.cancel'),
      onOk: async () => {
        try {
          const newBom = await bomApi.revise(record.uuid);
          messageApi.success(t('app.master-data.bom.upgradeSuccess', { version: newBom.version }));
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.master-data.bom.upgradeFailed'));
        }
      }
    });
  };


  /**
   * 处理版本创建提交
   */
  const handleVersionCreateSubmit = async (values: BOMVersionCreate) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }

    try {
      setVersionLoading(true);
      await bomApi.createVersion(currentMaterialId, values);
      messageApi.success(t('app.master-data.bom.versionCreateSuccess'));
      setVersionModalVisible(false);
      versionFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.versionCreateFailed'));
    } finally {
      setVersionLoading(false);
    }
  };

  /**
   * 处理查看版本历史
   */
  const handleViewVersionHistory = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      // 获取该物料的所有BOM版本
      const versions = await bomApi.getByMaterial(record.materialId);
      // 按版本号排序（降序）
      const sortedVersions = versions.sort((a, b) => {
        const aMatch = a.version.match(/v?(\d+)\.(\d+)/);
        const bMatch = b.version.match(/v?(\d+)\.(\d+)/);
        if (aMatch && bMatch) {
          const aMajor = parseInt(aMatch[1]);
          const aMinor = parseInt(aMatch[2]);
          const bMajor = parseInt(bMatch[1]);
          const bMinor = parseInt(bMatch[2]);
          if (aMajor !== bMajor) {
            return bMajor - aMajor;
          }
          return bMinor - aMinor;
        }
        return b.version.localeCompare(a.version);
      });
      setVersionList(sortedVersions);
      setVersionHistoryModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.getVersionHistoryFailed'));
    }
  };

  /**
   * 处理版本对比
   */
  const handleCompareVersions = async (version1: string, version2: string) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }

    try {
      setVersionLoading(true);
      const compareData: BOMVersionCompare = {
        version1,
        version2,
      };
      const result = await bomApi.compareVersions(currentMaterialId, compareData);
      setVersionCompareResult(result);
      setSelectedVersions({ version1, version2 });
      setVersionCompareModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.versionCompareFailed'));
    } finally {
      setVersionLoading(false);
    }
  };


  /**
   * 处理查看用量计算
   */
  const handleCalculateQuantity = async (record: BOM) => {
    try {
      setCurrentMaterialId(record.materialId);
      setParentQuantity(1.0);
      setQuantityModalVisible(true);
      quantityFormRef.current?.setFieldsValue({
        parentQuantity: 1.0,
        version: record.version,
      });
      // 自动计算一次
      await handleQuantityCalculate(record.materialId, 1.0, record.version);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.openQuantityCalcFailed'));
    }
  };

  /**
   * 处理用量计算
   */
  const handleQuantityCalculate = async (materialId: number, parentQty: number, version?: string) => {
    try {
      setQuantityLoading(true);
      const result = await bomApi.calculateQuantity(materialId, parentQty, version);
      setQuantityResult(result);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.quantityCalcFailed'));
    } finally {
      setQuantityLoading(false);
    }
  };

  /**
   * 处理用量计算提交
   */
  const handleQuantityCalculateSubmit = async (values: { parentQuantity: number; version?: string }) => {
    if (!currentMaterialId) {
      messageApi.error(t('app.master-data.bom.materialIdNotExist'));
      return;
    }
    await handleQuantityCalculate(currentMaterialId, values.parentQuantity, values.version);
  };

  /**
   * 分组行表格列（同一 BOM 编码折叠为一行）
   */
  const groupColumns: ProColumns<BOMGroupRow>[] = [
    { 
      title: 'BOM编码', 
      dataIndex: 'bomCode', 
      width: 150, 
      hideInSearch: true, 
      render: (_, r: any) => {
        // 判断是主行还是子行
        if ('groupKey' in r) {
          return r.bomCode || '-';
        }
        return '-'; // 子行不显示 BOM 编码
      }
    },
    { 
      title: t('app.master-data.bom.versionTitle'), 
      dataIndex: 'version', 
      width: 100, 
      hideInSearch: true, 
      render: (_, r: any) => {
        if ('groupKey' in r) {
          const first = r.firstItem;
          return (
            <Space size={4}>
              <Tag>{r.version}</Tag>
              {first?.isDefault && <Tag color="gold">{t('app.master-data.bom.defaultTag')}</Tag>}
            </Space>
          );
        }
        return '-';
      }
    },
    {
      title: t('app.master-data.bom.approvalStatusTitle'),
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      valueEnum: { draft: { text: t('app.master-data.bom.statusDraft'), status: 'Default' }, pending: { text: t('app.master-data.bom.statusPending'), status: 'Processing' }, approved: { text: t('app.master-data.bom.statusApproved'), status: 'Success' }, rejected: { text: t('app.master-data.bom.statusRejected'), status: 'Error' } },
      render: (_, r: any) => {
        if ('groupKey' in r) {
          return getApprovalStatusTag(r.approvalStatus);
        }
        return '-';
      }
    },
    { 
      title: t('app.master-data.bom.materialTitle'), 
      dataIndex: 'materialId', 
      width: 200, 
      hideInSearch: true, 
      render: (_, r: any) => {
        if ('groupKey' in r) {
          // 主行：显示主物料
          return getMaterialName(r.materialId);
        } else {
          // 子行：显示子物料
          return getMaterialName(r.componentId);
        }
      }
    },
    { 
      title: t('app.master-data.bom.quantityTitle'), 
      dataIndex: 'quantity', 
      width: 100, 
      hideInSearch: true,
      render: (_, r: any) => {
        if ('groupKey' in r) {
          return '-';
        }
        return `${r.quantity} ${r.unit || ''}`;
      }
    },
    { 
      title: t('app.master-data.bom.unitTitle'), 
      dataIndex: 'unit', 
      width: 80, 
      hideInSearch: true,
      render: (_, r: any) => {
        if ('groupKey' in r) {
          return '-';
        }
        return (r.unit && unitValueToLabel[r.unit]) ? unitValueToLabel[r.unit] : (r.unit || '-');
      }
    },
    { 
      title: t('app.master-data.bom.wasteRateTitle'), 
      dataIndex: 'wasteRate', 
      width: 90, 
      hideInSearch: true,
      render: (_, r: any) => {
        if ('groupKey' in r) {
          return '-';
        }
        return r.wasteRate ? `${r.wasteRate}%` : '0%';
      }
    },
    {
      title: t('app.master-data.bom.actionTitle'),
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, record: any) => {
        // 子行不显示操作
        if (!('groupKey' in record)) {
          return null;
        }
        const r = record.firstItem;
        const goDesigner = () => {
          const p = new URLSearchParams();
          p.set('materialId', String(r.materialId));
          if (r.version) p.set('version', r.version);
          navigate(`/apps/master-data/process/engineering-bom/designer?${p}`);
        };
        const isApproved = r.approvalStatus === 'approved';
        // 更多菜单：按逻辑分组，查看类 → 版本管理 → 其他 → 危险操作
        const moreItems: MenuProps['items'] = [
          {
            type: 'group',
            label: t('app.master-data.bom.view'),
            children: [
              { key: 'detail', icon: <DiffOutlined />, label: t('app.master-data.bom.detail'), onClick: () => handleOpenDetail(r) },
              { key: 'calculateQuantity', icon: <CalculatorOutlined />, label: t('app.master-data.bom.calculateQuantity'), onClick: () => handleCalculateQuantity(r) },
            ],
          },
          {
            type: 'group',
            label: t('app.master-data.bom.versionManage'),
            children: [
              { key: 'setDefault', icon: <StarOutlined />, label: t('app.master-data.bom.setDefault'), onClick: () => handleSetAsDefault(r), disabled: r.isDefault },
              { key: 'revise', icon: <BranchesOutlined />, label: t('app.master-data.bom.revise'), onClick: () => handleRevise(r), disabled: !isApproved },
              { key: 'newVersion', icon: <PlusOutlined />, label: t('app.master-data.bom.newVersion'), onClick: () => handleCreateVersion(r) },
              { key: 'versionHistory', icon: <HistoryOutlined />, label: t('app.master-data.bom.versionHistory'), onClick: () => handleViewVersionHistory(r) },
            ],
          },
          {
            type: 'group',
            label: t('app.master-data.bom.other'),
            children: [
              { key: 'copy', icon: <CopyOutlined />, label: t('app.master-data.bom.copy'), onClick: () => handleCopy(r) },
            ],
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('app.master-data.bom.delete'),
            danger: true,
            onClick: () => handleDeleteGroup(record),
            disabled: isApproved,
          },
        ];
        return (
          <Space wrap size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(r)}
              disabled={isApproved}
              title={isApproved ? t('app.master-data.bom.approvedCannotEditTitle') : t('app.master-data.bom.editTitle')}
            >
              {t('app.master-data.bom.editTitle')}
            </Button>
            <Button type="link" size="small" icon={<ApartmentOutlined />} onClick={goDesigner} title={t('app.master-data.bom.designerTitle')}>
              {t('app.master-data.bom.design')}
            </Button>
            {r.approvalStatus !== 'approved' ? (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenApproval(record)}
                title={t('app.master-data.bom.approvePassTitle')}
              >
                {t('app.master-data.bom.approve')}
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleUnapproveGroup(record)}
                title={t('app.master-data.bom.unapproveTitle')}
              >
                {t('app.master-data.bom.unapprove')}
              </Button>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<EllipsisOutlined />}>
                {t('app.master-data.bom.more')}
              </Button>
            </Dropdown>
          </Space>
        );

      },
    },
  ];


  /**
   * 详情 Drawer 的列定义
   */
  const detailColumns: ProDescriptionsItemType<BOM>[] = [
    {
      title: t('app.master-data.bom.bomCode'),
      dataIndex: 'bomCode',
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: t('app.master-data.bom.versionTitle'),
      dataIndex: 'version',
      render: (_, record) => (
        <Space size={4}>
          <Tag>{record.version}</Tag>
          {record.isDefault && <Tag color="gold">{t('app.master-data.bom.defaultTag')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('app.master-data.bom.approvalStatusTitle'),
      dataIndex: 'approvalStatus',
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: t('app.master-data.bom.mainMaterialTitle'),
      dataIndex: 'materialId',
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: t('app.master-data.bom.childMaterialTitle'),
      dataIndex: 'componentId',
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: t('app.master-data.bom.quantityTitle'),
      dataIndex: 'quantity',
    },
    {
      title: t('app.master-data.bom.unitTitle'),
      dataIndex: 'unit',
      render: (_, record) => record.unit || '-',
    },
    {
      title: t('app.master-data.bom.wasteRateTitle'),
      dataIndex: 'wasteRate',
      render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
    },
    {
      title: t('app.master-data.bom.isRequiredTitle'),
      dataIndex: 'isRequired',
      render: (_, record) => (
        <Tag color={record.isRequired !== false ? 'success' : 'default'}>
          {record.isRequired !== false ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.levelTitle'),
      dataIndex: 'level',
      render: (_, record) => record.level ?? 0,
    },
    {
      title: t('app.master-data.bom.levelPathTitle'),
      dataIndex: 'path',
      render: (_, record) => record.path || '-',
    },
    {
      title: t('app.master-data.bom.effectiveDateTitle'),
      dataIndex: 'effectiveDate',
      valueType: 'dateTime',
      render: (_, record) => record.effectiveDate || '-',
    },
    {
      title: t('app.master-data.bom.expiryDateTitle'),
      dataIndex: 'expiryDate',
      valueType: 'dateTime',
      render: (_, record) => record.expiryDate || '-',
    },
    {
      title: t('app.master-data.bom.alternativeTitle'),
      dataIndex: 'isAlternative',
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.priorityTitle'),
      dataIndex: 'priority',
    },
    {
      title: t('app.master-data.bom.descTitle'),
      dataIndex: 'description',
      span: 2,
    },
    {
      title: t('app.master-data.bom.remarkTitle'),
      dataIndex: 'remark',
      span: 2,
    },
    {
      title: t('app.master-data.bom.approverTitle'),
      dataIndex: 'approvedBy',
      render: (_, record) => record.approvedBy ? `用户ID: ${record.approvedBy}` : '-',
    },
    {
      title: t('app.master-data.bom.approvalTimeTitle'),
      dataIndex: 'approvedAt',
      valueType: 'dateTime',
      render: (_, record) => record.approvedAt || '-',
    },
    {
      title: t('app.master-data.bom.approvalCommentTitle'),
      dataIndex: 'approvalComment',
      span: 2,
      render: (_, record) => record.approvalComment || '-',
    },
    {
      title: t('app.master-data.bom.enabledStatusTitle'),
      dataIndex: 'isActive',
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? t('app.master-data.bom.enabled') : t('app.master-data.bom.disabled')}
        </Tag>
      ),
    },
    {
      title: t('app.master-data.bom.createTimeTitle'),
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: t('app.master-data.bom.updateTimeTitle'),
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<BOMGroupRow>
        actionRef={actionRef}
        columns={groupColumns}
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
          
          // 替代料筛选
          if (searchFormValues?.isAlternative !== undefined && searchFormValues.isAlternative !== '' && searchFormValues.isAlternative !== null) {
            apiParams.isAlternative = searchFormValues.isAlternative;
          }
          
          // 审核状态筛选
          if (searchFormValues?.approvalStatus !== undefined && searchFormValues.approvalStatus !== '' && searchFormValues.approvalStatus !== null) {
            apiParams.approvalStatus = searchFormValues.approvalStatus;
          }
          
          // 主物料筛选
          if (searchFormValues?.materialId !== undefined && searchFormValues.materialId !== '' && searchFormValues.materialId !== null) {
            apiParams.materialId = searchFormValues.materialId;
          }
          
          try {
            const result = await bomApi.list(apiParams);
            const { groupRows, keyToUuids } = groupBomsByCode(result);
            groupKeyToUuidsRef.current = keyToUuids;
            return {
              data: groupRows,
              success: true,
              total: groupRows.length,
            };
          } catch (error: any) {
            console.error('获取BOM列表失败:', error);
            messageApi.error(error?.message || t('app.master-data.bom.getListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="groupKey"
        defaultExpandAllRows={true}
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        headerActions={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建BOM
            </Button>
            <Button
              disabled={selectedRowKeys.length === 0}
              icon={<CheckCircleOutlined />}
              onClick={handleBatchApprove}
            >
              批量审核
            </Button>
            <Button
              disabled={selectedRowKeys.length === 0}
              icon={<UndoOutlined />}
              onClick={handleBatchUnapprove}
            >
              批量反审核
            </Button>
            <Button
              danger
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>
          </Space>
        }
        showImportButton={true}
        onImport={handleBatchImportConfirm}
        importHeaders={['父件编码', '子件编码', '子件数量', '子件单位', '损耗率', '是否必选', '备注']}
        importExampleRow={['SALE-A001', 'PROD-A001', '2', '个', '0%', '是', '']}
        importFieldMap={{
          '父件编码': 'parentCode',
          '子件编码': 'componentCode',
          '子件数量': 'quantity',
          '子件单位': 'unit',
          '损耗率': 'wasteRate',
          '是否必选': 'isRequired',
          '备注': 'remark',
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
      </ListPageTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate<BOM>
        title="BOM详情"
        open={drawerVisible}
        onClose={handleCloseDetail}
        dataSource={bomDetail || undefined}
        columns={detailColumns}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        customContent={
          <Tabs
            items={[
              {
                key: 'detail',
                label: t('app.master-data.bom.basicInfo'),
                children: (
                  <div style={{ paddingTop: 16 }}>
                    {/* BOM基本信息 */}
                    <ProDescriptions<BOM>
                      dataSource={bomDetail || undefined}
                      column={2}
                      columns={detailColumns.filter(col => 
                        // 只显示基本信息，不显示子物料相关字段
                        col.dataIndex !== 'componentId' && 
                        col.dataIndex !== 'quantity' && 
                        col.dataIndex !== 'unit' && 
                        col.dataIndex !== 'wasteRate' &&
                        col.dataIndex !== 'isRequired' &&
                        col.dataIndex !== 'level' &&
                        col.dataIndex !== 'path' &&
                        // 不显示替代料、优先级、备注
                        col.dataIndex !== 'isAlternative' &&
                        col.dataIndex !== 'priority' &&
                        col.dataIndex !== 'remark'
                      )}
                    />
                    
                    {/* 子物料列表 */}
                    {bomItems.length > 0 && (
                      <div style={{ marginTop: 24 }}>
                        <h4 style={{ marginBottom: 16, fontWeight: 500 }}>{t('app.master-data.bom.childMaterialListWithCount', { count: bomItems.length })}</h4>
                        <Table<BOM>
                          dataSource={bomItems}
                          rowKey="uuid"
                          pagination={false}
                          size="small"
                          columns={[
                            {
                              title: t('app.master-data.bom.serialNo'),
                              key: 'index',
                              width: 60,
                              render: (_, __, index) => index + 1,
                            },
                            {
                              title: t('app.master-data.bom.childMaterialTitle'),
                              dataIndex: 'componentId',
                              render: (_, record) => getMaterialName(record.componentId),
                            },
                            {
                              title: t('app.master-data.bom.quantityTitle'),
                              dataIndex: 'quantity',
                              width: 100,
                              align: 'right',
                            },
                            {
                              title: t('app.master-data.bom.unitTitle'),
                              dataIndex: 'unit',
                              width: 80,
                              render: (_, record) => {
                                const unitValue = record.unit;
                                const unitLabel = unitValueToLabel[unitValue || ''] || unitValue || '-';
                                return unitLabel;
                              },
                            },
                            {
                              title: t('app.master-data.bom.wasteRateTitle'),
                              dataIndex: 'wasteRate',
                              width: 100,
                              align: 'right',
                              render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
                            },
                            {
                              title: t('app.master-data.bom.isRequiredTitle'),
                              dataIndex: 'isRequired',
                              width: 100,
                              render: (_, record) => (
                                <Tag color={record.isRequired !== false ? 'success' : 'default'}>
                                  {record.isRequired !== false ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}
                                </Tag>
                              ),
                            },
                            {
                              title: t('app.master-data.bom.levelTitle'),
                              dataIndex: 'level',
                              width: 80,
                              render: (_, record) => record.level ?? 0,
                            },
                            {
                              title: t('app.master-data.bom.descTitle'),
                              dataIndex: 'description',
                              ellipsis: true,
                              render: (_, record) => record.description || '-',
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'hierarchy',
                label: t('app.master-data.bom.hierarchyStructure'),
                children: (
                  <div style={{ paddingTop: 16 }}>
                    <Spin spinning={hierarchyLoading}>
                      {hierarchyTreeData.length === 0 && !hierarchyLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                          {t('app.master-data.bom.noHierarchyData')}
                        </div>
                      ) : (
                        <div>
                          {hierarchyData && (
                            <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
                              <Space>
                                <span style={{ fontWeight: 500 }}>主物料：</span>
                                <span>
                                  {hierarchyData.materialCode && hierarchyData.materialName 
                                    ? `${hierarchyData.materialCode} - ${hierarchyData.materialName}`
                                    : hierarchyData.materialCode || hierarchyData.materialName || getMaterialName(hierarchyData.materialId) || '-'}
                                </span>
                                <span style={{ color: '#999' }}>版本：{hierarchyData.version || ''}</span>
                              </Space>
                            </div>
                          )}
                          <Tree
                            treeData={hierarchyTreeData}
                            expandedKeys={expandedKeys}
                            onExpand={setExpandedKeys}
                            blockNode
                            showLine={{ showLeafIcon: false }}
                            defaultExpandAll={false}
                          />
                        </div>
                      )}
                    </Spin>
                  </div>
                ),
              },
            ]}
          />
        }
      />

      {/* 创建/编辑BOM Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.master-data.bom.editBom') : t('app.master-data.bom.createBom')}
        open={modalVisible}
        onClose={handleCloseModal}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        initialValues={isEdit ? undefined : {
          isActive: true,
          version: '1.0',
          approvalStatus: 'draft',
          items: [{ 
            isAlternative: false, 
            priority: 0,
            wasteRate: 0,
            isRequired: true,
          }],
        }}
        className="bom-form-modal"
      >
        <style>{`
          /* 子物料列表标题添加左右8px padding */
          .bom-form-modal .bom-items-list-form-item .ant-form-item-label {
            padding-left: 8px;
            padding-right: 8px;
          }
        `}</style>
          <ProForm.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.materialId !== currentValues.materialId || prevValues.version !== currentValues.version}>
            {({ getFieldValue }) => {
              const materialId = getFieldValue('materialId');
              const version = getFieldValue('version') || '1.0';
              
              // 构建编码规则的上下文
              const context: Record<string, any> = {
                version,
              };
              
              // 如果选择了主物料，添加物料信息到上下文
              if (materialId) {
                const selectedMaterial = materials.find(m => m.id === materialId);
                if (selectedMaterial) {
                  // 优先使用mainCode，如果没有则使用code（向后兼容）
                  context.material_code = selectedMaterial.mainCode || selectedMaterial.code;
                  context.material_name = selectedMaterial.name;
                }
              }
              
              return (
                <CodeField
                  pageCode="master-data-engineering-bom"
                  name="bomCode"
                  label={t('app.master-data.bom.bomCode')}
                  colProps={{ span: 12 }}
                  autoGenerateOnCreate={!isEdit}
                  showGenerateButton={false}
                  context={context}
                  fieldProps={{
                    maxLength: 100,
                  }}
                />
              );
            }}
          </ProForm.Item>
          <SafeProFormSelect
            name="materialId"
            label={t('app.master-data.bom.mainMaterialLabel')}
            placeholder={t('app.master-data.bom.mainMaterialPlaceholder')}
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: formatMaterialLabel(m),
              value: m.id,
            }))}
            rules={[
              { required: true, message: t('app.master-data.bom.mainMaterialRequired') },
            ]}
            fieldProps={{
              disabled: isEdit,
              loading: materialsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
              onChange: () => {
                if (isEdit) return;
                setTimeout(() => regenerateBOMCode(), 300);
              },
            }}
          />
          <ProFormText
            name="version"
            label={t('app.master-data.bom.versionLabel')}
            placeholder={t('app.master-data.bom.versionPlaceholder')}
            colProps={{ span: 6 }}
            rules={[
              { required: true, message: t('app.master-data.bom.versionRequired') },
              { max: 50, message: t('app.master-data.bom.versionMax') },
            ]}
            fieldProps={{
              disabled: isEdit,
              onChange: (e) => {
                if (isEdit) return;
                const newVersion = e.target.value;
                if (newVersion) setTimeout(() => regenerateBOMCode(), 300);
              },
            }}
          />
          <ProFormSelect
            name="approvalStatus"
            label={t('app.master-data.bom.approvalStatusLabel')}
            colProps={{ span: 6 }}
            options={[
              { label: t('app.master-data.bom.statusDraft'), value: 'draft' },
              { label: t('app.master-data.bom.statusPending'), value: 'pending' },
              { label: t('app.master-data.bom.statusApproved'), value: 'approved' },
              { label: t('app.master-data.bom.statusRejected'), value: 'rejected' },
            ]}
          />
          <ProFormDateTimePicker
            name="effectiveDate"
            label={t('app.master-data.bom.effectiveDateLabel')}
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormDateTimePicker
            name="expiryDate"
            label={t('app.master-data.bom.expiryDateLabel')}
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          
          <ProForm.Item
            label={t('app.master-data.bom.childMaterialList')}
            rules={[
              { required: true, message: t('app.master-data.bom.childMaterialListRequired') },
            ]}
            style={{ width: '100%' }}
            className="bom-items-list-form-item"
          >
            <ProForm.Item name="items" noStyle style={{ width: '100%' }}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const tableColumns: ColumnsType<any> = [
                    {
                      title: t('app.master-data.bom.childMaterialTitleCol'),
                      dataIndex: 'componentId',
                      width: 210,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'componentId']}
                          rules={[{ required: true, message: t('app.master-data.bom.childMaterialRequired') }]}
                          style={{ margin: 0 }}
                        >
                          <Select
                            placeholder={t('app.master-data.bom.childMaterialPlaceholder')}
                            showSearch
                            loading={materialsLoading}
                            size="small"
                            filterOption={(input, option) => {
                              const label = option?.label as string || '';
                              return label.toLowerCase().includes(input.toLowerCase());
                            }}
                            options={materials.map(m => ({
                              label: formatMaterialLabel(m),
                              value: m.id,
                            }))}
                            onChange={(val) => handleSubMaterialChange(index, val)}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.quantityLabel'),
                      dataIndex: 'quantity',
                      width: 100,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'quantity']}
                          rules={[
                            { required: true, message: t('app.master-data.bom.quantityRequiredMsg') },
                            { type: 'number', min: 0.0001, message: t('app.master-data.bom.quantityMinMsg') },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder={t('app.master-data.bom.quantityPlaceholderShort')}
                            precision={4}
                            size="small"
                            style={{ width: '100%' }}
                            min={0.0001}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.unitTitle'),
                      dataIndex: 'unit',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'unit']}
                          rules={[{ max: 20, message: t('app.master-data.bom.unitMax') }]}
                          style={{ margin: 0 }}
                        >
                          <UnitDisplayCell unitValueToLabel={unitValueToLabel} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.wasteRateLabel'),
                      dataIndex: 'wasteRate',
                      width: 100,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'wasteRate']}
                          rules={[
                            { type: 'number', min: 0, max: 100, message: t('app.master-data.bom.wasteRateRangeMsg') },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder={t('app.master-data.bom.wasteRatePlaceholderShort')}
                            precision={2}
                            size="small"
                            style={{ width: '100%' }}
                            min={0}
                            max={100}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.isRequiredTitle'),
                      dataIndex: 'isRequired',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'isRequired']}
                          valuePropName="checked"
                          style={{ margin: 0 }}
                        >
                          <Switch size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.alternativeLabel'),
                      dataIndex: 'isAlternative',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'isAlternative']}
                          valuePropName="checked"
                          style={{ margin: 0 }}
                        >
                          <Switch size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.priorityLabel'),
                      dataIndex: 'priority',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'priority']}
                          rules={[
                            { type: 'number', min: 0, message: t('app.master-data.bom.priorityMin') },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder={t('app.master-data.bom.priorityPlaceholder')}
                            precision={0}
                            size="small"
                            style={{ width: '100%' }}
                            min={0}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.descLabel'),
                      dataIndex: 'description',
                      width: 150,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'description']}
                          style={{ margin: 0 }}
                        >
                          <Input.TextArea
                            placeholder={t('app.master-data.bom.descPlaceholder')}
                            rows={1}
                            size="small"
                            maxLength={500}
                            autoSize={{ minRows: 1, maxRows: 2 }}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.master-data.bom.actionLabel'),
                      width: 70,
                      fixed: 'right',
                      render: (_, record, index) => (
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => remove(index)}
                        >
                          {t('app.master-data.bom.delete')}
                        </Button>
                      ),
                    },
                  ];

                  // 计算表格总宽度
                  const totalWidth = tableColumns.reduce((sum, col) => sum + (col.width || 0), 0);

                  return (
                    <div 
                      className="bom-items-table-container"
                      style={{ 
                        width: '100%',
                        overflow: 'hidden',
                        position: 'relative',
                        paddingLeft: '8px',
                        paddingRight: '8px',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div 
                        className="bom-items-table-scroll"
                        style={{ 
                          width: '100%', 
                          overflowX: 'auto',
                          overflowY: 'visible',
                          WebkitOverflowScrolling: 'touch',
                        }}
                      >
                        <Table
                          columns={tableColumns}
                          dataSource={fields.map((field, index) => ({ ...field, key: index }))}
                          rowKey="key"
                          size="small"
                          pagination={false}
                          scroll={{ x: totalWidth }}
                          style={{ 
                            width: totalWidth,
                            margin: 0,
                          }}
                          footer={() => (
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => add({
                                quantity: 1,
                                wasteRate: 0,
                                isRequired: true,
                                isAlternative: false,
                                priority: 0,
                              })}
                              block
                            >
                              {t('app.master-data.bom.addChildMaterial')}
                            </Button>
                          )}
                        />
                      </div>
                    </div>
                  );
                }}
              </AntForm.List>
            </ProForm.Item>
          </ProForm.Item>
          
          <ProFormTextArea
            name="description"
            label={t('app.master-data.bom.descFormLabel')}
            placeholder={t('app.master-data.bom.descFormPlaceholder')}
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 3,
              maxLength: 500,
              showCount: true,
            }}
          />
          
          <ProFormSwitch
            name="isActive"
            label={t('app.master-data.bom.isEnabledLabel')}
          />
      </FormModalTemplate>

      {/* 审核Modal */}
      <Modal
        title={t('app.master-data.bom.approveBomTitle')}
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          setApprovalComment('');
          setApprovalGroupKey(null);
        }}
        footer={[
          <Button
            key="reject"
            danger
            loading={approvalLoading}
            onClick={() => handleApprove(false)}
          >
            {t('app.master-data.bom.reject')}
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approvalLoading}
            onClick={() => handleApprove(true)}
          >
            {t('app.master-data.bom.pass')}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>{t('app.master-data.bom.approvalCommentOptional')}</div>
          <Input.TextArea
            rows={4}
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            placeholder={t('app.master-data.bom.approvalCommentPlaceholder')}
            maxLength={500}
          />
          <div style={{ marginTop: 12 }}>
            <Checkbox
              checked={approvalRecursive}
              onChange={(e) => setApprovalRecursive(e.target.checked)}
            >
              {t('app.master-data.bom.recursiveApprove')}
            </Checkbox>
          </div>
        </div>
      </Modal>


      {/* 创建新版本Modal */}
      <FormModalTemplate
        title={t('app.master-data.bom.createVersionTitle')}
        open={versionModalVisible}
        onClose={() => {
          setVersionModalVisible(false);
          versionFormRef.current?.resetFields();
        }}
        onFinish={handleVersionCreateSubmit}
        isEdit={false}
        loading={versionLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={versionFormRef}
        initialValues={{
          applyStrategy: 'new_only',
        }}
      >
        <ProFormText
          name="version"
          label={t('app.master-data.bom.versionLabel')}
          placeholder={t('app.master-data.bom.versionPlaceholderNew')}
          rules={[
            { required: true, message: t('app.master-data.bom.versionRequired') },
            { max: 50, message: t('app.master-data.bom.versionMax') },
          ]}
        />
        <ProFormTextArea
          name="versionDescription"
          label={t('app.master-data.bom.versionDescLabel')}
          placeholder={t('app.master-data.bom.versionDescPlaceholder')}
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
        <ProFormDateTimePicker
          name="effectiveDate"
          label={t('app.master-data.bom.effectiveDateLabel')}
          placeholder={t('app.master-data.bom.effectiveDatePlaceholder')}
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="applyStrategy"
          label={t('app.master-data.bom.versionStrategyLabel')}
          options={[
            { label: t('app.master-data.bom.versionStrategyNewOnly'), value: 'new_only' },
            { label: t('app.master-data.bom.versionStrategyAll'), value: 'all' },
          ]}
          rules={[
            { required: true, message: t('app.master-data.bom.versionStrategyRequired') },
          ]}
          extra={t('app.master-data.bom.versionStrategyExtra')}
        />
      </FormModalTemplate>

      {/* 版本历史Modal */}
      <Modal
        title={t('app.master-data.bom.versionHistoryTitle')}
        open={versionHistoryModalVisible}
        onCancel={() => {
          setVersionHistoryModalVisible(false);
          setVersionList([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setVersionHistoryModalVisible(false);
            setVersionList([]);
          }}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <div style={{ marginTop: 16 }}>
          {versionList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              暂无版本历史
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {versionList.map((bom, index) => (
                <div
                  key={bom.uuid}
                  style={{
                    padding: '12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    backgroundColor: index === 0 ? '#f0f9ff' : '#fff',
                  }}
                >
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <Tag color={index === 0 ? 'blue' : 'default'}>{bom.version}</Tag>
                      <span style={{ marginLeft: 8 }}>
                        {getMaterialName(bom.materialId)} → {getMaterialName(bom.componentId)}
                      </span>
                      <span style={{ marginLeft: 8, color: '#999' }}>
                        {bom.quantity} {bom.unit || ''}
                      </span>
                    </div>
                    <Space>
                      {index < versionList.length - 1 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<DiffOutlined />}
                          onClick={() => handleCompareVersions(versionList[index + 1].version, bom.version)}
                        >
                          对比
                        </Button>
                      )}
                      <span style={{ color: '#999', fontSize: '12px' }}>
                        {new Date(bom.createdAt).toLocaleString()}
                      </span>
                    </Space>
                  </Space>
                </div>
              ))}
            </Space>
          )}
        </div>
      </Modal>

      {/* 版本对比Modal */}
      <Modal
        title={`BOM版本对比：${selectedVersions?.version1} vs ${selectedVersions?.version2}`}
        open={versionCompareModalVisible}
        onCancel={() => {
          setVersionCompareModalVisible(false);
          setVersionCompareResult(null);
          setSelectedVersions(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setVersionCompareModalVisible(false);
            setVersionCompareResult(null);
            setSelectedVersions(null);
          }}>
            关闭
          </Button>,
        ]}
        width={1200}
      >
        {versionCompareResult && (
          <div style={{ marginTop: 16 }}>
            {/* 新增的子件 */}
            {versionCompareResult.added_items && versionCompareResult.added_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#52c41a', marginBottom: 12 }}>新增子件（{versionCompareResult.added_items.length}项）</h4>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.added_items.map((item: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '4px',
                      }}
                    >
                      <Space>
                        <span>{getMaterialName(item.componentId)}</span>
                        <span style={{ color: '#999' }}>
                          {item.quantity} {item.unit || ''}
                          {item.wasteRate ? ` (损耗率: ${item.wasteRate}%)` : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 删除的子件 */}
            {versionCompareResult.removed_items && versionCompareResult.removed_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#ff4d4f', marginBottom: 12 }}>删除子件（{versionCompareResult.removed_items.length}项）</h4>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.removed_items.map((item: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#fff1f0',
                        border: '1px solid #ffccc7',
                        borderRadius: '4px',
                      }}
                    >
                      <Space>
                        <span>{getMaterialName(item.componentId)}</span>
                        <span style={{ color: '#999' }}>
                          {item.quantity} {item.unit || ''}
                          {item.wasteRate ? ` (损耗率: ${item.wasteRate}%)` : ''}
                        </span>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 修改的子件 */}
            {versionCompareResult.modified_items && versionCompareResult.modified_items.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#1890ff', marginBottom: 12 }}>修改子件（{versionCompareResult.modified_items.length}项）</h4>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {versionCompareResult.modified_items.map((item: any, index: number) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        backgroundColor: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong>{getMaterialName(item.item.componentId)}</strong>
                      </div>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {Object.entries(item.changes || {}).map(([field, change]: [string, any]) => (
                          <div key={field} style={{ paddingLeft: 16 }}>
                            <span style={{ fontWeight: 500 }}>{field === 'quantity' ? '用量' : field === 'unit' ? '单位' : field === 'wasteRate' ? '损耗率' : field === 'isRequired' ? '是否必选' : field}</span>
                            {'：'}
                            <span style={{ textDecoration: 'line-through', color: '#ff4d4f', marginLeft: 8 }}>
                              {field === 'isRequired' ? (change.old ? '是' : '否') : change.old}
                            </span>
                            {' → '}
                            <span style={{ color: '#52c41a', fontWeight: 500 }}>
                              {field === 'isRequired' ? (change.new ? '是' : '否') : change.new}
                            </span>
                          </div>
                        ))}
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>
            )}

            {/* 无差异提示 */}
            {(!versionCompareResult.added_items || versionCompareResult.added_items.length === 0) &&
              (!versionCompareResult.removed_items || versionCompareResult.removed_items.length === 0) &&
              (!versionCompareResult.modified_items || versionCompareResult.modified_items.length === 0) && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                  两个版本之间没有差异
                </div>
              )}
          </div>
        )}
      </Modal>


      {/* 用量计算Modal */}
      <Modal
        title="BOM用量计算"
        open={quantityModalVisible}
        onCancel={() => {
          setQuantityModalVisible(false);
          setQuantityResult(null);
          setParentQuantity(1.0);
          quantityFormRef.current?.resetFields();
        }}
        footer={null}
        width={900}
      >
        <ProForm
          formRef={quantityFormRef}
          layout="vertical"
          submitter={false}
          initialValues={{
            parentQuantity: 1.0,
          }}
        >
          <ProFormDigit
            name="parentQuantity"
            label="父物料数量"
            placeholder="请输入父物料数量"
            rules={[
              { required: true, message: '请输入父物料数量' },
              { type: 'number', min: 0.0001, message: '数量必须大于0' },
            ]}
            fieldProps={{
              precision: 4,
              style: { width: '100%' },
            }}
            extra="输入要生产的父物料数量，系统将自动计算所需子物料数量（考虑损耗率）"
          />
          <ProFormText
            name="version"
            label="BOM版本"
            placeholder="留空则使用最新版本"
            extra="可选，如果不填写则使用最新版本"
          />
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={async () => {
                const values = quantityFormRef.current?.getFieldsValue();
                if (values && currentMaterialId) {
                  await handleQuantityCalculate(currentMaterialId, values.parentQuantity || 1.0, values.version);
                }
              }}
              loading={quantityLoading}
            >
              计算用量
            </Button>
          </div>
        </ProForm>

        {quantityResult && (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
              <Space>
                <span style={{ fontWeight: 500 }}>父物料数量：</span>
                <span>{quantityResult.parentQuantity}</span>
                <span style={{ color: '#999' }}>个</span>
              </Space>
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <h4>子物料用量清单（考虑损耗率）</h4>
            </div>
            
            {quantityResult.components && quantityResult.components.length > 0 ? (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {quantityResult.components
                    .sort((a, b) => a.level - b.level || a.componentCode.localeCompare(b.componentCode))
                    .map((component, index) => {
                      const material = materials.find(m => m.id === component.componentId);
                      const materialName = material ? `${component.componentCode} - ${component.componentName}` : `${component.componentCode} - ${component.componentName}`;
                      
                      return (
                        <div
                          key={index}
                          style={{
                            padding: '12px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            backgroundColor: component.level === 0 ? '#f0f9ff' : '#fff',
                          }}
                        >
                          <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                            <div style={{ flex: 1 }}>
                              <div style={{ marginBottom: 8 }}>
                                <Space>
                                  <span style={{ fontWeight: 500 }}>{materialName}</span>
                                  <Tag color={component.level === 0 ? 'blue' : 'default'}>层级 {component.level}</Tag>
                                </Space>
                              </div>
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <div>
                                  <span style={{ color: '#999' }}>基础用量：</span>
                                  <span style={{ marginLeft: 8 }}>{component.baseQuantity} {component.unit || ''}</span>
                                </div>
                                {component.wasteRate > 0 && (
                                  <div>
                                    <span style={{ color: '#999' }}>损耗率：</span>
                                    <Tag color="orange" style={{ marginLeft: 8 }}>{component.wasteRate}%</Tag>
                                  </div>
                                )}
                                <div>
                                  <span style={{ color: '#999' }}>实际用量：</span>
                                  <span style={{ marginLeft: 8, fontWeight: 500, color: '#52c41a', fontSize: '16px' }}>
                                    {component.actualQuantity.toFixed(4)} {component.unit || ''}
                                  </span>
                                </div>
                                {component.wasteRate > 0 && (
                                  <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
                                    计算公式：{component.baseQuantity} × (1 + {component.wasteRate}%) = {component.actualQuantity.toFixed(4)}
                                  </div>
                                )}
                              </Space>
                            </div>
                          </Space>
                        </div>
                      );
                    })}
                </Space>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无子物料数据
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default BOMPage;

