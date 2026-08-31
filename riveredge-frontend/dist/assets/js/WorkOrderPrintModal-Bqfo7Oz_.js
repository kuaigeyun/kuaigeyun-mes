import{r as n,j as e,M as E,D as v,a8 as z,V as x,b3 as $,a2 as W,ag as s}from"./vendor-CQhbbkVa.js";import{g as C,b as L}from"./printTemplateSchemas-DiyiIqys.js";import{b as M,aW as w,D as O}from"./clientRelease-DV2kFnwE.js";import{_ as D}from"./main-DqqDzLw-.js";import"./LinkedDocumentDetailContext-Owus1Wxv.js";import"./detailDrawerTimeFields-Cq-J-mLV.js";import"./index.es-D4xOE3FP.js";import"./sessionCurrentUser-dmvABDAA.js";import"./globalStore-BHpSOcmt.js";import"./restoredUser-XM6VkC9m.js";import"./tokenRefresh-BCfrEEnJ.js";import"./building-2-xQ10pSMt.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-j0wvmFY0.js";import"./statusBadges-Cda7c3XN.js";/* empty css                            */import"./UniLifecycleStepper-D_boFRjN.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-BoS0WVEa.js";import"./package-check-qfq3kh_q.js";import"./japanese-yen-C4kdE4mK.js";import"./file-DRJb-KoD.js";import"./documentLifecycleStatusTag-CFFZvgDT.js";import"./documentStatusColors-Ds3bzjyD.js";import"./operationColumn-BiYdaiA9.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-DPDpJMtF.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-D_2VqOhq.js";import"./index-DbgVPS-B.js";import"./timer-haTt7V0m.js";import"./user-C8U3t4lX.js";import"./userDisplay-CtZbqAzh.js";import"./QuantityWithUnitDisplay-C05yEaSF.js";import"./materialUnitDisplay-BKMbU9oF.js";import"./material-unit-83BJ-jwx.js";import"./formDate-BCQRVXj0.js";import"./index-DAT_DSCy.js";import"./kuaireportSharedFilePreview-dkIt5BV_.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-CtJ_QD-G.js";import"./index-BUhyX6zF.js";import"./index-jDhGo-lU.js";import"./index-qLe4s_Zd.js";import"./createForOfIteratorHelper-dEZm1u4K.js";import"./index-BXN6l2lH.js";import"./vendor-libredwg-z6ywauEl.js";import"./vendor-three-BPXNOO5B.js";import"./index-Da20-JLj.js";import"./index-zzuGzZFH.js";import"./index-BGK41c1y.js";import"./isObject-BbZVnzJg.js";import"./_baseIsEqual-DmxaN7ml.js";import"./debounce-CoBdkhxY.js";import"./throttle-g1hLanLP.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-L1Cfy58b.js";import"./useResourcePermissions-wmSLehPQ.js";import"./documentStatus-BFh7DSJr.js";import"./purchase-CLp90Q2P.js";import"./fieldPermissionResources-BLx0V9Ez.js";import"./demandType-CHFLLDP6.js";import"./quotation-CcnGyIM5.js";import"./warehouseMarkerTags-CS_W5NBW.js";import"./warehouse-execution-B82KnNrr.js";import"./sales-order-CUmcNV7R.js";import"./supply-chain-Bk5_VKLu.js";import"./material-Bfvte6sz.js";import"./purchase-requisition-kw77qqCK.js";import"./demand-computation-D4Es6MUu.js";import"./availableInventoryCell-BvkQ8oyA.js";import"./MrpMaterialPlanPanel-76_NkP3X.js";import"./workOrderReporting-uA4QAVbY.js";import"./documentAttachments-DQKXEb_u.js";import"./WorkOrderMaterialMovementsPanel-DomSrS79.js";import"./work-order-CguWE5IW.js";import"./logisticsListPresentation-BfcIlY1n.js";import"./reporting-BaVpQoO1.js";import"./afterSalesListPresentation-C09dFdrL.js";import"./modalEventIsolation-Cy-kpAMJ.js";import"./after-sales-service-DDpZ-kUc.js";import"./index-BxTP11T9.js";import"./index-Cia2Vi_K.js";import"./index-B_WsmGlD.js";import"./LineAttachmentsUpload-jm46eHXx.js";import"./AuditPhaseBadge-DOJIgKHs.js";const fr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=n.useState([]),[k,g]=n.useState(!1),[y,d]=n.useState(!1),[a,u]=n.useState(),[h,l]=n.useState(""),c=n.useRef({}),p=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:p},n.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),n.useEffect(()=>{m&&a&&p?I():l("")},[m,a,p]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});P(r);const i=r.find(o=>o.is_default)??r.find(o=>o.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!p||!a)return;const r=`${a}-${p}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!p){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const o=window.open("","_blank");o?(o.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),o.document.close(),o.focus(),o.print(),o.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return e.jsxs(E,{title:e.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[e.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),e.jsx(W,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[e.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),e.jsx(x,{type:"primary",icon:e.jsx($,{}),onClick:S,loading:y,disabled:!a||!p,children:t("common.print")},"print")],className:"work-order-print-modal",children:[e.jsx(v,{spinning:k,children:e.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:p?y&&!h?e.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:e.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:e.jsx("div",{style:{minHeight:24}})})}):h?e.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),e.jsx("style",{children:`
        .work-order-print-modal-wrap .ant-modal {
          max-width: calc(100vw - 32px) !important;
        }
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-nested-loading,
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-container,
        .work-order-print-modal-wrap .work-order-print-preview {
          height: 100% !important;
        }
        .work-order-print-modal-wrap .work-order-print-iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          border: none !important;
          display: block !important;
          background: #fff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .work-order-print-preview,
          .work-order-print-preview * {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .work-order-print-preview {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `})]})};export{fr as default};
