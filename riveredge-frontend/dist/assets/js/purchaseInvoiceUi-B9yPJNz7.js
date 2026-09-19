const n=new Set(["已审核","已开票","已作废","已红冲"]);function s(e){const t=String(e.status||"").trim();return t?!n.has(t):!1}export{s as c};
