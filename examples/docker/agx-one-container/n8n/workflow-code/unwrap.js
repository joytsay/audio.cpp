// n8n MCP workflow tools may nest JSON strings, arrays and MCP content blocks.
function payloads(value,depth=0){
 if(depth>12||value==null)return [];
 if(typeof value==='string'){try{return payloads(JSON.parse(value),depth+1);}catch{return [];}}
 if(Array.isArray(value))return value.flatMap(v=>payloads(v,depth+1));
 if(typeof value!=='object')return [];
 return [value,...Object.values(value).flatMap(v=>payloads(v,depth+1))];
}
