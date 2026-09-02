import{r as n,j as e,M as E,D as v,a8 as z,V as x,b3 as $,a2 as W,ag as s}from"./vendor-BmBt7UY6.js";import{g as C,b as L}from"./printTemplateSchemas-BW8hQd2g.js";import{b as M,aW as w,D as O}from"./clientRelease-CXyv4uk9.js";import{_ as D}from"./main-mMkUS73v.js";import"./LinkedDocumentDetailContext-B2-Wp5dR.js";import"./detailDrawerTimeFields-DhpIYOcj.js";import"./index.es-EFmAvao9.js";import"./sessionCurrentUser-DAsJGRct.js";import"./globalStore-BnEtoDY_.js";import"./restoredUser-eKMOOikB.js";import"./tokenRefresh-B-_JPjVm.js";import"./building-2-DEGFB3xm.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-eMmssR77.js";import"./statusBadges-BNSqBrWP.js";/* empty css                            */import"./UniLifecycleStepper-PnCu77Yy.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-DsYkP-q7.js";import"./package-check-CJJ7L6Dg.js";import"./japanese-yen-UThkpGdn.js";import"./file-DVwrj-jh.js";import"./documentLifecycleStatusTag-DPsIqVZA.js";import"./documentStatusColors-DCnjeIhA.js";import"./operationColumn-ClxdEcMs.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-DTJnxFrk.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-DnsKnmt2.js";import"./index-qkuO-IBu.js";import"./timer-haTt7V0m.js";import"./user-HnkAFZvT.js";import"./userDisplay-Cxy9RIfP.js";import"./QuantityWithUnitDisplay-BfWjlqHu.js";import"./materialUnitDisplay-C12Ptb8Y.js";import"./material-unit-CvlFpqBt.js";import"./formDate-CLMo9Bol.js";import"./index-Rm8ZYmNY.js";import"./kuaireportSharedFilePreview-CwA9yuHF.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-C2zhBFT4.js";import"./index-DKn6kHs1.js";import"./index-CX2M2i-H.js";import"./index-BAIMTQ9H.js";import"./createForOfIteratorHelper-B8XsJYOg.js";import"./index-BSNIKajF.js";import"./vendor-libredwg-BQAgViU_.js";import"./vendor-three-BPXNOO5B.js";import"./index-BRoFlJBF.js";import"./index-DVcmC-uF.js";import"./index-Brv1uNAI.js";import"./isObject-p2MzwT02.js";import"./_baseIsEqual-C9I1-alv.js";import"./debounce-DcQLLVK-.js";import"./throttle-CHV9SjD3.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-DlTLmQiB.js";import"./useResourcePermissions-hQhLF4Vs.js";import"./documentStatus-DBJSL1BY.js";import"./purchase-D_eMUI3s.js";import"./fieldPermissionResources-EBQmv_y6.js";import"./demandType-xQjFifJQ.js";import"./quotation-Debjxvrp.js";import"./warehouseMarkerTags-DDVWjJpN.js";import"./warehouse-execution-BS2E1yvo.js";import"./sales-order-BuOkJWM0.js";import"./dataDictionary-6ecrFB7Z.js";import"./material-DgdWL78X.js";import"./purchase-requisition-CaPEVS4R.js";import"./demand-computation-DZIGdueS.js";import"./availableInventoryCell-CFJNryE_.js";import"./MrpMaterialPlanPanel-BdPKiXVa.js";import"./workOrderReporting-DhdlRPTS.js";import"./documentAttachments-Ccn4vFZM.js";import"./WorkOrderMaterialMovementsPanel-Bt9Lf2Yt.js";import"./work-order-BcmjcOmQ.js";import"./logisticsListPresentation-tQQW8Le-.js";import"./reporting-D3h-txIw.js";import"./afterSalesListPresentation-BNiNjVsi.js";import"./modalEventIsolation-Cy-kpAMJ.js";import"./after-sales-service-paL0Wtke.js";import"./index-Bz_IrWfU.js";import"./index-C7wkXTkp.js";import"./index-B_sgqan0.js";import"./LineAttachmentsUpload-D-mhRCR-.js";import"./AuditPhaseBadge-NJZAlCUr.js";import"./formListItems-DcSxpq1Y.js";const kr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=n.useState([]),[k,g]=n.useState(!1),[y,d]=n.useState(!1),[a,u]=n.useState(),[h,l]=n.useState(""),c=n.useRef({}),p=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:p},n.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),n.useEffect(()=>{m&&a&&p?I():l("")},[m,a,p]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});P(r);const i=r.find(o=>o.is_default)??r.find(o=>o.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!p||!a)return;const r=`${a}-${p}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!p){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const o=window.open("","_blank");o?(o.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),o.document.close(),o.focus(),o.print(),o.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return e.jsxs(E,{title:e.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[e.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),e.jsx(W,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[e.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),e.jsx(x,{type:"primary",icon:e.jsx($,{}),onClick:S,loading:y,disabled:!a||!p,children:t("common.print")},"print")],className:"work-order-print-modal",children:[e.jsx(v,{spinning:k,children:e.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:p?y&&!h?e.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:e.jsx(v,{description:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:e.jsx("div",{style:{minHeight:24}})})}):h?e.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),e.jsx("style",{children:`
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
