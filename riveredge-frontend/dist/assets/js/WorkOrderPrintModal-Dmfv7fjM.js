import{r as n,j as e,M as E,D as v,a8 as z,V as x,b3 as $,a2 as C,ag as s}from"./vendor-DF57fAD-.js";import{g as L,b as W}from"./printTemplateSchemas-CPYVBKst.js";import{b as M,aX as w,D as O}from"./clientRelease-CNE_5vTl.js";import{_ as D}from"./main-DleVyh6x.js";import"./LinkedDocumentDetailContext-B9qoYo8r.js";import"./detailDrawerTimeFields-CzVviT7f.js";import"./index.es-BbNG9duF.js";import"./sessionCurrentUser-6pMVlEat.js";import"./globalStore-BsfonsxI.js";import"./restoredUser-PZK2-K4P.js";import"./tokenRefresh-DYz5aZlb.js";import"./building-2-C3DgydGd.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-DpsXMatM.js";import"./statusBadges-DguXDc_j.js";/* empty css                            */import"./UniLifecycleStepper-BfmDVHjy.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-wBD4usvQ.js";import"./package-check-DMbgeRb8.js";import"./japanese-yen-DDa22WlL.js";import"./file-b-LiW5hq.js";import"./documentLifecycleStatusTag-CKru08Im.js";import"./documentStatusColors-B6_qpJKh.js";import"./operationColumn-Dcl6dp75.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-9wpLEj_I.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-BCRlWCzd.js";import"./index-RxBFYOpO.js";import"./timer-haTt7V0m.js";import"./user-CSTXKdtW.js";import"./userDisplay-CqJkIcK1.js";import"./QuantityWithUnitDisplay-CBlogvOt.js";import"./materialUnitDisplay-DWN3l3WG.js";import"./material-unit-bRkDb3iD.js";import"./formDate-l7GcU-KT.js";import"./index-jHbnxJS5.js";import"./kuaireportSharedFilePreview-vtdQmgST.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-BsFrpPUL.js";import"./index-DGMT4c2N.js";import"./index-BZQsyCvM.js";import"./index-Dheit7UO.js";import"./createForOfIteratorHelper-BGkeDiPN.js";import"./index-BsmMbkH3.js";import"./vendor-libredwg-7n-vRDWi.js";import"./vendor-three-BPXNOO5B.js";import"./index-BFufHLXL.js";import"./index-mkjqva0G.js";import"./index-buAVFV6m.js";import"./isObject-C2_rKnP_.js";import"./_baseIsEqual-BS28XXqu.js";import"./debounce-Dwp6HukW.js";import"./throttle-BA_VN-gT.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-C_q8fdPM.js";import"./useResourcePermissions-C9Zyl6ZI.js";import"./documentStatus-BwTqD9jR.js";import"./purchase-DeLUgY5J.js";import"./fieldPermissionResources-nc6SNr2Z.js";import"./demandType-CC-f9wlx.js";import"./quotation-BVvGpvoZ.js";import"./warehouseMarkerTags-B2ArXJSr.js";import"./warehouse-execution-aqJElByL.js";import"./sales-order-B8HGwxx6.js";import"./dataDictionary-D7A8O1zQ.js";import"./material-CcABM2XP.js";import"./purchase-requisition-Dhksi-vM.js";import"./demand-computation-BFw6MsGR.js";import"./availableInventoryCell-D7UvnITK.js";import"./MrpMaterialPlanPanel-DimWxDfr.js";import"./workOrderReporting-DhdlRPTS.js";import"./documentAttachments-ng54meKk.js";import"./WorkOrderMaterialMovementsPanel-BDteCwUa.js";import"./work-order-CWtyUtTE.js";import"./logisticsListPresentation-DvBdUXnt.js";import"./reporting-ClW61r5D.js";import"./afterSalesListPresentation-V5A9ZTGA.js";import"./modalEventIsolation-Cy-kpAMJ.js";import"./after-sales-service-Dcaq-6ak.js";import"./index-BIwnrigX.js";import"./index-DGuCLUMx.js";import"./index-EqUBfKbj.js";import"./LineAttachmentsUpload-DaSwyeyM.js";import"./AuditPhaseBadge-D6GMGmmR.js";import"./formListItems-DcSxpq1Y.js";const kr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=n.useState([]),[k,g]=n.useState(!1),[y,d]=n.useState(!1),[a,u]=n.useState(),[h,l]=n.useState(""),c=n.useRef({}),p=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:p},n.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),n.useEffect(()=>{m&&a&&p?I():l("")},[m,a,p]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});P(r);const i=r.find(o=>o.is_default)??r.find(o=>o.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!p||!a)return;const r=`${a}-${p}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!p){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const o=window.open("","_blank");o?(o.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),o.document.close(),o.focus(),o.print(),o.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return e.jsxs(E,{title:e.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[e.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),e.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[e.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),e.jsx(x,{type:"primary",icon:e.jsx($,{}),onClick:S,loading:y,disabled:!a||!p,children:t("common.print")},"print")],className:"work-order-print-modal",children:[e.jsx(v,{spinning:k,children:e.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:p?y&&!h?e.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:e.jsx(v,{description:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:e.jsx("div",{style:{minHeight:24}})})}):h?e.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),e.jsx("style",{children:`
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
      `})]})};export{kr as default};
