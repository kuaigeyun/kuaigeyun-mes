import{r as p,j as o,M as E,D as v,a8 as z,V as x,b2 as $,a2 as W,ag as s}from"./vendor-BN_Q0Owf.js";import{g as C,b as L}from"./printTemplateSchemas-DuEkgNOb.js";import{b as M,aW as w,D as O}from"./clientRelease-DRTuK97h.js";import{M as D}from"./main-BvAWHJlq.js";import"./LinkedDocumentDetailContext-44Yn2kcn.js";import"./detailDrawerTimeFields-DiP_4Y6d.js";import"./index.es-R4Sw-T_1.js";import"./sessionCurrentUser-mgjFPF40.js";import"./globalStore-DABP_CTu.js";import"./restoredUser-CXJJ0H_f.js";import"./tokenRefresh-DyW4ubF_.js";import"./building-2--5RaH_Gz.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-Brez2c_A.js";import"./statusBadges-CnmYTzS_.js";/* empty css                            */import"./UniLifecycleStepper-C_kLllue.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-DdrjmwKU.js";import"./package-check-COY7MJ8Q.js";import"./japanese-yen-D-6WIHdj.js";import"./file-8LFFoemf.js";import"./documentLifecycleStatusTag-DPvbKaMu.js";import"./documentStatusColors-HZmnr7ha.js";import"./operationColumn-DyceODcD.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-Bv7Ts_0d.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-2o8DA9_Y.js";import"./index-DaMP-NqB.js";import"./timer-haTt7V0m.js";import"./user-LdOt8_X_.js";import"./userDisplay-wLf89Ln3.js";import"./QuantityWithUnitDisplay-taW6Obl8.js";import"./materialUnitDisplay-CYOdRntK.js";import"./material-unit-Cq0sNxZE.js";import"./formDate-Cc2Wswtj.js";import"./index-CZuxjfjo.js";import"./kuaireportSharedFilePreview-Bjq8t1Ox.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-3ymdy2EK.js";import"./index-DP9aD37a.js";import"./index-5KPcGW0r.js";import"./index-B1032xx5.js";import"./createForOfIteratorHelper-BVulxfBm.js";import"./index-B1hL63so.js";import"./vendor-libredwg-C9uUhoHS.js";import"./vendor-three-BPXNOO5B.js";import"./index-BCZV4dsP.js";import"./index-Bf_J9-Na.js";import"./index-NKdr8AtN.js";import"./debounce-CClAPnOY.js";import"./throttle-D7U4dimm.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-dtyLW9OR.js";import"./useResourcePermissions-D8nuA9lz.js";import"./documentStatus-B2mkBnVU.js";import"./purchase-C7LyAcdu.js";import"./fieldPermissionResources-LRXHLrPG.js";import"./demandType-DfxGIZmf.js";import"./quotation-hRI2TK0a.js";import"./warehouseMarkerTags-CP04K8X3.js";import"./warehouse-execution-DbYZH3pC.js";import"./sales-order-zj_SHoGs.js";import"./dataDictionary-CTzdeuVK.js";import"./material-BGpAk2de.js";import"./purchase-requisition-Bmc61l56.js";import"./demand-computation-CFhzWwKJ.js";import"./availableInventoryCell-CvUecsni.js";import"./MrpMaterialPlanPanel-jMepYjbh.js";import"./workOrderReporting-uA4QAVbY.js";import"./documentAttachments-CLirVWkN.js";import"./WorkOrderMaterialMovementsPanel-8CGTD5Fu.js";import"./work-order-D8pLsKtv.js";import"./logisticsListPresentation-t4dOsWVt.js";import"./reporting-B0PNSy9y.js";import"./AuditPhaseBadge-QbxwBw0Q.js";const pr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});P(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(W,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{pr as default};
