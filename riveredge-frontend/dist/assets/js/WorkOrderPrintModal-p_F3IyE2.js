import{r as p,j as o,M as E,D as v,ab as z,V as x,aK as $,a4 as C,a9 as m}from"./vendor-MGDZZYvN.js";import{g as L,b as M}from"./printTemplateSchemas-Bl8Iv8u0.js";import{b as W,aE as w,x as O}from"./clearSessionQueries-DBRL2uKD.js";import{M as H}from"./main-BBZwkECN.js";import"./LinkedDocumentDetailContext-DBnYGrrQ.js";import"./detailDrawerTimeFields-BZwOiYCg.js";import"./index.es-CWHIlliW.js";import"./sessionCurrentUser-CbWwH141.js";import"./tokenRefresh-DXwk8qsw.js";import"./building-2-DMOPqL2v.js";import"./index-NtcsK8zo.js";/* empty css                            */import"./UniLifecycleStepper-Cbvi52_m.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./lightbulb-CA94VVw_.js";import"./send-EhLk12t1.js";import"./package-check-DmVTWCV7.js";import"./japanese-yen-Co5REE8x.js";import"./file-8Kq9R3aT.js";import"./documentLifecycleStatusTag-C71z0GVF.js";import"./documentStatusColors-BkcSX0nA.js";import"./statusBadges-NLn3udwV.js";import"./actionCatalog-CZI9VZSJ.js";import"./normalize-DTN0PVm6.js";import"./businessConfig-UOHuC65v.js";import"./permissionContract-BR0vkIdN.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-C4lsQNKx.js";import"./index-C3UxGJuK.js";import"./timer-haTt7V0m.js";import"./user-BXIifoAu.js";import"./userDisplay-B2ZsTOAR.js";import"./demandType-CyHMUkpZ.js";import"./ThemedSegmented-CZ0Xqlst.js";import"./index-0Da8ogYi.js";import"./kuaireportSharedFilePreview-DbLRXC5n.js";import"./index-Ddnq96sw.js";import"./index-7ewRJM6K.js";import"./index-PcHFurIa.js";import"./index-BLgSvvsZ.js";import"./createForOfIteratorHelper-CV1BTxIy.js";import"./index-CFMsSpsB.js";import"./vendor-libredwg-BMJdrGU7.js";import"./vendor-three-BPXNOO5B.js";import"./index-DBofp9-K.js";import"./debounce-DKjR1qgO.js";import"./throttle-UiypkYwe.js";import"./index-dF3om2af.js";import"./routes-yxoaDZG1.js";import"./workOrderLifecycle-TDLiQIq0.js";import"./listLifecycleStage-CZKWm3oh.js";import"./useResourcePermissions-Md0jTOWV.js";import"./documentStatus-CIsxCm5I.js";import"./purchase-PH7bQBtl.js";import"./fieldPermissionResources-BUQT4NJb.js";import"./quotation-iEdXaJ8m.js";import"./warehouseMarkerTags-Cv6oHtSa.js";import"./warehouse-execution-CBz_T9g7.js";import"./material-CWS1dEFC.js";import"./purchase-requisition-BXQVXe8z.js";import"./demand-computation-AB3_wUlL.js";import"./availableInventoryCell-CakzDwR6.js";import"./MrpMaterialPlanPanel-dsCBHh5Z.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-WH9vivJc.js";import"./work-order-B11CvBSe.js";import"./logisticsListPresentation-xYyu2s8a.js";import"./reporting-Bx0Nb0Cp.js";import"./AuditPhaseBadge-xWVrAAk4.js";const Zt=({visible:s,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=W(),[b,P]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{s&&(_(),u(void 0),l(""))},[s]),p.useEffect(()=>{s&&a&&n?I():l("")},[s,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});P(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){m.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){m.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){m.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),m.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):m.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:s,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
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
