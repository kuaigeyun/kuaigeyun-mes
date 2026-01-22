/**
 * BOM（物料清单）管理页面
 * 
 * 提供BOM的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormDigit, ProFormInstance, ProDescriptionsItemType, ProFormList, ProFormDateTimePicker, ProFormSelect, ProForm } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Input, Tree, Spin, Table, Form as AntForm, Select, Switch, InputNumber } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined, CopyOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, BranchesOutlined, DiffOutlined, HistoryOutlined, CalculatorOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, BOMCreate, BOMUpdate, Material, BOMBatchCreate, BOMItemCreate, BOMBatchImport, BOMBatchImportItem, BOMVersionCreate, BOMVersionCompare, BOMVersionCompareResult, BOMHierarchy, BOMHierarchyItem, BOMQuantityResult, BOMQuantityComponent } from '../../../types/material';

/**
 * BOM管理列表页面组件
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
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑BOM）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 审核Modal状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalBomUuid, setApprovalBomUuid] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState<string>('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  
  // 批量导入加载状态
  const [batchImportLoading, setBatchImportLoading] = useState(false);
  
  // 版本管理Modal状态
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [versionHistoryModalVisible, setVersionHistoryModalVisible] = useState(false);
  const [currentMaterialId, setCurrentMaterialId] = useState<number | null>(null);
  const versionFormRef = useRef<ProFormInstance>();
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionList, setVersionList] = useState<BOM[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<{ version1: string; version2: string } | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<any>(null);
  
  // 层级结构Modal状态
  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
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
   * 处理新建BOM
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentBOMUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
      isAlternative: false,
      priority: 0,
    });
  };

  /**
   * 处理打开图形化BOM设计器（新建）
   */
  const handleOpenDesigner = () => {
    // 跳转到BOM设计器页面（新建模式，不传materialId）
    navigate('/apps/master-data/materials/bom/designer');
  };

  /**
   * 处理编辑BOM
   */
  const handleEdit = async (record: BOM) => {
    try {
      setIsEdit(true);
      setCurrentBOMUuid(record.uuid);
      setModalVisible(true);
      
      // 获取BOM详情
      const detail = await bomApi.get(record.uuid);
      // 编辑时使用单个BOM项格式
      formRef.current?.setFieldsValue({
        materialId: detail.materialId,
        version: detail.version,
        bomCode: detail.bomCode,
        effectiveDate: detail.effectiveDate,
        expiryDate: detail.expiryDate,
        approvalStatus: detail.approvalStatus,
        items: [{
          componentId: detail.componentId,
          quantity: detail.quantity,
          unit: detail.unit,
          wasteRate: detail.wasteRate ?? 0,
          isRequired: detail.isRequired !== false,
          isAlternative: detail.isAlternative,
          alternativeGroupId: detail.alternativeGroupId,
          priority: detail.priority,
          description: detail.description,
          remark: detail.remark,
        }],
        description: detail.description,
        remark: detail.remark,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
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
   * 处理打开审核Modal
   */
  const handleOpenApproval = (record: BOM) => {
    setApprovalBomUuid(record.uuid);
    setApprovalComment('');
    setApprovalModalVisible(true);
  };
  
  /**
   * 处理审核BOM
   */
  const handleApprove = async (approved: boolean) => {
    if (!approvalBomUuid) return;
    
    try {
      setApprovalLoading(true);
      await bomApi.approve(approvalBomUuid, approved, approvalComment || undefined);
      messageApi.success(approved ? 'BOM审核通过' : 'BOM审核已拒绝');
      setApprovalModalVisible(false);
      setApprovalComment('');
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
   * 处理删除BOM
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
   * 处理批量删除BOM
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
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
              await bomApi.delete(key.toString());
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
  const handleOpenDetail = async (record: BOM) => {
    try {
      setCurrentBOMUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await bomApi.get(record.uuid);
      setBomDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取BOM详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentBOMUuid(null);
    setBomDetail(null);
  };

  /**
   * 处理提交表单（创建/更新BOM）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentBOMUuid) {
        // 更新BOM（单个）- 从items中取第一个
        if (!values.items || values.items.length === 0) {
          messageApi.error('请至少添加一个子物料');
          return;
        }
        
        const firstItem = values.items[0];
        const updateData: BOMUpdate = {
          materialId: values.materialId,
          componentId: firstItem.componentId,
          quantity: firstItem.quantity,
          unit: firstItem.unit,
          wasteRate: firstItem.wasteRate ?? 0,
          isRequired: firstItem.isRequired !== false,
          version: values.version,
          bomCode: values.bomCode,
          effectiveDate: values.effectiveDate,
          expiryDate: values.expiryDate,
          approvalStatus: values.approvalStatus,
          isAlternative: firstItem.isAlternative,
          alternativeGroupId: firstItem.alternativeGroupId,
          priority: firstItem.priority,
          description: values.description || firstItem.description,
          remark: values.remark || firstItem.remark,
          isActive: values.isActive,
        };
        
        await bomApi.update(currentBOMUuid, updateData);
        messageApi.success('更新成功');
      } else {
        // 批量创建BOM
        if (!values.materialId) {
          messageApi.error('请选择主物料');
          return;
        }
        
        if (!values.items || values.items.length === 0) {
          messageApi.error('请至少添加一个子物料');
          return;
        }
        
        // 转换为后端期望的snake_case格式
        const batchData = {
          material_id: values.materialId,
          items: values.items.map((item: any) => {
            // 验证必填字段
            if (!item.componentId) {
              throw new Error('请选择子物料');
            }
            if (!item.quantity || item.quantity <= 0) {
              throw new Error('用量必须大于0');
            }
            
            // 处理unit字段：确保字段总是存在，如果为空则传null（后端Optional字段）
            // 注意：必须显式包含unit字段，即使值为null，否则Pydantic可能认为它是必填的
            const unitValue = (item.unit && item.unit.trim()) ? item.unit.trim() : null;
            
            return {
              component_id: item.componentId,
              quantity: item.quantity,
              unit: unitValue, // 显式包含unit字段，值为null或trim后的字符串
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
        
        await bomApi.create(batchData as any);
        messageApi.success(`成功创建 ${batchData.items.length} 个BOM项`);
      }
      
      setModalVisible(false);
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
    formRef.current?.resetFields();
  };

  /**
   * 获取物料名称
   */
  const getMaterialName = (materialId: number): string => {
    const material = materials.find(m => m.id === materialId);
    return material ? `${material.code} - ${material.name}` : `物料ID: ${materialId}`;
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
   * 处理查看层级结构
   */
  const handleViewHierarchy = async (record: BOM) => {
    try {
      setHierarchyLoading(true);
      setHierarchyModalVisible(true);
      setCurrentMaterialId(record.materialId);
      
      // 获取层级结构数据
      const hierarchy = await bomApi.getHierarchy(record.materialId, record.version);
      setHierarchyData(hierarchy);
      
      // 转换为Tree组件需要的格式
      const convertToTreeData = (items: BOMHierarchyItem[], parentPath: string = ''): DataNode[] => {
        return items.map((item, index) => {
          const currentPath = parentPath ? `${parentPath}/${index}` : `${index}`;
          const material = materials.find(m => m.id === item.componentId);
          const materialName = material ? `${material.code} - ${material.name}` : `物料ID: ${item.componentId}`;
          
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
    } catch (error: any) {
      messageApi.error(error.message || '获取层级结构失败');
      setHierarchyModalVisible(false);
    } finally {
      setHierarchyLoading(false);
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
   * 表格列定义
   */
  const columns: ProColumns<BOM>[] = [
    {
      title: 'BOM编码',
      dataIndex: 'bomCode',
      width: 150,
      hideInSearch: true,
      render: (_, record) => record.bomCode || '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      hideInSearch: true,
      render: (_, record) => <Tag>{record.version}</Tag>,
    },
    {
      title: '审核状态',
      dataIndex: 'approvalStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        draft: { text: '草稿', status: 'Default' },
        pending: { text: '待审核', status: 'Processing' },
        approved: { text: '已审核', status: 'Success' },
        rejected: { text: '已拒绝', status: 'Error' },
      },
      render: (_, record) => getApprovalStatusTag(record.approvalStatus),
    },
    {
      title: '主物料',
      dataIndex: 'materialId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.materialId),
    },
    {
      title: '子物料',
      dataIndex: 'componentId',
      width: 200,
      hideInSearch: true,
      render: (_, record) => getMaterialName(record.componentId),
    },
    {
      title: '用量',
      dataIndex: 'quantity',
      width: 100,
      hideInSearch: true,
      render: (_, record) => `${record.quantity} ${record.unit || ''}`,
    },
    {
      title: '单位',
      dataIndex: 'unit',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '损耗率',
      dataIndex: 'wasteRate',
      width: 100,
      hideInSearch: true,
      render: (_, record) => record.wasteRate ? `${record.wasteRate}%` : '0%',
    },
    {
      title: '是否必选',
      dataIndex: 'isRequired',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
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
      hideInSearch: true,
      sorter: true,
      render: (_, record) => record.level ?? 0,
    },
    {
      title: '替代料',
      dataIndex: 'isAlternative',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Warning' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isAlternative ? 'orange' : 'default'}>
          {record.isAlternative ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
      width: 250,
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
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record)}
          >
            复制
          </Button>
          {record.approvalStatus !== 'approved' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleOpenApproval(record)}
            >
              审核
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<BranchesOutlined />}
            onClick={() => handleCreateVersion(record)}
          >
            新版本
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewVersionHistory(record)}
          >
            版本历史
          </Button>
          <Button
            type="link"
            size="small"
            icon={<BranchesOutlined />}
            onClick={() => handleViewHierarchy(record)}
          >
            层级结构
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => {
              // 跳转到图形化设计器，编辑指定物料的BOM
              const params = new URLSearchParams();
              params.set('materialId', record.materialId.toString());
              if (record.version) {
                params.set('version', record.version);
              }
              navigate(`/apps/master-data/materials/bom/designer?${params.toString()}`);
            }}
          >
            图形化设计
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CalculatorOutlined />}
            onClick={() => handleCalculateQuantity(record)}
          >
            用量计算
          </Button>
          <Popconfirm
            title="确定要删除这个BOM项吗？"
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
      render: (_, record) => <Tag>{record.version}</Tag>,
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
        <UniTable<BOM>
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
            return {
              data: result,
              success: true,
              total: result.length,
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
        rowKey="uuid"
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
              icon={<ApartmentOutlined />}
              onClick={handleOpenDesigner}
            >
              图形化设计
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
        width={DRAWER_CONFIG.STANDARD_WIDTH}
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
        initialValues={{
          isActive: true,
          version: '1.0',
          approvalStatus: 'draft',
          items: [{ isAlternative: false, priority: 0 }],
        }}
      >
          <SafeProFormSelect
            name="materialId"
            label="主物料"
            placeholder="请选择主物料"
            colProps={{ span: 12 }}
            options={materials.map(m => ({
              label: `${m.code} - ${m.name}`,
              value: m.id,
            }))}
            rules={[
              { required: true, message: '请选择主物料' },
            ]}
            fieldProps={{
              loading: materialsLoading,
              showSearch: true,
              filterOption: (input, option) => {
                const label = option?.label as string || '';
                return label.toLowerCase().includes(input.toLowerCase());
              },
            }}
          />
          <ProFormText
            name="bomCode"
            label="BOM编码"
            placeholder="留空则自动生成"
            colProps={{ span: 12 }}
            fieldProps={{
              maxLength: 100,
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
            initialValue="1.0"
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
            initialValue="draft"
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
          <ProFormTextArea
            name="description"
            label="BOM描述"
            placeholder="请输入BOM描述（可选）"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 2,
              maxLength: 500,
            }}
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注（可选）"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 2,
              maxLength: 500,
            }}
          />
          
          <ProForm.Item
            label="子物料列表"
            rules={[
              { required: true, message: '请至少添加一个子物料' },
            ]}
            style={{ width: '100%' }}
          >
            <ProForm.Item name="items" noStyle style={{ width: '100%' }}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const tableColumns: ColumnsType<any> = [
                    {
                      title: '子物料',
                      dataIndex: 'componentId',
                      width: 180,
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
                              label: `${m.code || m.mainCode} - ${m.name}`,
                              value: m.id,
                            }))}
                            onChange={(value) => {
                              // 当选择物料时，自动填充该物料的基础单位
                              const selectedMaterial = materials.find(m => m.id === value);
                              if (selectedMaterial && selectedMaterial.baseUnit) {
                                // 使用formRef来设置字段值
                                formRef.current?.setFieldValue(['items', index, 'unit'], selectedMaterial.baseUnit);
                              }
                            }}
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
                          noStyle
                          dependencies={[[index, 'componentId']]}
                        >
                          {({ getFieldValue }) => {
                            const componentId = getFieldValue(['items', index, 'componentId']);
                            const selectedMaterial = materials.find(m => m.id === componentId);
                            const baseUnit = selectedMaterial?.baseUnit || '';
                            const currentUnit = getFieldValue(['items', index, 'unit']);
                            
                            // 如果componentId变化了且unit字段为空或与baseUnit不同，自动更新
                            if (componentId && baseUnit && currentUnit !== baseUnit) {
                              // 使用setTimeout避免在render中直接调用setFieldValue
                              setTimeout(() => {
                                formRef.current?.setFieldValue(['items', index, 'unit'], baseUnit);
                              }, 0);
                            }
                            
                            return (
                              <AntForm.Item
                                name={[index, 'unit']}
                                rules={[{ max: 20, message: '单位不能超过20个字符' }]}
                                style={{ margin: 0 }}
                              >
                                <Input
                                  placeholder={baseUnit || "单位（自动填充）"}
                                  size="small"
                                  maxLength={20}
                                  readOnly
                                  style={{ 
                                    backgroundColor: '#f5f5f5',
                                    cursor: 'not-allowed',
                                  }}
                                />
                              </AntForm.Item>
                            );
                          }}
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
                          initialValue={0}
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
                          initialValue={true}
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
                          initialValue={false}
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
                          initialValue={0}
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
                      width: 120,
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
                      title: '备注',
                      dataIndex: 'remark',
                      width: 120,
                      render: (_, record, index) => (
                        <AntForm.Item
                          name={[index, 'remark']}
                          style={{ margin: 0 }}
                        >
                          <Input.TextArea
                            placeholder="备注（可选）"
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

      {/* 层级结构展示Modal */}
      <Modal
        title={`BOM层级结构${hierarchyData ? ` - ${hierarchyData.materialCode || hierarchyData.materialName || ''} (版本: ${hierarchyData.version || ''})` : ''}`}
        open={hierarchyModalVisible}
        onCancel={() => {
          setHierarchyModalVisible(false);
          setHierarchyData(null);
          setHierarchyTreeData([]);
          setExpandedKeys([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setHierarchyModalVisible(false);
            setHierarchyData(null);
            setHierarchyTreeData([]);
            setExpandedKeys([]);
          }}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <Spin spinning={hierarchyLoading}>
          {hierarchyTreeData.length === 0 && !hierarchyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无层级结构数据
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              {hierarchyData && (
                <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #91d5ff' }}>
                  <Space>
                    <span style={{ fontWeight: 500 }}>主物料：</span>
                    <span>{hierarchyData.materialCode || ''} - {hierarchyData.materialName || ''}</span>
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

