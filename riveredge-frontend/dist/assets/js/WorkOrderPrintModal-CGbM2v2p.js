import{r as p,j as o,M as E,D as z,ae as v,V as x,aM as $,a4 as M,a9 as d}from"./vendor-gBTVkus8.js";import{g as C,b as L}from"./printTemplateSchemas-Dzy2pD70.js";import{b as W,aA as w,w as O}from"./clearSessionQueries-CFD3t5PK.js";import{M as H}from"./main-B_gp2Jrn.js";import"./LinkedDocumentDetailContext-CDkZ1kpw.js";import"./index.es-CVQtl77k.js";import"./sessionCurrentUser-MIvf-b_w.js";import"./tokenRefresh-BQ3n8vQ4.js";import"./building-2-DdZTpZfu.js";import"./index-BVrf7r2G.js";import"./UniLifecycleStepper-Gc1cdlk_.js";import"./UniLifecycleStepper-DYYJdlsv.js";import"./lightbulb-dFMLAtu1.js";import"./send-BRzDHgW2.js";import"./package-check-5jCWfww5.js";import"./japanese-yen-Cf2DayjF.js";import"./file-BlclB3_J.js";import"./documentLifecycleStatusTag-krLonyrO.js";import"./statusBadges-Crxj3XeS.js";import"./actionCatalog-BoPDHCRZ.js";import"./normalize-BJ_2tZ5f.js";import"./businessConfig-CzwB87Ku.js";import"./permissionContract-DSOVvbBw.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-DVkNnKBF.js";import"./index-VJ9h4W0Q.js";import"./timer-haTt7V0m.js";import"./user-DixrvMrB.js";import"./userDisplay-CEsWUacj.js";import"./materialUnitDisplay-CHGZKJwD.js";import"./ThemedSegmented-F31YP__1.js";import"./index-vL5UZFNL.js";import"./index-CHPAeFm4.js";import"./index-BGVwgksM.js";import"./index-BrhmmyBT.js";import"./index-BbbDhTAD.js";import"./createForOfIteratorHelper-bli_xNSr.js";import"./index-C_OpzTb7.js";import"./vendor-libredwg-CY6FOMsV.js";import"./vendor-three-BPXNOO5B.js";import"./index-PuDICj0j.js";import"./debounce-hdwFi5HA.js";import"./throttle-C7qKp3q6.js";import"./index-IoA_EagS.js";import"./routes-Y9AZ9kMJ.js";import"./workOrderLifecycle-LTdoqk2e.js";import"./listLifecycleStage-CZKWm3oh.js";import"./documentStatus-wXBTy6aq.js";import"./purchase-QwaUtDu9.js";import"./fieldPermissionResources-Bths15Zh.js";import"./quotation-BCoFPok7.js";import"./warehouseMarkerTags-CEPHerxN.js";import"./useDocumentCapabilities-DPVBYeOg.js";import"./warehouse-execution-DG-6aBBH.js";import"./sales-order-_Aa4X8M9.js";import"./material-z0S7sMUC.js";import"./purchase-requisition-DLK1nYEc.js";import"./availableInventoryCell-DsxT9vNP.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-BaJMX-h6.js";import"./work-order-BLq3G3qc.js";import"./logisticsListPresentation-dOY-KF87.js";import"./AuditPhaseBadge-hI_HzMKF.js";const Vt=({visible:s,onCancel:f,workOrderData:T,workOrderId:P})=>{const{t}=W(),[j,b]=p.useState([]),[k,g]=p.useState(!1),[y,m]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=P??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await C({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===L.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;m(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&m(!1)}},S=async()=>{if(!n){d.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){d.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}m(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){d.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("app.kuaizhizao.workOrder.actionPrint")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),d.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):d.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{m(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(M,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:j.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("app.kuaizhizao.workOrder.actionPrint")},"print")],className:"work-order-print-modal",children:[o.jsx(z,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(z,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(v,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
      `})]})};export{Vt as default};
