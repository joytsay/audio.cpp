import fs from 'node:fs';
import vm from 'node:vm';

export async function installMcpFixture(page, fixedReply) {
  const workflow=JSON.parse(fs.readFileSync(new URL('../../../examples/docker/agx-one-container/n8n/maintenance-mcp-tools.json',import.meta.url)));
  const nodes=workflow.nodes.filter(n=>n.type.endsWith('.toolCode'));
  const advertised=[{name:'lookup_maintenance_guidance',description:'Retrieve maintenance rules',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}},...nodes.map(n=>({name:n.name,description:n.parameters.description,inputSchema:JSON.parse(n.parameters.inputSchema)}))];
  const calls=[],completions=[];
  await page.route('**/n8n/mcp/ivr-maintenance',async route=>{
    if(route.request().method()==='DELETE')return route.fulfill({status:204});
    const request=route.request().postDataJSON();
    let result;
    if(request.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}}};
    else if(request.method==='notifications/initialized')return route.fulfill({status:202});
    else if(request.method==='tools/list')result={tools:advertised};
    else if(request.method==='tools/call') {
      calls.push(request.params);
      const node=nodes.find(n=>n.name===request.params.name);
      const text=node?vm.runInNewContext(`(function(){${node.parameters.jsCode}})()`,{query:request.params.arguments}):'維修內容及備註需確認；起機測試正常才完成。';
      result={content:[{type:'text',text}]};
    } else throw new Error('Unexpected MCP method '+request.method);
    await route.fulfill({contentType:'text/event-stream',headers:{'Mcp-Session-Id':'browser-mcp-session'},body:'data: '+JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\n\n'});
  });
  await page.route('**/llm/v1/chat/completions*',async route=>{
    const body=route.request().postDataJSON();
    if(!body.tools)return route.fallback();
    completions.push(body);
    const results=body.messages.filter(m=>m.role==='tool');
    const current=body.messages.filter(m=>m.role==='user').at(-1).content;
    let message;
    if(results.length>=2) {
      const output=JSON.parse(results.at(-1).content);
      message={content:fixedReply||JSON.parse(output.content[0].text).proposed_reply};
    } else {
      const name=results.length===0?'lookup_maintenance_guidance':/備註/.test(current)?'read_back_notes':/起機測試正常/.test(current)?'confirm_startup_test':'read_back_maintenance';
      message={content:null,tool_calls:[{id:'call_'+results.length,type:'function',function:{name,arguments:JSON.stringify(name==='lookup_maintenance_guidance'?{query:current}:{})}}]};
    }
    await route.fulfill({json:{choices:[{message}]}});
  });
  return {calls,completions};
}
