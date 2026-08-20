import{r as p,j as o,M as E,D as z,ae as v,V as x,aM as $,a4 as M,a9 as d}from"./vendor-r-7ZGhD4.js";import{g as C,b as L}from"./printTemplateSchemas-CdSsPThk.js";import{b as W,aE as w,x as O}from"./clearSessionQueries-CODXIZJA.js";import{M as H}from"./main-aBaFg_8k.js";import"./LinkedDocumentDetailContext-Blz23R-F.js";import"./detailDrawerTimeFields-BD54JG4w.js";import"./index.es-DgcxZjfQ.js";import"./sessionCurrentUser-BLZhgC0s.js";import"./tokenRefresh-Dtwgk3ou.js";import"./building-2-BpO19gSD.js";import"./index-B99c6K1F.js";/* empty css                            */import"./UniLifecycleStepper-BH21aarC.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-fkok8jk4.js";import"./send-CDTiLQyj.js";import"./package-check-C6OTBwwJ.js";import"./japanese-yen-BGInhiwG.js";import"./file-DzT6OyVe.js";import"./documentLifecycleStatusTag-DoScCMfx.js";import"./documentStatusColors-D17BszZB.js";import"./statusBadges-BHo_zO-Z.js";import"./actionCatalog-uCNnohrC.js";import"./normalize-B6B_3gcj.js";import"./businessConfig-B5-Di1yT.js";import"./permissionContract-Cz2JqaIS.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-n6L8Tqg1.js";import"./index-BC9r95Mx.js";import"./timer-haTt7V0m.js";import"./user-BuZ-s8bC.js";import"./userDisplay-CKn16UJg.js";import"./demandType-ChLP8QBc.js";import"./ThemedSegmented-DyURcZtv.js";import"./index-CPqT-5wT.js";import"./kuaireportSharedFilePreview-BEznPyS1.js";import"./index-DZpGj9fa.js";import"./index-BVw04pT8.js";import"./index-DfHULgWp.js";import"./index-BpCTMPde.js";import"./createForOfIteratorHelper-BbyZ7_fD.js";import"./index-BAOYGbBx.js";import"./vendor-libredwg-Cs_tpxap.js";import"./vendor-three-BPXNOO5B.js";import"./index-BsFJL-uS.js";import"./debounce-BIO2BNsT.js";import"./throttle-DTef3np5.js";import"./index-DcaV6Pfq.js";import"./routes-yxoaDZG1.js";import"./workOrderLifecycle-BdKmW0aa.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-DPNhvXSv.js";import"./documentStatus-DAto6GOY.js";import"./purchase-Bj9JjJNE.js";import"./fieldPermissionResources-DJbb9frU.js";import"./quotation-89LI7hGZ.js";import"./warehouseMarkerTags-CxulWJsw.js";import"./warehouse-execution-D2fAbCgx.js";import"./material-tOrUrL0t.js";import"./purchase-requisition-DBpL82Xp.js";import"./demand-computation-B2DafCis.js";import"./availableInventoryCell-DGthG4-3.js";import"./MrpMaterialPlanPanel-CtaxPFjQ.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-BzXgM4XC.js";import"./work-order-CqrGYQM3.js";import"./logisticsListPresentation-Dk4X7IHG.js";import"./reporting-D8x7rW5t.js";import"./AuditPhaseBadge-B7qBT4bx.js";const Zt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=W(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{Zt as default};
