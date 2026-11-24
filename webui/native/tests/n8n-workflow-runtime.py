"""Exercise the merged flow using an isolated n8n container and synthetic inference. Real source documents are read-only; PDF OCR is stubbed.
Requires Linux Docker and the already installed n8n image. Never touches live
containers, workflows, credentials or source documents; builds no images.
"""
import json, pathlib, threading, http.server, urllib.request, urllib.error
import base64, http.cookiejar, time, subprocess, socket, uuid, os

ROOT = pathlib.Path(__file__).resolve().parents[3]
IMAGE = os.environ.get('N8N_TEST_IMAGE', 'docker.n8n.io/n8nio/n8n:2.46.6')
CONTAINER = 'ivr-workflow-test-' + uuid.uuid4().hex[:12]
KNOWLEDGE_CONTAINER=CONTAINER+'-knowledge'

def free_port():
 with socket.socket() as sock:
  sock.bind(('127.0.0.1', 0))
  return sock.getsockname()[1]

port, broker_port, knowledge_port = free_port(), free_port(), free_port()
subprocess.run(['docker', 'image', 'inspect', IMAGE, 'ivr-knowledge:local'], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['docker', 'run', '--pull=never', '--rm', '-d', '--name', CONTAINER,
 '--network', 'host', '-v', str(ROOT/'examples/docker/agx-one-container/knowledge')+':/knowledge:ro', '-e', 'N8N_LISTEN_ADDRESS=127.0.0.1',
 '-e', f'N8N_PORT={port}', '-e', f'N8N_RUNNERS_BROKER_PORT={broker_port}',
 '-e', 'N8N_SECURE_COOKIE=false', '-e', 'N8N_DIAGNOSTICS_ENABLED=false',
 '-e', 'N8N_PERSONALIZATION_ENABLED=false', IMAGE], check=True, stdout=subprocess.DEVNULL)
knowledge_url=f'http://127.0.0.1:{knowledge_port}'
knowledge_code="import{createKnowledgeServer,createKnowledgeStore}from './server.mjs';import{createWorkOrderStore}from './work-orders.mjs';const orders=createWorkOrderStore({root:'/tmp/ivr-workflow-orders',now:()=>new Date('2026-11-12T04:00:00Z')});createKnowledgeServer(createKnowledgeStore({root:'/workspace',orders,ragUrl:'http://127.0.0.1:"+str(port)+"/webhook/ivr-document-rag',pdf:async()=>({text:'Synthetic OCR excerpt; verify source handwriting.',extraction:'ocr'})})).listen("+str(knowledge_port)+",'127.0.0.1');"
subprocess.run(['docker','run','--pull=never','--rm','-d','--name',KNOWLEDGE_CONTAINER,'--network','host',
 '-v',str(ROOT)+':/workspace:ro','-v',str(ROOT/'examples/docker/agx-one-container/knowledge')+':/app/code:ro',
 '-e','IVR_RAG_EMBED_DIMENSIONS=4',
 '-w','/app/code','ivr-knowledge:local','node','--input-type=module','-e',knowledge_code],check=True,stdout=subprocess.DEVNULL)

def knowledge_api(path,body=None,method=None):
 from urllib.parse import quote
 request=urllib.request.Request(knowledge_url+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)

calls=[];embedding=[];scenario_removed=False
points={}; collections=set(); vision_calls=[]
class Mock(http.server.BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def send(self,data,status=200):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  if self.path.endswith('/exists'):return self.send({'result':{'exists':self.path.split('/')[2] in collections}})
  return self.send({'data':[{'id':'fixture-model','object':'model'}]})
 def do_PUT(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path.endswith('/points?wait=true'):
   points.update({p['id']:p for p in body['points']})
   return self.send({'status':'ok','result':{'status':'completed'}})
  assert self.path.startswith('/collections/')
  collections.add(self.path.split('/')[2])
  return self.send({'status':'ok','result':True})
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path.endswith('/points'):
   return self.send({'result':[{'id':id} for id in body['ids'] if id in points]})
  if self.path.endswith('/points/query'):
   ids=body['filter']['must'][0]['has_id']
   def rank(row):
    similarity=sum(a*b for a,b in zip(row['vector'],body['query']))
    return (-similarity,row['payload']['kind']!='image')
   ranked=sorted((points[id] for id in ids),key=rank)
   return self.send({'result':{'points':[{**row,'score':1.0} for row in ranked[:body['limit']]]}})
  if self.path=='/embedding':
   embedding.append(body)
   return self.send([{'index':i,'embedding':[[0.0,1.0,0.0,0.0] if 'LAB-ZETA' in str(item) else [1.0,0.0,0.0,0.0]]}
                     for i,item in enumerate(body['content'])])
  if self.path=='/vision':
   vision_calls.append(body)
   system=body['messages'][0]['content']
   content=body['messages'][1]['content']
   evidence='\n'.join(part['text'] for part in content if part['type']=='text')
   if 'Select the IVR scenario' in system:
    assert 'Returns and exchanges' in evidence and 'Delivery windows' in evidence,evidence
    answer='8' if 'send it back' in evidence else 'NONE'
   elif 'Continue the selected IVR simulation' in system:
    assert 'Returns and exchanges' in evidence and 'Delivery windows' not in evidence,evidence
    assert any(part['type']=='image_url' for part in content)
    answer='For order LIVE-28, the reference allows 45 days.' if 'LIVE-28' in evidence else 'What is your order number?'
   else:
    answer='LAB-ZETA 每週三回收，聯絡分機 7654。' if '每週三回收' in evidence else '沒有查到 LAB-ZETA 的服務資料。'
   return self.send({'choices':[{'message':{'content':answer}}]})
  if self.path=='/v1/embeddings':
   embedding.append(body);inputs=body['input'];inputs=inputs if isinstance(inputs,list) else [inputs]
   return self.send({'object':'list','model':'fixture-embedding','data':[{'object':'embedding','index':i,'embedding':([0.0,1.0,0.0] if 'LAB-ZETA' in str(inputs[i]) else [1.0,0.25,0.5])} for i in range(len(inputs))],'usage':{'prompt_tokens':10,'total_tokens':10}})
  if self.path=='/v1/chat/completions':
   calls.append(body)
   last=body['messages'][-1]
   assert body.get('max_tokens')==160
   current=next(m['content'] for m in body['messages'] if m['role']=='system')
   current_text=current.split('本輪使用者原話：',1)[1].split('\n',1)[0].strip()
   # Deliberately refuse to call tools and ask an unnecessary question, matching
   # the reported model failure. Routing, saving and factual replies must still work.
   msg={'role':'assistant','content':'請提供最新工單的詳細信息，我會查詢並列出最新的工單。'}
   if 'LAB-ZETA' in current_text:
    if scenario_removed:
     assert '每週三回收' not in current,'removed scenario leaked into fresh retrieval'
     msg={'role':'assistant','content':'沒有查到 LAB-ZETA 的服務資料。'}
    else:
     assert '7654' in current,'uploaded Q/A was not retrieved into agent context'
     msg={'role':'assistant','content':'LAB-ZETA 每週三回收，聯絡分機 7654。'}
   return self.send({'id':'chat-check','object':'chat.completion','created':int(time.time()),'model':'fixture-model','choices':[{'index':0,'message':msg,'finish_reason':'tool_calls' if msg.get('tool_calls') else 'stop'}],'usage':{'prompt_tokens':10,'completion_tokens':10,'total_tokens':20}})
  raise Exception(self.path)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Mock);threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{port}';mock=f'http://127.0.0.1:{server.server_port}'
cookies=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies));key=None
def api(path,body=None,method=None):
 headers={'Content-Type':'application/json'}
 if key and path.startswith('/api/v1'):headers['X-N8N-API-KEY']=key
 req=urllib.request.Request(base+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers=headers,method=method)
 try:
  with opener.open(req,timeout=100) as r:
   raw=r.read().decode();return json.loads(raw) if raw else None
 except urllib.error.HTTPError as e:raise RuntimeError(str(e.code)+' '+e.read().decode())
def check_scenario_report(table):
  scenario_turns=[
   '我要回報工單，2026年11月20日上午9:21美光MTB-QWE查修。',
   'C1-VFD-12CC04 查修變頻器PF753過載361A',
   'Fault Code：010，過載時電流60.10HZ、284rmp',
   '480V、60HZ、185KW、265A、1786rpm',
   '正確',
  ]
  scenario_session='html-scenario-3'
  report_payload={'sessionId':scenario_session,'model':'fixture-model','scenarioReport':{'number':3,'language':'zh'}}
  rows_path='/api/v1/data-tables/'+table['id']+'/rows'
  report_history=[]
  inference_before_report=(len(calls),len(embedding))
  for index,text in enumerate(scenario_turns):
   result=api('/webhook/ivr-scenario-report',{**report_payload,'text':text,'messages':report_history})
   assert result['scenario_report']
   if index<4:
    assert result['tools']==[] and 'work_order_id' not in result
    report_history.extend([{'role':'user','content':text},{'role':'assistant','content':result['reply']}])
   if index==2:assert '361A、60.10HZ、284rmp' in result['reply']
   if index==3:
    assert '電流 265A' in result['reply'] and '以上是否正確' in result['reply']
    assert not any(row['session_id']==scenario_session for row in api(rows_path)['data'])
  saved_report=api('/webhook/ivr-scenario-report',{**report_payload,'text':scenario_turns[-1],'messages':report_history})
  assert result['work_order_id']==saved_report['work_order_id'] and result['tools']==['add_work_order']
  scenario_rows=[row for row in api(rows_path)['data'] if row['session_id']==scenario_session]
  assert len(scenario_rows)==1 and scenario_rows[0]['equipment_number']=='C1-VFD-12CC04'
  scenario_fields=json.loads(scenario_rows[0]['results'])['fields']
  assert scenario_fields['故障碼']=='010' and scenario_fields['馬達銘牌']['轉速']=='1786rpm'
  assert (len(calls),len(embedding))==inference_before_report
  print('PASS HTML troubleshooting confirmation, exact readings, native Data Table write, and idempotent retry without inference')

def check_uploaded_script():
  png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrJ0AAAAASUVORK5CYII='
  html=f'''<html><body>
    <p>Assistant: Welcome to the service desk. Which service do you need?</p>
    <h2>Scenario 8: Returns and exchanges</h2>
    <p>Caller: I want to return my order.</p><p>Assistant: What is your order number?</p>
    <p>Caller: SAMPLE-123</p><p>Assistant: The return window is 45 days.</p>
    <img src="data:image/png;base64,{png}">
    <h2>Scenario 9: Delivery windows</h2>
    <p>Caller: When will my delivery arrive?</p><p>Assistant: Deliveries take seven days.</p>
  </body></html>'''
  added=knowledge_api('/scenarios',{'fileMode':True,'files':[{
   'name':'fresh-ivr-script.html','data':base64.b64encode(html.encode()).decode(),
  }]})['scenario']
  id=added['id']
  assert added['opening']=={'prompts':['Welcome to the service desk. Which service do you need?'],'language':'en'}
  knowledge_api('/scenario-imports/'+id,{'ready':True,'tables':[]},'PUT')
  initial=knowledge_api('/rag/index',{'id':id})
  assert initial['indexed']==4 and sum(point['payload']['kind']=='image' and
   point['payload']['source']=='fresh-ivr-script.html' for point in points.values())==1
  before=len(embedding)
  assert knowledge_api('/rag/index',{'id':id})==initial
  assert len(embedding)==before,'existing vectors must be reused'
  select={'id':id,'text':'I need to send it back','language':'en'}
  scenario=knowledge_api('/ivr-simulation',select)['scenario']
  assert scenario=={'number':8,'title':'Returns and exchanges','custom':True,'retrieval':True}
  assert knowledge_api('/ivr-simulation',{**select,'text':'Please help'})=={'scenario':None}
  first=knowledge_api('/ivr-simulation',{**select,'number':8})
  assert first['answer']=='What is your order number?'
  followup=knowledge_api('/ivr-simulation',{**select,'number':8,'text':'My order is LIVE-28.',
   'history':[{'role':'user','content':select['text']},{'role':'assistant','content':first['answer']}]})
  assert followup['answer']=='For order LIVE-28, the reference allows 45 days.'
  assert all('Returns and exchanges' in source['locator'] for source in followup['sources'])
  knowledge_api('/scenarios/'+id,method='DELETE')
  print('PASS new HTML opening, vision-assisted routing, section-scoped multimodal RAG, vector reuse and live follow-up')

if __name__=='__main__':
 try:
  for attempt in range(120):
   try:
    settings=api('/rest/settings')
    if settings.get('data',{}).get('userManagement') is not None:break
   except (OSError,ValueError,RuntimeError):pass
   time.sleep(0.5)
  else:raise RuntimeError('Isolated n8n did not become ready')
  try:api('/rest/owner/setup',{'email':'workflow-check@example.com','firstName':'Local','lastName':'Check','password':'LocalWorkflowCheck9!Secure'})
  except RuntimeError:api('/rest/login',{'emailOrLdapLoginId':'workflow-check@example.com','password':'LocalWorkflowCheck9!Secure'})
  data=api('/rest/api-keys',{'label':'Isolated workflow check '+str(time.time()),'expiresAt':int(time.time())+3600,'scopes':['workflow:list','workflow:create','workflow:read','workflow:update','workflow:activate','credential:create','execution:read','execution:list','dataTable:list','dataTable:create','dataTableColumn:read','dataTableColumn:create','dataTableRow:read','dataTableRow:create']});key=data['data']['rawApiKey']
  workflows=json.loads(subprocess.check_output(['node','--input-type=module','-e',"""
   import {readFileSync} from 'node:fs';
   import {splitManagedWorkflow} from './examples/docker/agx-one-container/n8n/workflow-layout.mjs';
   const template=JSON.parse(readFileSync('./examples/docker/agx-one-container/n8n/workflow.json','utf8'));
   console.log(JSON.stringify(splitManagedWorkflow(template)));
  """],cwd=ROOT,text=True))
  workflow=next(item for item in workflows if item['id']=='ivrWorkflow')
  cred=api('/api/v1/credentials',{'name':'Local test models','type':'openAiApi','data':{'apiKey':'local','url':mock+'/v1'}})
  for n in [node for item in workflows for node in item['nodes']]:
   if 'credentials' in n:n['credentials']={'openAiApi':{'id':cred['id'],'name':cred['name']}}
   if n['name']=='Local Embeddings':n['parameters']['options']['baseURL']=mock+'/v1'
   if n['name']=='Read saved scenarios':n['parameters']['url']=knowledge_url+'/scenarios'
   if n['name']=='Load knowledge files':n['parameters']['url']=knowledge_url+'/documents'
   if n['name']=='Retrieve guidance':n['parameters']['url']=knowledge_url+'/rag'
   if n['name']=='Prepare document RAG':
    n['parameters']['jsCode']=n['parameters']['jsCode'].replace('http://knowledge:6333',mock).replace('http://voice-ai:8088',mock)
   if n['id']=='document-rag-vision':n['parameters']['url']=mock+'/vision'
   if n['id'] in ['document-rag-load-evidence','document-rag-load-prompts']:
    n['parameters']['url']=n['parameters']['url'].replace('http://knowledge:8085',knowledge_url)
   if n['name']=='Delete scenario files and Q/A':n['parameters']['url']="={{ '"+knowledge_url+"/scenarios/' + $json.id }}"
   if n['name']=='Register caller turn':n['parameters']['url']=knowledge_url+'/call-turn'
   if n['name']=='Prepare work-order row':n['parameters']['url']=knowledge_url+'/work-order-draft'
  def import_fixture(data):
   subprocess.run(['docker','exec','-i',CONTAINER,'node','-e','require("node:fs").writeFileSync("/tmp/workflow-id-fixture.json",require("node:fs").readFileSync(0))'],input=json.dumps(data),text=True,check=True)
   imported=subprocess.run(['docker','exec',CONTAINER,'n8n','import:workflow','--input=/tmp/workflow-id-fixture.json'],text=True,capture_output=True)
   assert imported.returncode==0,imported.stderr+imported.stdout
  dependencies=[item for item in workflows if item['id']!=workflow['id']]
  import_fixture(dependencies)
  for item in dependencies:
   api('/api/v1/workflows/'+item['id']+'/publish',{})
  # Reproduce an installed workflow with the old ID and active webhook paths.
  old=json.loads(json.dumps(workflow));old['id']='ivrMaintenanceMcp'
  for node in old['nodes']:
   target=node['parameters'].get('workflowId')
   if isinstance(target,dict) and target.get('value')==workflow['id']:target['value']=old['id']
  import_fixture(old)
  api('/api/v1/workflows/'+old['id']+'/publish',{})
  import_fixture(workflow)
  assert api('/api/v1/workflows/ivrWorkflow')['id']=='ivrWorkflow'
  assert api('/api/v1/workflows/'+old['id'])['active']
  subprocess.run(['docker','cp',str(ROOT/'examples/docker/agx-one-container/n8n/unpublish-workflow.mjs'),CONTAINER+':/tmp/unpublish-workflow.mjs'],check=True)
  code='process.argv[1]="/usr/local/lib/node_modules/n8n/bin/n8n"; const {unpublishWorkflow}=await import("/tmp/unpublish-workflow.mjs"); await unpublishWorkflow("ivrMaintenanceMcp",{apiUrl:'+json.dumps(base)+'});'
  retired=subprocess.run(['docker','exec',CONTAINER,'node','--input-type=module','-e',code],text=True,capture_output=True)
  assert retired.returncode==0,retired.stdout+retired.stderr
  assert not api('/api/v1/workflows/'+old['id'])['active']
  cleanup='const{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("/home/node/.n8n/database.sqlite",{readOnly:true});console.log(db.prepare("SELECT count(*) AS n FROM user_api_keys WHERE label LIKE ?").get("Temporary workflow ID migration%").n)'
  assert subprocess.check_output(['docker','exec',CONTAINER,'node','-e',cleanup],text=True).strip()=='0','temporary migration API key must be removed'
  subprocess.run(['docker','cp',str(ROOT/'examples/docker/agx-one-container/n8n/publish-workflow.mjs'),CONTAINER+':/tmp/publish-workflow.mjs'],check=True)
  publish_code='process.argv[1]="/usr/local/lib/node_modules/n8n/bin/n8n"; const {publishWorkflow}=await import("/tmp/publish-workflow.mjs"); const {withN8nApi}=await import("/tmp/unpublish-workflow.mjs"); await withN8nApi(["dataTable:list"],api=>api("/data-tables"),{apiUrl:'+json.dumps(base)+'}); console.log(await publishWorkflow("ivrWorkflow",{apiUrl:'+json.dumps(base)+'}));'
  def auto_publish():
   result=subprocess.run(['docker','exec',CONTAINER,'node','--input-type=module','-e',publish_code],text=True,capture_output=True)
   assert result.returncode==0,result.stdout+result.stderr
   return result.stdout.strip()
  assert auto_publish().endswith('true'),'startup must publish the imported workflow'
  assert auto_publish().endswith('false'),'restarting with the same version must skip publication'
  installed=api('/api/v1/workflows/ivrWorkflow');previousVersion=installed['activeVersionId']
  edited={k:installed[k] for k in ['name','nodes','connections','settings']};edited['name']='GeoVision · Workflow · Local edit'
  next(n for n in edited['nodes'] if n['name']=='Local Chat Model')['parameters']['options']['temperature']=0.17
  api('/api/v1/workflows/ivrWorkflow?publishIfActive=false',edited,method='PUT')
  draft=api('/api/v1/workflows/ivrWorkflow');assert draft['versionId']!=draft['activeVersionId'],'node edit must produce a new draft version'
  assert auto_publish().endswith('true'),'startup must publish a newer installed draft'
  installed=api('/api/v1/workflows/ivrWorkflow')
  assert installed['name']==edited['name'] and installed['activeVersionId']!=previousVersion
  assert installed['activeVersionId']==installed['versionId']
  assert subprocess.check_output(['docker','exec',CONTAINER,'node','-e',cleanup],text=True).strip()=='0','temporary publication keys must be removed'
  time.sleep(1)
  assert knowledge_api('/health')['status']=='ok'
  histories={}
  def turn(session,text,expected_tool='retrieve_knowledge'):
   history=histories.setdefault(session,[])
   result=api('/webhook/ivr-agent',{'sessionId':session,'model':'fixture-model','text':text,'messages':history})
   history.extend([{'role':'user','content':text},{'role':'assistant','content':result['reply']}])
   print('Reply:',json.dumps(result,ensure_ascii=False))
   assert '\n' not in result['reply'] and len(result['reply'])<=200
   if expected_tool is None:assert result['tools']==[]
   else:assert expected_tool in result['tools']
   return result
  # Reproduce an existing table from revision 5, preserving its schema/rows.
  inverse={'派工單號':'reference_number','派工日期':'dispatch_date','工單名稱':'title','設備編號':'equipment_number','維修內容':'maintenance_items','FAN數量':'quantity','備註':'notes','起機測試':'test_result'}
  columns=next(n for item in workflows for n in item['nodes'] if n['name']=='Ensure work_orders')['parameters']['columns']['column']
  oldTable=api('/api/v1/data-tables',{'name':'work_orders','columns':[{**c,'name':inverse.get(c['name'],c['name'])} for c in columns if c['name']!='results']})
  historical={'order_id':'GV-HISTORIC','report_key':'historic-key','session_id':'historic-spaced','dispatch_date':'2026-11-12','transcripts':json.dumps(['回要回報工單。','2026年11月12號 A >一二三四五。'],ensure_ascii=False)}
  api('/api/v1/data-tables/'+oldTable['id']+'/rows',{'data':[historical]})
  migration='process.argv[1]="/usr/local/lib/node_modules/n8n/bin/n8n"; const {withN8nApi,ensureResultsColumn,tableUpgradeScopes}=await import("/tmp/unpublish-workflow.mjs"); await withN8nApi(tableUpgradeScopes,ensureResultsColumn,{apiUrl:'+json.dumps(base)+'});'
  migrated=subprocess.run(['docker','exec',CONTAINER,'node','--input-type=module','-e',migration],text=True,capture_output=True)
  assert migrated.returncode==0,migrated.stdout+migrated.stderr
  repaired=api('/api/v1/data-tables/'+oldTable['id']+'/rows')['data'][0]
  assert repaired['reference_number']=='A12345' and repaired['dispatch_date']=='2026-11-12'
  assert json.loads(repaired['results'])['fields']['派工單號']=='A12345'
  renamed=api('/api/v1/data-tables/'+oldTable['id']+'/columns')
  assert 'reference_number' in [c['name'] for c in renamed]
  if os.environ.get('N8N_SCENARIO_REPORT_ONLY')=='1':
   check_scenario_report(oldTable)
   check_uploaded_script()
   raise SystemExit(0)
  utterances=['我增加工单。','二零二六年十一月十二号，名称是台积电，工单名称，呃设备编号是一二三四，维修项目五六七八，数量八个。','测试正常。']
  before_intake=(len(calls),len(embedding));intake_started=time.monotonic()
  initial=turn('report-call',utterances[0],None)
  assert (len(calls),len(embedding))==before_intake,'fixed intake must bypass embeddings and LLM inference'
  print('Fixed intake webhook time:',round(time.monotonic()-intake_started,3),'seconds')
  assert initial['reply'].count('？')==1 and '日期' in initial['reply'] and '編號' in initial['reply']
  tables=api('/api/v1/data-tables')['data']
  table=next(t for t in tables if t['name']=='work_orders')
  def rows():return [r for r in api('/api/v1/data-tables/'+table['id']+'/rows')['data'] if r['session_id'] not in {'historic-spaced','fixture-dispatch'}]
  assert rows()==[],'the opener asks once and must not insert an empty row yet'
  details=turn('report-call',utterances[1],'add_work_order')
  records=rows();assert len(records)==1
  record=records[0]
  assert record['dispatch_date']=='2026-11-12'
  assert record['equipment_number']=='1234' and record['quantity']=='8個'
  assert json.loads(record['results'])['fields']['FAN數量']==''
  assert record['test_result']=='' and json.loads(record['transcripts'])==utterances[:2]
  assert record['order_id'] in details['reply'] and '已新增' in details['reply'] and '？' not in details['reply']
  assert knowledge_api('/work-orders')['work_orders']==[],'new saves must not create a JSON store'
  saved=turn('report-call',utterances[2],'add_work_order')
  assert len(rows())==1 and rows()[0]['order_id']==record['order_id']
  api('/api/v1/data-tables/'+table['id']+'/rows',{'data':[{
   'order_id':'GV-FIXTURE-OLDEST','report_key':'fixture-dispatch','session_id':'fixture-dispatch',
   'reference_number':'YCS-16860','dispatch_date':'2026-10-30',
  }]})
  before=len(calls)
  oldest=turn('report-call','可以列出最旧的工单吗？')
  assert 'YCS-16860' in oldest['reply']
  assert any(m.get('role')=='system' and utterances[0] in m.get('content','') for m in calls[before]['messages']),'Same call lost conversational context'
  month_oldest=turn('report-call','直接幫我找出這個月最舊的工單。是。')
  assert '2026年11月' in month_oldest['reply'] and '2026-10-30' not in month_oldest['reply']
  latest=turn('report-call','最新的工单，帮我列出来。')
  assert record['order_id'] in latest['reply']
  followup=turn('report-call','二零二六年十一月的。')
  assert record['order_id'] in followup['reply'] and '2026年11月' in followup['reply']
  for reply in [oldest,month_oldest,latest,followup]:
   assert '請提供' not in reply['reply'] and '？' not in reply['reply']
  repeat=turn('report-call','测试正常。','add_work_order')
  assert record['order_id'] in repeat['reply'] and len(rows())==1
  empty=turn('empty-month','查詢最新工單，2025年1月。')
  assert empty['reply']=='2025年1月沒有工單記錄。'
  before=len(calls)
  turn('another-caller','查詢最新工單。')
  assert not any(m.get('role')=='system' and utterances[0] in m.get('content','') for m in calls[before]['messages']),'Memory leaked between callers'
  prompt=turn('incomplete-report','我增加工单。',None)
  assert prompt['reply'].count('？')==1 and len(rows())==1
  incomplete=turn('incomplete-report','不知道。','add_work_order')
  records=rows();assert len(records)==2
  partial=next(row for row in records if row['session_id']=='incomplete-report')
  assert partial['dispatch_date']=='' and partial['equipment_number']=='' and partial['quantity']=='' and partial['maintenance_items']==''
  assert '已新增' in incomplete['reply'] and '？' not in incomplete['reply']
  repeat=turn('incomplete-report','不知道。','add_work_order')
  assert len(rows())==2,'retry must upsert the same Data Table row'
  turn('example-call','我要新增工單。',None)
  example='十一月十二号A一二三五年一维，Fan两个。'
  exampleReply=turn('example-call',example,'add_work_order')
  assert exampleReply['reply']=='工單 A1235 已新增。'
  exampleRow=next(r for r in rows() if r['reference_number']=='A1235')
  assert json.loads(exampleRow['results'])=={'transcripts':['我要新增工單。',example],'fields':{'派工單號':'A1235','派工日期':'2026/11/12','維修內容':'五年一維','FAN數量':2,'備註':'','起機測試':''}}
  fullReport='我要回報工單，2026年6月2日下午14:00臺積電F15P1/2_ME VFD備品與維修。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。'
  turn('equipment-call',fullReport,None)
  equipmentSave=turn('equipment-call','2026年6月2日下午14:00。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。','add_work_order')
  assert equipmentSave['reply']=='工單 F15P1/2_ME 已新增。'
  equipmentRow=next(r for r in rows() if r['session_id']=='equipment-call')
  assert json.loads(equipmentRow['results'])['fields']['FAN數量']==14
  count=len(rows())
  for question in ['最新工單多少','F15P1 呢？','F15P1 工單內容？','可以跟我講F15P1工單內容','最舊工單','FAN幾個']:
   answer=turn('equipment-call',question)
   assert '已新增' not in answer['reply'] and len(rows())==count
   if 'F15P1' in question:assert 'F15P1/2_ME' in answer['reply'] and '14' in answer['reply']
   if question=='FAN幾個':assert '14' in answer['reply'] and '強排 4 個' in answer['reply'] and '間面 10 個' in answer['reply']
  assert api('/webhook/ivr-scenarios')['scenarios']==[]
  content='\ufeffQuestion,Answer\r\nLAB-ZETA 包材何時回收？,"LAB-ZETA 每週三回收，聯絡分機 7654。"\r\n'
  scenarioUpload={'name':'LAB-ZETA 上傳測試','files':[{'name':'服務.csv','data':base64.b64encode(content.encode()).decode()}]}
  # Seed a record in the format saved by the retired webhook.
  added=knowledge_api('/scenarios',scenarioUpload)
  assert added['scenario']['qaCount']>=1,added
  assert api('/webhook/ivr-scenarios')['scenarios'][0]['id']==added['scenario']['id']
  knowledgeAnswer=turn('uploaded-scenario-call','LAB-ZETA 包材何時回收？')
  assert '7654' in knowledgeAnswer['reply'] and '每週三' in knowledgeAnswer['reply']
  assert any('Q:' in item and 'A:' in item and '每週三回收' in item
             for batch in embedding for item in batch.get('content',[]) if isinstance(item,str))
  removed=api('/webhook/ivr-delete-scenario',{'id':added['scenario']['id']})
  assert removed['removed'] is True and api('/webhook/ivr-scenarios')['scenarios']==[]
  assert api('/webhook/ivr-delete-scenario',{'id':added['scenario']['id']})['alreadyRemoved'] is True
  assert not any(document.get('scenario_id')==added['scenario']['id'] for document in knowledge_api('/documents',{'query':'LAB-ZETA'})['documents'])
  scenario_removed=True
  removedAnswer=turn('deleted-scenario-call','LAB-ZETA 包材何時回收？')
  assert '7654' not in removedAnswer['reply'] and '沒有查到' in removedAnswer['reply']
  print('PASS native n8n removal webhook: persisted list, source documents and fresh RAG retrieval exclude deleted scenario; retries are safe')
  check_scenario_report(table)
  check_uploaded_script()
  print('PASS workflow ID migration and isolated n8n with real knowledge service: split spoken-number report, one follow-up question then native Data Table upsert even with missing fields, table-backed retrieval and enrichment despite model refusing tools, persisted record/retry, simplified Chinese lookups, month filtering/date follow-ups, direct one-line answers and isolated call memory (synthetic LLM/embeddings/PDF OCR).')

 except Exception:
  print('Model requests:',len(calls),'Embedding calls:',len(embedding))
  try:print(subprocess.check_output(['docker','logs','--tail','30',CONTAINER],text=True))
  except:pass
  raise
 finally:
  server.shutdown()
  subprocess.run(['docker','rm','-f',CONTAINER,KNOWLEDGE_CONTAINER],stdout=subprocess.DEVNULL,check=False)
