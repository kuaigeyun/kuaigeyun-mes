/**
 * 工程BOM管理页面
 * 
 * 提供工程BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
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
 * 工程BOM管理列表页面组件
 */
const BOMPage: React.FC = () => {
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
            messageApi.warning(`编码规则 ${ruleCode} 不存在或未启用，请检查编码规则配置`);
          }
        } catch (error: any) {
          // 处理其他错误（网络错误等）
          console.error('自动生成编码失败:', error?.message || error, error);
          messageApi.error(`自动生成编码失败: ${error?.message || error}`);
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
        messageApi.error('未找到该主物料+版本的 BOM 数据');
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
      messageApi.error(error?.message || '获取BOM失败');
    }
  };
  
  /**
   * 处理复制BOM
   */
  const handleCopy = async (record: BOM) => {
    try {
      const newBom = await bomApi.copy(record.uuid);
      messageApi.success('BOM复制成功，已创建新版本');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '复制BOM失败');
    }
  };
  
  /**
   * 处理单条反审核（按组：该 BOM 版本下所有子件行一并反审核，支持可选递归子BOM）
   */
  const handleUnapproveGroup = (record: BOMGroupRow) => {
    const uuids = groupKeyToUuidsRef.current.get(record.groupKey);
    if (!uuids?.length) {
      messageApi.error('无法获取该 BOM 记录');
      return;
    }
    recursiveUnapproveRef.current = false;
    Modal.confirm({
      title: '反审核确认',
      content: (
        <div>
          <p>确定要反审核 {record.bomCode} 版本 {record.version} 吗？</p>
          <p style={{ color: '#ff4d4f' }}>反审核后状态将重置为「草稿」，可再次编辑。</p>
          <div style={{ marginTop: 12 }}>
            <Checkbox onChange={(e) => { recursiveUnapproveRef.current = e.target.checked; }}>
              同时反审核子BOM（递归）
            </Checkbox>
          </div>
        </div>
      ),
      okText: '确定反审核',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await bomApi.batchApprove(uuids, true, '反审核', recursiveUnapproveRef.current, true);
          messageApi.success('反审核成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '反审核失败');
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
      messageApi.error('无法获取该 BOM 记录');
      return;
    }

    try {
      setApprovalLoading(true);
      await bomApi.batchApprove(uuids, approved, approvalComment || undefined, approvalRecursive, false);
      messageApi.success(approved ? 'BOM审核通过' : 'BOM审核已拒绝');
      setApprovalModalVisible(false);
      setApprovalComment('');
      setApprovalGroupKey(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '审核失败');
    } finally {
      setApprovalLoading(false);
    }
  };
  
  /**
   * 获取审核状态标签
   */
  const getApprovalStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      draft: { color: 'default', text: '草稿', icon: <ClockCircleOutlined /> },
      pending: { color: 'processing', text: '待审核', icon: <ClockCircleOutlined /> },
      approved: { color: 'success', text: '已审核', icon: <CheckCircleOutlined /> },
      rejected: { color: 'error', text: '已拒绝', icon: <CloseCircleOutlined /> },
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
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 删除整份BOM（主件下全部子件）
   */
  const handleDeleteGroup = (record: BOMGroupRow) => {
    const uuids = record.items.map((i) => i.uuid);
    if (!uuids.length) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除该 BOM（共 ${uuids.length} 项子件）吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          for (const uuid of uuids) await bomApi.delete(uuid);
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理批量删除BOM（支持分组行：groupKey 解析为该组所有 uuid 并删除）
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
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
      messageApi.warning('没有可删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${count} 条BOM记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
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
              errors.push(error.message || '删除失败');
            }
          }
          if (successCount > 0) messageApi.success(`成功删除 ${successCount} 条记录`);
          if (failCount > 0) messageApi.error(`删除失败 ${failCount} 条${errors.length ? '：' + errors.join('; ') : ''}`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
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
      messageApi.warning('请先选择要审核的记录');
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
      messageApi.warning('没有可审核的记录');
      return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: '批量审核',
      content: (
        <div>
          <p>确定要批量通过选中的 {count} 条BOM记录吗？</p>
          <div style={{ marginTop: 8 }}>
             <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                同时审核子BOM (递归)
             </Checkbox>
          </div>
        </div>
      ),
      okText: '确定通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 直接调用批量审核API
          await bomApi.batchApprove(toProcess, true, '批量审核通过', recursiveApprovalRef.current, false);
          messageApi.success(`已成功审核 ${count} 条记录`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量审核失败');
        }
      },
    });
  };

  /**
   * 处理批量反审核BOM
   */
  const handleBatchUnapprove = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要操作的记录');
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
        messageApi.warning('没有可操作的记录');
        return;
    }

    // 重置默认值
    recursiveApprovalRef.current = false;

    Modal.confirm({
      title: '批量反审核',
      content: (
          <div>
            <p>确定要批量反审核选中的 {count} 条BOM记录吗？</p>
            <p style={{ color: '#ff4d4f' }}>反审核后状态将重置为"草稿"。</p>
            <div style={{ marginTop: 8 }}>
                 <Checkbox onChange={(e) => recursiveApprovalRef.current = e.target.checked}>
                    同时反审核子BOM (递归)
                 </Checkbox>
            </div>
          </div>
      ),
      okText: '确定反审核',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await bomApi.batchApprove(toProcess, true, '批量反审核', recursiveApprovalRef.current, true);
          messageApi.success(`已成功反审核 ${count} 条记录`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量反审核失败');
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
        messageApi.error('未找到BOM数据');
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
              materialName = '物料ID: 未知';
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
      messageApi.error(error.message || '获取BOM详情失败');
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
        messageApi.error('请至少添加一个子物料');
        return;
      }
      if (!values.materialId) {
        messageApi.error('请选择主物料');
        return;
      }

      const buildBatch = () => {
        return {
          material_id: values.materialId,
          items: values.items.map((item: any) => {
            if (!item.componentId) throw new Error('请选择子物料');
            if (!item.quantity || item.quantity <= 0) throw new Error('用量必须大于0');
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
        messageApi.success(`已更新 BOM 结构，共 ${batchData.items.length} 项子件`);
        setEditContext(null);
      } else {
        const batchData = buildBatch();
        await bomApi.create(batchData as any);
        messageApi.success(`成功创建 ${batchData.items.length} 个BOM项`);
      }

      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || (isEdit ? '更新失败' : '创建失败'));
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
        messageApi.error('请至少填写一行数据（表头除外）');
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
        messageApi.error('表头必须包含：父件编码、子件编码、子件数量');
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
        messageApi.error(`数据验证失败：\n${errors.join('\n')}`);
        return;
      }

      // 如果没有有效数据，提示
      if (importItems.length === 0) {
        messageApi.error('没有有效的导入数据');
        return;
      }

      // 调用批量导入API
      const batchImportData: BOMBatchImport = {
        items: importItems,
        version: '1.0', // 默认版本
      };

      await bomApi.batchImport(batchImportData);
      messageApi.success(`成功导入 ${importItems.length} 条BOM数据`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '批量导入失败');
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
      messageApi.error(error.message || '打开版本创建失败');
    }
  };

  /**
   * 设为默认版本
   */
  const handleSetAsDefault = async (record: BOM) => {
    if (record.isDefault) {
      messageApi.info('当前已是默认版本');
      return;
    }
    Modal.confirm({
      title: '设为默认版本',
      content: `确定将 ${record.bomCode} (版本 ${record.version}) 设为该物料的默认 BOM 版本吗？需求计算在「不允许多版本」时将使用此版本。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await bomApi.update(record.uuid, { isDefault: true });
          messageApi.success('已设为默认版本');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '操作失败');
        }
      },
    });
  };

  /**
   * 处理BOM升版 (Revision)
   */
  const handleRevise = async (record: BOM) => {
    Modal.confirm({
      title: 'BOM 升版确认',
      content: `确定要为 ${record.bomCode} (当前版本 ${record.version}) 创建一个新的修订版本吗？系统将自动复制整个 BOM 结构并生成新版本（Draft状态）。`,
      okText: '确定升版',
      cancelText: '取消',
      onOk: async () => {
        try {
          const newBom = await bomApi.revise(record.uuid);
          messageApi.success(`升版成功！新版本: ${newBom.version}`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '升版失败');
        }
      }
    });
  };


  /**
   * 处理版本创建提交
   */
  const handleVersionCreateSubmit = async (values: BOMVersionCreate) => {
    if (!currentMaterialId) {
      messageApi.error('物料ID不存在');
      return;
    }

    try {
      setVersionLoading(true);
      await bomApi.createVersion(currentMaterialId, values);
      messageApi.success('版本创建成功');
      setVersionModalVisible(false);
      versionFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '版本创建失败');
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
      messageApi.error(error.message || '获取版本历史失败');
    }
  };

  /**
   * 处理版本对比
   */
  const handleCompareVersions = async (version1: string, version2: string) => {
    if (!currentMaterialId) {
      messageApi.error('物料ID不存在');
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
      messageApi.error(error.message || '版本对比失败');
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
      messageApi.error(error.message || '打开用量计算失败');
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
      messageApi.error(error.message || '用量计算失败');
    } finally {
      setQuantityLoading(false);
    }
  };

  /**
   * 处理用量计算提交
   */
  const handleQuantityCalculateSubmit = async (values: { parentQuantity: number; version?: string }) => {
    if (!currentMaterialId) {
      messageApi.error('物料ID不存在');
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
      title: '版本', 
      dataIndex: 'version', 
      width: 100, 
      hideInSearch: true, 
      render: (_, r: any) => {
        if ('groupKey' in r) {
          const first = r.firstItem;
          return (
            <Space size={4}>
              <Tag>{r.version}</Tag>
              {first?.isDefault && <Tag color="gold">默认</Tag>}
            </Space>
          );
        }
        return '-';
      }
    },
    {
      title: '审核状态',
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      valueEnum: { draft: { text: '草稿', status: 'Default' }, pending: { text: '待审核', status: 'Processing' }, approved: { text: '已审核', status: 'Success' }, rejected: { text: '已拒绝', status: 'Error' } },
      render: (_, r: any) => {
        if ('groupKey' in r) {
          return getApprovalStatusTag(r.approvalStatus);
        }
        return '-';
      }
    },
    { 
      title: '物料', 
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
      title: '用量', 
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
      title: '单位', 
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
      title: '损耗率', 
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
      title: '操作',
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
            label: '查看',
            children: [
              { key: 'detail', icon: <DiffOutlined />, label: '详情', onClick: () => handleOpenDetail(r) },
              { key: 'calculateQuantity', icon: <CalculatorOutlined />, label: '用量计算', onClick: () => handleCalculateQuantity(r) },
            ],
          },
          {
            type: 'group',
            label: '版本管理',
            children: [
              { key: 'setDefault', icon: <StarOutlined />, label: '设为默认', onClick: () => handleSetAsDefault(r), disabled: r.isDefault },
              { key: 'revise', icon: <BranchesOutlined />, label: '升版', onClick: () => handleRevise(r), disabled: !isApproved },
              { key: 'newVersion', icon: <PlusOutlined />, label: '手工新建版本', onClick: () => handleCreateVersion(r) },
              { key: 'versionHistory', icon: <HistoryOutlined />, label: '版本历史', onClick: () => handleViewVersionHistory(r) },
            ],
          },
          {
            type: 'group',
            label: '其他',
            children: [
              { key: 'copy', icon: <CopyOutlined />, label: '复制', onClick: () => handleCopy(r) },
            ],
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除',
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
              title={isApproved ? '已审核的BOM不可直接编辑，请先升版或反审核' : '编辑'}
            >
              编辑
            </Button>
            <Button type="link" size="small" icon={<ApartmentOutlined />} onClick={goDesigner} title="图形化设计BOM结构">
              设计
            </Button>
            {r.approvalStatus !== 'approved' ? (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleOpenApproval(record)}
                title="审核通过"
              >
                审核
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                icon={<UndoOutlined />}
                onClick={() => handleUnapproveGroup(record)}
                title="反审核，重置为草稿"
              >
                反审核
              </Button>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<EllipsisOutlined />}>
                更多
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
      title: 'BOM编码',
      dataIndex: 'bomCode',
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      render: (_, record) => (
        <Space size={4}>
          <Tag>{record.version}</Tag>
          {record.isDefault && <Tag color="gold">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '审核状态',
      dataIndex: 'approvalStatus',
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: '主物料',
      dataIndex: 'materialId',
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: '子物料',
      dataIndex: 'componentId',
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: '用量',
      dataIndex: 'quantity',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      render: (_, record) => record.unit || '-',
    },
    {
      title: '损耗率',
      dataIndex: 'wasteRate',
      render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
    },
    {
      title: '是否必选',
      dataIndex: 'isRequired',
      render: (_, record) => (
        <Tag color={record.isRequired !== false ? 'success' : 'default'}>
          {record.isRequired !== false ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '层级',
      dataIndex: 'level',
      render: (_, record) => record.level ?? 0,
    },
    {
      title: '层级路径',
      dataIndex: 'path',
      render: (_, record) => record.path || '-',
    },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      valueType: 'dateTime',
      render: (_, record) => record.effectiveDate || '-',
    },
    {
      title: '失效日期',
      dataIndex: 'expiryDate',
      valueType: 'dateTime',
      render: (_, record) => record.expiryDate || '-',
    },
    {
      title: '替代料',
      dataIndex: 'isAlternative',
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
    },
    {
      title: '描述',
      dataIndex: 'description',
      span: 2,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      span: 2,
    },
    {
      title: '审核人',
      dataIndex: 'approvedBy',
      render: (_, record) => record.approvedBy ? `用户ID: ${record.approvedBy}` : '-',
    },
    {
      title: '审核时间',
      dataIndex: 'approvedAt',
      valueType: 'dateTime',
      render: (_, record) => record.approvedAt || '-',
    },
    {
      title: '审核意见',
      dataIndex: 'approvalComment',
      span: 2,
      render: (_, record) => record.approvalComment || '-',
    },
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
            messageApi.error(error?.message || '获取BOM列表失败');
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
                label: '基本信息',
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
                        <h4 style={{ marginBottom: 16, fontWeight: 500 }}>子物料列表（{bomItems.length}项）</h4>
                        <Table<BOM>
                          dataSource={bomItems}
                          rowKey="uuid"
                          pagination={false}
                          size="small"
                          columns={[
                            {
                              title: '序号',
                              key: 'index',
                              width: 60,
                              render: (_, __, index) => index + 1,
                            },
                            {
                              title: '子物料',
                              dataIndex: 'componentId',
                              render: (_, record) => getMaterialName(record.componentId),
                            },
                            {
                              title: '用量',
                              dataIndex: 'quantity',
                              width: 100,
                              align: 'right',
                            },
                            {
                              title: '单位',
                              dataIndex: 'unit',
                              width: 80,
                              render: (_, record) => {
                                const unitValue = record.unit;
                                const unitLabel = unitValueToLabel[unitValue || ''] || unitValue || '-';
                                return unitLabel;
                              },
                            },
                            {
                              title: '损耗率',
                              dataIndex: 'wasteRate',
                              width: 100,
                              align: 'right',
                              render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
                            },
                            {
                              title: '是否必选',
                              dataIndex: 'isRequired',
                              width: 100,
                              render: (_, record) => (
                                <Tag color={record.isRequired !== false ? 'success' : 'default'}>
                                  {record.isRequired !== false ? '是' : '否'}
                                </Tag>
                              ),
                            },
                            {
                              title: '层级',
                              dataIndex: 'level',
                              width: 80,
                              render: (_, record) => record.level ?? 0,
                            },
                            {
                              title: '描述',
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
                label: '层级结构',
                children: (
                  <div style={{ paddingTop: 16 }}>
                    <Spin spinning={hierarchyLoading}>
                      {hierarchyTreeData.length === 0 && !hierarchyLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                          暂无层级结构数据
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
        title={isEdit ? '编辑BOM' : '新建BOM（支持批量添加子物料）'}
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
                  label="BOM编码"
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
            label="主物料"
            placeholder="请选择主物料"
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: formatMaterialLabel(m),
              value: m.id,
            }))}
            rules={[
              { required: true, message: '请选择主物料' },
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
            label="版本号"
            placeholder="请输入版本号"
            colProps={{ span: 6 }}
            rules={[
              { required: true, message: '请输入版本号' },
              { max: 50, message: '版本号不能超过50个字符' },
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
            label="审核状态"
            colProps={{ span: 6 }}
            options={[
              { label: '草稿', value: 'draft' },
              { label: '待审核', value: 'pending' },
              { label: '已审核', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
            ]}
          />
          <ProFormDateTimePicker
            name="effectiveDate"
            label="生效日期"
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          <ProFormDateTimePicker
            name="expiryDate"
            label="失效日期"
            colProps={{ span: 6 }}
            fieldProps={{
              style: { width: '100%' },
            }}
          />
          
          <ProForm.Item
            label="子物料列表"
            rules={[
              { required: true, message: '请至少添加一个子物料' },
            ]}
            style={{ width: '100%' }}
            className="bom-items-list-form-item"
          >
            <ProForm.Item name="items" noStyle style={{ width: '100%' }}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const tableColumns: ColumnsType<any> = [
                    {
                      title: '子物料',
                      dataIndex: 'componentId',
                      width: 210,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'componentId']}
                          rules={[{ required: true, message: '请选择子物料' }]}
                          style={{ margin: 0 }}
                        >
                          <Select
                            placeholder="请选择子物料"
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
                      title: '用量',
                      dataIndex: 'quantity',
                      width: 100,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'quantity']}
                          rules={[
                            { required: true, message: '请输入用量' },
                            { type: 'number', min: 0.0001, message: '用量必须大于0' },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder="用量"
                            precision={4}
                            size="small"
                            style={{ width: '100%' }}
                            min={0.0001}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '单位',
                      dataIndex: 'unit',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'unit']}
                          rules={[{ max: 20, message: '单位不能超过20个字符' }]}
                          style={{ margin: 0 }}
                        >
                          <UnitDisplayCell unitValueToLabel={unitValueToLabel} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '损耗率（%）',
                      dataIndex: 'wasteRate',
                      width: 100,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'wasteRate']}
                          rules={[
                            { type: 'number', min: 0, max: 100, message: '损耗率必须在0-100之间' },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder="损耗率"
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
                      title: '是否必选',
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
                      title: '替代料',
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
                      title: '优先级',
                      dataIndex: 'priority',
                      width: 80,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'priority']}
                          rules={[
                            { type: 'number', min: 0, message: '优先级必须大于等于0' },
                          ]}
                          style={{ margin: 0 }}
                        >
                          <InputNumber
                            placeholder="优先级"
                            precision={0}
                            size="small"
                            style={{ width: '100%' }}
                            min={0}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '描述',
                      dataIndex: 'description',
                      width: 150,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'description']}
                          style={{ margin: 0 }}
                        >
                          <Input.TextArea
                            placeholder="描述（可选）"
                            rows={1}
                            size="small"
                            maxLength={500}
                            autoSize={{ minRows: 1, maxRows: 2 }}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
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
                          删除
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
                              添加子物料
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
            label="描述"
            placeholder="请输入描述（可选）"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 3,
              maxLength: 500,
              showCount: true,
            }}
          />
          
          <ProFormSwitch
            name="isActive"
            label="是否启用"
          />
      </FormModalTemplate>

      {/* 审核Modal */}
      <Modal
        title="审核BOM"
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
            拒绝
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approvalLoading}
            onClick={() => handleApprove(true)}
          >
            通过
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>审核意见（可选）：</div>
          <Input.TextArea
            rows={4}
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            placeholder="请输入审核意见"
            maxLength={500}
          />
          <div style={{ marginTop: 12 }}>
            <Checkbox
              checked={approvalRecursive}
              onChange={(e) => setApprovalRecursive(e.target.checked)}
            >
              同时审核子BOM（递归）
            </Checkbox>
          </div>
        </div>
      </Modal>


      {/* 创建新版本Modal */}
      <FormModalTemplate
        title="创建BOM新版本"
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
          label="版本号"
          placeholder="请输入版本号（如：v1.1）"
          rules={[
            { required: true, message: '请输入版本号' },
            { max: 50, message: '版本号不能超过50个字符' },
          ]}
        />
        <ProFormTextArea
          name="versionDescription"
          label="版本说明"
          placeholder="请输入版本说明（可选）"
          fieldProps={{
            rows: 3,
            maxLength: 500,
          }}
        />
        <ProFormDateTimePicker
          name="effectiveDate"
          label="生效日期"
          placeholder="请选择生效日期（可选）"
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="applyStrategy"
          label="版本应用策略"
          options={[
            { label: '仅新工单使用新版本（推荐）', value: 'new_only' },
            { label: '所有工单使用新版本（谨慎使用）', value: 'all' },
          ]}
          rules={[
            { required: true, message: '请选择版本应用策略' },
          ]}
          extra="建议选择'仅新工单使用新版本'，避免影响正在执行的工单"
        />
      </FormModalTemplate>

      {/* 版本历史Modal */}
      <Modal
        title="BOM版本历史"
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

