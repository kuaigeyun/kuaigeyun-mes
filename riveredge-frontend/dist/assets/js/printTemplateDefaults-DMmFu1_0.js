const t={version:"v1",pageSize:"A4",orientation:"portrait",margins:{top:14,right:12,bottom:16,left:12},itemSpacing:6,blocks:[{id:"text-welcome",type:"text",content:"打印模板",tag:"h2",style:{fontSize:"18px",fontWeight:"700",textAlign:"center"}},{id:"field-code",type:"field",key:"code",label:"单据编号",showLabel:!0}]},i=`<div style="font-family: 'Microsoft YaHei', sans-serif; font-size: 14px; line-height: 1.6;">
  <h2 style="margin: 0 0 12px 0; text-align: center;">打印模板</h2>
  <p><strong>单据编号：</strong>{{ code }}</p>
</div>`,n=e=>({...e?{document_type:e}:{},engine:"jinja2",strict_variables:!1,source_type:"designer_json",designer_version:"v1",designer_schema:t,page:{size:"A4",orientation:"portrait",margin:"14mm 12mm"}});export{n as E,i as a};
