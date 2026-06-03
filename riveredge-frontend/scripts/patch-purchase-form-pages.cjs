/**
 * Patch purchase-orders and purchase-requisitions for /new and /:id/edit form pages.
 */
const fs = require('fs');

function patchPurchaseOrders() {
  const path = 'f:/dev/riveredge/riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/purchase-orders/index.tsx';
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (text.includes('PURCHASE_ORDER_CREATE_PATH')) {
    console.log('purchase-orders already patched');
    return;
  }

  text = text.replace(
    "import { useNavigate } from 'react-router-dom';",
    "import { useNavigate, useLocation } from 'react-router-dom';",
  );
  text = text.replace(
    "import { App, Button, Tag, Space, Modal, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, Switch, List, Typography, theme, Dropdown, Descriptions, Spin } from 'antd';",
    "import { App, Button, Tag, Space, Modal, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, Switch, List, Typography, theme, Dropdown, Descriptions, Spin, Card } from 'antd';",
  );
  text = text.replace(
    "import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined, DownOutlined, FileTextOutlined, InboxOutlined, DollarOutlined, RollbackOutlined, AppstoreAddOutlined } from '@ant-design/icons';",
    "import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined, DownOutlined, FileTextOutlined, InboxOutlined, DollarOutlined, RollbackOutlined, AppstoreAddOutlined, ArrowLeftOutlined } from '@ant-design/icons';",
  );
  text = text.replace(
    "import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DetailDrawerActions, MODAL_CONFIG, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates';",
    `import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerInlineFullChain,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  PAGE_SPACING,
  uniTabsChildPageVerticalInsetStyle,
  type StatCard,
} from '../../../../../components/layout-templates';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';`,
  );

  text = text.replace(
    'const PurchaseOrdersPage: React.FC = () => {',
    `const PURCHASE_ORDER_LIST_PATH = '/apps/kuaizhizao/purchase-management/purchase-orders';
const PURCHASE_ORDER_CREATE_PATH = \`\${PURCHASE_ORDER_LIST_PATH}/new\`;
const purchaseOrderEditPath = (id: number) => \`\${PURCHASE_ORDER_LIST_PATH}/\${id}/edit\`;

const PurchaseOrdersPage: React.FC = () => {`,
  );

  text = text.replace(
    '  const navigate = useNavigate();',
    `  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname.endsWith('/purchase-orders/new');
  const editRouteMatch = location.pathname.match(/\\/purchase-orders\\/(\\d+)\\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);`,
  );

  // Replace handleEdit body with navigate
  text = text.replace(
    /  \/\/ 处理编辑\n  const handleEdit = async \(record: PurchaseOrder\) => \{[\s\S]*?  \};\n\n  \/\*\* 参考销售订单/,
    `  async function initPurchaseOrderEditForm(orderId: number) {
    try {
      const detail = await getPurchaseOrder(orderId);
      setIsEdit(true);
      setCurrentOrder(detail);
      const items = (detail.items || []).map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_spec: it.material_spec || '',
        unit: it.unit || '件',
        ordered_quantity: Number(it.ordered_quantity ?? it.orderedQuantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
        tax_rate: 0,
        required_date: it.required_date || it.requiredDate ? dayjs(it.required_date || it.requiredDate) : undefined,
      }));
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          order_code: detail.order_code,
          supplier_id: detail.supplier_id,
          supplier_name: detail.supplier_name,
          supplier_contact: detail.supplier_contact,
          supplier_phone: detail.supplier_phone,
          order_date: detail.order_date,
          delivery_date: detail.delivery_date,
          order_type: detail.order_type || '标准采购',
          price_type: 'tax_exclusive',
          buyer_id: detail.buyer_id,
          buyer_name: detail.buyer_name,
          notes: detail.notes,
          attachments: (detail as any).attachments || [],
          fee_details: (detail as any).fee_details || [],
          items: items.length > 0 ? items : [defaultOrderItem],
        });
      }, 100);
    } catch {
      messageApi.error('获取采购订单详情失败');
      navigate(PURCHASE_ORDER_LIST_PATH);
    }
  }

  function initPurchaseOrderCreateForm() {
    setIsEdit(false);
    setCurrentOrder(null);
    formRef.current?.resetFields();
    window.setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultOrderItem], price_type: 'tax_exclusive' });
    }, 0);
  }

  const handleEdit = (record: PurchaseOrder) => {
    if (!record.id) return;
    navigate(purchaseOrderEditPath(record.id));
  };

  /** 参考销售订单`,
  );

  text = text.replace(
    `  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrder(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultOrderItem], price_type: 'tax_exclusive' });
    }, 0);
  };`,
    `  const handleCreate = () => {
    navigate(PURCHASE_ORDER_CREATE_PATH);
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.purchase-management.purchase-orders.new'
      : 'app.kuaizhizao.menu.purchase-management.purchase-orders.edit';
    const title = t(titleKey);
    const sp = new URLSearchParams(location.search || '');
    sp.delete('_refresh');
    const cleanSearch = sp.toString();
    const tabKey = location.pathname + (cleanSearch ? \`?\${cleanSearch}\` : '');
    setCustomPageTitle(location.pathname, title);
    setCustomPageTitle(tabKey, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    );
    return () => {
      removeCustomPageTitle(location.pathname);
      removeCustomPageTitle(tabKey);
    };
  }, [isFormPage, isCreatePage, location.pathname, location.search, t]);

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return;
    formPageInitializedRef.current = true;
    if (isCreatePage) {
      initPurchaseOrderCreateForm();
    } else if (editRouteId) {
      void initPurchaseOrderEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId]);`,
  );

  text = text.replace(
    `      setModalVisible(false);
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();`,
    `      if (isFormPage) {
        navigate(PURCHASE_ORDER_LIST_PATH);
      } else {
        setModalVisible(false);
      }
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();`,
  );

  const modalAnchor = '      {/* 创建/编辑采购订单 Modal */}\n      <FormModalTemplate';
  const modalIdx = text.indexOf(modalAnchor);
  if (modalIdx === -1) throw new Error('PO modal not found');
  const contentStart = text.indexOf('>\n', modalIdx) + 2;
  const pickerInside = '        <UniMaterialBatchPicker\n';
  const contentEnd = text.indexOf(pickerInside, contentStart);
  const formInner = text.slice(contentStart, contentEnd);
  const modalEnd = text.indexOf('      </FormModalTemplate>', contentEnd) + '      </FormModalTemplate>'.length;

  const returnAnchor = '\n\n  return (\n    <>\n      <ListPageTemplate statCards={statCards}>';
  const returnIdx = text.indexOf(returnAnchor);
  if (returnIdx === -1) throw new Error('PO return anchor not found');

  const formPageBlock = `\n\n  const triggerPurchaseOrderFormSubmit = () => formRef.current?.submit?.();

  useSubmitShortcut(() => triggerPurchaseOrderFormSubmit(), isFormPage);

  const purchaseOrderFormItemContent = (
    <>${formInner}    </>
  );

  const purchaseOrderFormAuxModals = (
    <>
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendPurchaseItemsFromMaterials}
        />
      <SupplierFormModal
        open={supplierCreateVisible}
        onClose={() => setSupplierCreateVisible(false)}
        editUuid={null}
        onSuccess={(supplier) => {
          setSupplierList((prev) => [...prev, supplier]);
          formRef.current?.setFieldsValue({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_contact: supplier.contactPerson,
            supplier_phone: supplier.phone,
          });
          setSupplierCreateVisible(false);
        }}
      />
    </>
  );

  if (isFormPage) {
    const canSubmitAfterSave =
      isCreatePage || (isEditPage && isDraftStatus(currentOrder?.status));
    return (
      <>
        <div style={uniTabsChildPageVerticalInsetStyle()}>
          <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
            <Space align="center" size={8}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={() => navigate(PURCHASE_ORDER_LIST_PATH)}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.purchase-management.purchase-orders.new')
                  : t('app.kuaizhizao.menu.purchase-management.purchase-orders.edit')}
              </Typography.Title>
            </Space>
            <Space wrap>
              <Button onClick={() => navigate(PURCHASE_ORDER_LIST_PATH)}>{t('common.cancel')}</Button>
              <Button onClick={triggerPurchaseOrderFormSubmit}>
                {isCreatePage ? t('app.kuaizhizao.purchaseOrder.saveDraft', '保存') : t('common.save')}
              </Button>
              {canSubmitAfterSave ? (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={async () => {
                    try {
                      await formRef.current?.validateFields();
                      submitAfterSaveRef.current = true;
                      formRef.current?.submit();
                    } catch (err) {
                      if ((err as any)?.errorFields?.length) {
                        messageApi.warning('请完善必填项后再提交');
                      }
                    }
                  }}
                >
                  {isCreatePage ? '创建并提交' : '保存并提交'}
                  {SUBMIT_SHORTCUT_HINT}
                </Button>
              ) : (
                <Button type="primary" onClick={triggerPurchaseOrderFormSubmit}>
                  {t('common.save')}
                  {SUBMIT_SHORTCUT_HINT}
                </Button>
              )}
            </Space>
          </div>
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleFormSubmit}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const errText = first?.errors?.filter(Boolean)[0];
                  messageApi.error(errText || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [defaultOrderItem], price_type: 'tax_exclusive' } : undefined}
              >
                {purchaseOrderFormItemContent}
              </ProForm>
            </div>
          </Card>
        </div>
        {purchaseOrderFormAuxModals}
      </>
    );
  }

  return (
    <>
      <ListPageTemplate statCards={statCards}>`;

  text = text.slice(0, returnIdx) + formPageBlock + text.slice(returnIdx + returnAnchor.length);

  // Remove FormModalTemplate and duplicate SupplierFormModal
  const modalIdx2 = text.indexOf('      {/* 创建/编辑采购订单 Modal */}');
  const supplierAfterModal = text.indexOf('      <SupplierFormModal\n', modalIdx2);
  const supplierEnd = text.indexOf('      />\n\n      <LandingCostAllocationModal', supplierAfterModal) + '      />'.length;
  text = text.slice(0, modalIdx2) + '      {purchaseOrderFormAuxModals}\n\n' + text.slice(supplierEnd);

  fs.writeFileSync(path, text);
  console.log('purchase-orders patched');
}

function patchPurchaseRequisitions() {
  const path = 'f:/dev/riveredge/riveredge-frontend/src/apps/kuaizhizao/pages/purchase-management/purchase-requisitions/index.tsx';
  let text = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  if (text.includes('PURCHASE_REQUISITION_CREATE_PATH')) {
    console.log('purchase-requisitions already patched');
    return;
  }

  text = text.replace(
    "import { useNavigate, useSearchParams } from 'react-router-dom';",
    "import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';",
  );
  if (!text.includes('useLocation')) {
    text = text.replace(
      "import { useNavigate } from 'react-router-dom';",
      "import { useNavigate, useLocation } from 'react-router-dom';",
    );
  }
  text = text.replace(
    /from 'antd';/,
    (m, offset) => {
      const before = text.slice(Math.max(0, offset - 200), offset);
      if (before.includes('Card')) return m;
      return m.replace("'antd'", "'antd'");
    },
  );
  if (!text.includes('Card,')) {
    text = text.replace(
      "  Typography,\n} from 'antd';",
      "  Typography,\n  Card,\n} from 'antd';",
    );
  }
  if (!text.includes('ArrowLeftOutlined')) {
    text = text.replace(
      "  PlusOutlined,\n} from '@ant-design/icons';",
      "  PlusOutlined,\n  ArrowLeftOutlined,\n} from '@ant-design/icons';",
    );
  }

  text = text.replace(
    "import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DetailDrawerActions, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';",
    `import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DetailDrawerInlineFullChain,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  PAGE_SPACING,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';`,
  );

  text = text.replace(
    'const PurchaseRequisitionsPage: React.FC = () => {',
    `const PURCHASE_REQUISITION_LIST_PATH = '/apps/kuaizhizao/purchase-management/purchase-requisitions';
const PURCHASE_REQUISITION_CREATE_PATH = \`\${PURCHASE_REQUISITION_LIST_PATH}/new\`;
const purchaseRequisitionEditPath = (id: number) => \`\${PURCHASE_REQUISITION_LIST_PATH}/\${id}/edit\`;

const PurchaseRequisitionsPage: React.FC = () => {`,
  );

  text = text.replace(
    '  const navigate = useNavigate();',
    `  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname.endsWith('/purchase-requisitions/new');
  const editRouteMatch = location.pathname.match(/\\/purchase-requisitions\\/(\\d+)\\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);`,
  );

  // Replace handleEdit
  text = text.replace(
    /  const handleEdit = useCallback\(\n    async \(record: PurchaseRequisition\) => \{[\s\S]*?\n    \[messageApi, ensureSupplierList\]\n  \);/,
    `  const loadPurchaseRequisitionEditForm = useCallback(
    async (id: number) => {
      void ensureSupplierList();
      setEditingId(id);
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      try {
        const detail = await getPurchaseRequisition(id);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_code: detail.requisition_code ?? '',
            requisition_name: detail.requisition_name,
            requisition_date: detail.requisition_date ? dayjs(detail.requisition_date) : dayjs(),
            applicant_name: detail.applicant_name ?? '',
            required_date: detail.required_date ? dayjs(detail.required_date) : undefined,
            notes: detail.notes,
            items:
              detail.items && detail.items.length > 0
                ? detail.items.map((it) => ({
                    material_id: it.material_id,
                    material_code: it.material_code ?? '',
                    material_name: it.material_name ?? '',
                    material_spec: it.material_spec ?? '',
                    unit: it.unit ?? '件',
                    quantity: Number(it.quantity ?? 1),
                    suggested_unit_price: Number(it.suggested_unit_price ?? 0),
                    required_date: it.required_date ? dayjs(it.required_date) : undefined,
                    demand_computation_item_id: it.demand_computation_item_id,
                    supplier_id: it.supplier_id,
                    notes: it.notes,
                  }))
                : [{ ...INITIAL_PR_FORM_ITEM_ROW }],
          });
        }, 0);
      } catch {
        messageApi.error('加载采购申请失败');
        navigate(PURCHASE_REQUISITION_LIST_PATH);
      }
    },
    [messageApi, ensureSupplierList, navigate],
  );

  const handleEdit = useCallback(
    (record: PurchaseRequisition) => {
      const s = (record.status ?? '').toString().trim();
      if (!['草稿', 'draft', 'DRAFT'].includes(s) || record.id == null) return;
      navigate(purchaseRequisitionEditPath(record.id));
    },
    [navigate],
  );`,
  );

  // Replace handleCreate
  text = text.replace(
    /  \/\*\* 参考销售订单：先打开弹窗[\s\S]*?  \};\n\n  const handlePullFromComputation/,
    `  async function initPurchaseRequisitionCreateForm() {
    void ensureSupplierList();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    createFormRef.current?.resetFields();
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-purchase-requisition');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-purchase-requisition');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const res = await testGenerateCode({ rule_code: ruleCode });
          const preview = res.code;
          setPreviewCode(preview ?? null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_code: preview ?? '',
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        }
      } else {
        setPreviewCode(null);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }, 100);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-purchase-requisition'));
      setTimeout(() => {
        createFormRef.current?.setFieldsValue({
          requisition_date: dayjs(),
          items: initialCreateItems,
        });
      }, 100);
    }
  }

  const handleCreate = () => {
    navigate(PURCHASE_REQUISITION_CREATE_PATH);
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.purchase-management.purchase-requisitions.new'
      : 'app.kuaizhizao.menu.purchase-management.purchase-requisitions.edit';
    const title = t(titleKey);
    const sp = new URLSearchParams(location.search || '');
    sp.delete('_refresh');
    const cleanSearch = sp.toString();
    const tabKey = location.pathname + (cleanSearch ? \`?\${cleanSearch}\` : '');
    setCustomPageTitle(location.pathname, title);
    setCustomPageTitle(tabKey, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    );
    return () => {
      removeCustomPageTitle(location.pathname);
      removeCustomPageTitle(tabKey);
    };
  }, [isFormPage, isCreatePage, location.pathname, location.search, t]);

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return;
    formPageInitializedRef.current = true;
    if (isCreatePage) {
      void initPurchaseRequisitionCreateForm();
    } else if (editRouteId) {
      void loadPurchaseRequisitionEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId]);

  const handlePullFromComputation`,
  );

  // handleModalSubmit navigation
  text = text.replace(
    `        messageApi.success('保存成功');
        setCreateModalVisible(false);
        setEditingId(null);
        setEffectiveRuleCode(null);
        setEffectiveAutoGen(null);
        createFormRef.current?.resetFields();
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();`,
    `        messageApi.success('保存成功');
        setEffectiveRuleCode(null);
        setEffectiveAutoGen(null);
        createFormRef.current?.resetFields();
        invalidateMenuBadgeCounts();
        if (isFormPage) {
          navigate(PURCHASE_REQUISITION_LIST_PATH);
        } else {
          setCreateModalVisible(false);
          setEditingId(null);
        }
        actionRef.current?.reload();`,
  );
  text = text.replace(
    `      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();`,
    `      messageApi.success('创建成功');
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      if (isFormPage) {
        navigate(PURCHASE_REQUISITION_LIST_PATH);
      } else {
        setCreateModalVisible(false);
      }
      actionRef.current?.reload();`,
  );

  const modalAnchor = '      <FormModalTemplate\n        title={editingId != null ? \'编辑采购申请\' : \'新建采购申请\'}';
  const modalIdx = text.indexOf(modalAnchor);
  if (modalIdx === -1) throw new Error('PR modal not found');
  const contentStart = text.indexOf('>\n', modalIdx) + 2;
  const modalEnd = text.indexOf('      </FormModalTemplate>', contentStart) + '      </FormModalTemplate>'.length;
  const formInner = text.slice(contentStart, modalEnd - '      </FormModalTemplate>'.length);

  const returnAnchor = '\n\n  return (\n    <>\n      <ListPageTemplate';
  const returnIdx = text.indexOf(returnAnchor);
  if (returnIdx === -1) throw new Error('PR return not found');

  const renderFormFn = `\n\n  const renderPurchaseRequisitionForm = () => (
    <>${formInner}    </>
  );

  const triggerPurchaseRequisitionFormSubmit = () => createFormRef.current?.submit?.();

  useSubmitShortcut(() => triggerPurchaseRequisitionFormSubmit(), isFormPage);

  if (isFormPage) {
    return (
      <>
        <div style={uniTabsChildPageVerticalInsetStyle()}>
          <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
            <Space align="center" size={8}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={() => navigate(PURCHASE_REQUISITION_LIST_PATH)}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.new')
                  : t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.edit')}
              </Typography.Title>
            </Space>
            <Space wrap>
              <Button onClick={() => navigate(PURCHASE_REQUISITION_LIST_PATH)}>{t('common.cancel')}</Button>
              <Button type="primary" onClick={triggerPurchaseRequisitionFormSubmit}>
                {isCreatePage
                  ? t('components.layoutTemplates.formModal.submitCreate')
                  : t('common.save')}
                {SUBMIT_SHORTCUT_HINT}
              </Button>
            </Space>
          </div>
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={createFormRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleModalSubmit}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const errText = first?.errors?.filter(Boolean)[0];
                  messageApi.error(errText || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={{ items: initialCreateItems }}
              >
                {renderPurchaseRequisitionForm()}
              </ProForm>
            </div>
          </Card>
        </div>
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendRequisitionItemsFromMaterials}
        />
      </>
    );
  }

  return (
    <>
      <ListPageTemplate`;

  text = text.slice(0, returnIdx) + renderFormFn + text.slice(returnIdx + returnAnchor.length);

  const modalIdx2 = text.indexOf('      <FormModalTemplate\n        title={editingId != null');
  const pickerIdx = text.indexOf('\n      <UniMaterialBatchPicker\n', modalIdx2);
  text = text.slice(0, modalIdx2) + text.slice(pickerIdx + 1);

  fs.writeFileSync(path, text);
  console.log('purchase-requisitions patched');
}

patchPurchaseOrders();
patchPurchaseRequisitions();
