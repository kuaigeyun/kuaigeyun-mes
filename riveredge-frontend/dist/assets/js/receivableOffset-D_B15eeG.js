const e="销售退货";function s(t){return String(t?.source_type||"").trim()===e||String(t?.status||"").trim()==="已冲减"?!0:String(t?.notes||"").startsWith("销售退货冲减")}export{s as i};
