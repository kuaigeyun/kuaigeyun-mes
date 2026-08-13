import{r as p,j as o,M as E,D as z,ag as v,V as x,aM as $,a5 as M,aa as d}from"./vendor-B7mQtHhG.js";import{g as C}from"./printTemplate-BAdxSkLL.js";import{b as L,az as w,v as O}from"./clearSessionQueries-DXX-jIXV.js";import{a as W}from"./printTemplateSchemas-BMw4tGlG.js";import{M as H}from"./main-QgAL-sKq.js";import"./LinkedDocumentDetailContext-BzD3Zc21.js";import"./index.es-Cbi6AlXE.js";import"./sessionCurrentUser-CgyWINI4.js";import"./tokenRefresh-CDAPx5As.js";import"./building-2-Cyeu4zyB.js";import"./index-qwoBjamI.js";import"./documentLifecycleStatusTag-CoGDcIlr.js";import"./statusBadges-ChVHsGa_.js";/* empty css                            */import"./globalLifecycleI18n-YKQvqC18.js";import"./lightbulb-Banty9SV.js";import"./send-CN3BU_q_.js";import"./package-check-C63uVNKq.js";import"./japanese-yen-Do5XGRlh.js";import"./file-CJMyTne7.js";import"./materialUnitDisplay-15zbsUDF.js";import"./purchase-Cyoa13Hn.js";import"./documentStatus-CgrCDbJQ.js";import"./workOrderLifecycle-B4n3Ll_v.js";import"./listLifecycleStage-CZKWm3oh.js";import"./businessConfig-DGmsxwLT.js";import"./fieldPermissionResources-ChzqzLBO.js";import"./quotation-BMgYPrf1.js";import"./userDisplay-By7cX2pv.js";import"./user-CjlKXzp2.js";import"./permissionResource-C4537ZA2.js";import"./warehouse-execution-DSCbu-_J.js";import"./inboundHubTypes-BJC7BKPF.js";import"./useDocumentCapabilities-D3fqhCtm.js";import"./sales-order-DoU2mh3G.js";import"./purchase-requisition-CckJ5XGk.js";import"./work-order-Bu2Feh_w.js";import"./AuditPhaseBadge-BXVr2Q5Q.js";import"./ThemedSegmented-DSw8Wj97.js";import"./index-DVCkwHY5.js";import"./index-Dtobzch6.js";import"./index-CfIKBqMW.js";import"./index-58GGHemX.js";import"./index-CSbPUvQR.js";import"./createForOfIteratorHelper-B3KUbtqD.js";import"./index-CGGl7f_m.js";import"./vendor-libredwg-tOJL5aAc.js";import"./vendor-three-BPXNOO5B.js";import"./index-BsDtD1iS.js";import"./debounce-DZyx-iNG.js";import"./throttle-NiNKuivN.js";import"./index-j2b0qfyj.js";import"./dataDictionary-BxV1_10-.js";import"./actionCatalog-DA_sAAX4.js";import"./normalize-CxYTcBUQ.js";import"./permissionContract-jzknpnjH.js";import"./approvalInstance-ILLwIuSg.js";import"./index-BvDRVCyx.js";import"./timer-haTt7V0m.js";const qt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=L(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{qt as default};
