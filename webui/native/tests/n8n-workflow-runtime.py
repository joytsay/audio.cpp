"""Exercise the merged flow using an isolated n8n container and synthetic inference. Real source documents are read-only; PDF OCR is stubbed.
Requires Linux Docker and the already installed n8n image. Never touches live
containers, workflows, credentials or source documents; builds no images.
"""
import json, pathlib, threading, http.server, urllib.request, urllib.error
import http.cookiejar, time, subprocess, socket, uuid, os

ROOT = pathlib.Path(__file__).resolve().parents[3]
IMAGE = os.environ.get('N8N_TEST_IMAGE', 'docker.n8n.io/n8nio/n8n:2.46.6')
CONTAINER = 'ivr-workflow-test-' + uuid.uuid4().hex[:12]
KNOWLEDGE_CONTAINER=CONTAINER+'-knowledge'

def free_port():
 with socket.socket() as sock:
  sock.bind(('127.0.0.1', 0))
  return sock.getsockname()[1]

port, broker_port, knowledge_port = free_port(), free_port(), free_port()
subprocess.run(['docker', 'image', 'inspect', IMAGE, 'audio.cpp-ivr-knowledge:local'], check=True, stdout=subprocess.DEVNULL)
subprocess.run(['docker', 'run', '--pull=never', '--rm', '-d', '--name', CONTAINER,
 '--network', 'host', '-v', str(ROOT/'examples/docker/agx-one-container/knowledge')+':/knowledge:ro', '-e', 'N8N_LISTEN_ADDRESS=127.0.0.1',
 '-e', f'N8N_PORT={port}', '-e', f'N8N_RUNNERS_BROKER_PORT={broker_port}',
 '-e', 'N8N_SECURE_COOKIE=false', '-e', 'N8N_DIAGNOSTICS_ENABLED=false',
 '-e', 'N8N_PERSONALIZATION_ENABLED=false', IMAGE], check=True, stdout=subprocess.DEVNULL)
knowledge_url=f'http://127.0.0.1:{knowledge_port}'
knowledge_code="import{createKnowledgeServer,createKnowledgeStore}from './server.mjs';import{createWorkOrderStore}from './work-orders.mjs';const orders=createWorkOrderStore({root:'/tmp/ivr-workflow-orders',now:()=>new Date('2026-11-12T04:00:00Z')});createKnowledgeServer(createKnowledgeStore({root:'/workspace',orders,pdf:async()=>({text:'Synthetic OCR excerpt; verify source handwriting.',extraction:'ocr'})})).listen("+str(knowledge_port)+",'127.0.0.1');"
subprocess.run(['docker','run','--pull=never','--rm','-d','--name',KNOWLEDGE_CONTAINER,'--network','host',
 '-v',str(ROOT)+':/workspace:ro','-v',str(ROOT/'examples/docker/agx-one-container/knowledge')+':/app/code:ro',
 '-w','/app/code','audio.cpp-ivr-knowledge:local','node','--input-type=module','-e',knowledge_code],check=True,stdout=subprocess.DEVNULL)

def knowledge_api(path,body=None):
 from urllib.parse import quote
 request=urllib.request.Request(knowledge_url+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)

calls=[];embedding=[]
class Mock(http.server.BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def send(self,data):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def do_GET(self):return self.send({'data':[{'id':'fixture-model','object':'model'}]})
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path=='/v1/embeddings':
   embedding.append(body);inputs=body['input'];inputs=inputs if isinstance(inputs,list) else [inputs]
   return self.send({'object':'list','model':'fixture-embedding','data':[{'object':'embedding','index':i,'embedding':[1.0,0.25,0.5]} for i in range(len(inputs))],'usage':{'prompt_tokens':10,'total_tokens':10}})
  if self.path=='/v1/chat/completions':
   calls.append(body)
   last=body['messages'][-1]
   assert body.get('max_tokens')==160
   current=next(m['content'] for m in body['messages'] if m['role']=='system')
   current_text=current.split('本輪使用者原話：',1)[1].split('\n',1)[0].strip()
   # Deliberately refuse to call tools and ask an unnecessary question, matching
   # the reported model failure. Routing, saving and factual replies must still work.
   msg={'role':'assistant','content':'請提供最新工單的詳細信息，我會查詢並列出最新的工單。'}
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
  workflow=json.loads((ROOT / 'examples/docker/agx-one-container/n8n/workflow.json').read_text())
  cred=api('/api/v1/credentials',{'name':'Local test models','type':'openAiApi','data':{'apiKey':'local','url':mock+'/v1'}})
  for n in workflow['nodes']:
   if 'credentials' in n:n['credentials']={'openAiApi':{'id':cred['id'],'name':cred['name']}}
   if n['name']=='Local Embeddings':n['parameters']['options']['baseURL']=mock+'/v1'
   if n['name'] in ['KnowledgeMCP','Retrieve current turn']:n['parameters']['endpointUrl']=base+'/mcp/ivr-maintenance'
   if n['name']=='Load knowledge files':n['parameters']['url']=knowledge_url+'/documents'
   if n['name']=='Register caller turn':n['parameters']['url']=knowledge_url+'/call-turn'
   if n['name']=='Prepare work-order row':n['parameters']['url']=knowledge_url+'/work-order-draft'
  def import_fixture(data):
   subprocess.run(['docker','exec','-i',CONTAINER,'node','-e','require("node:fs").writeFileSync("/tmp/workflow-id-fixture.json",require("node:fs").readFileSync(0))'],input=json.dumps(data),text=True,check=True)
   imported=subprocess.run(['docker','exec',CONTAINER,'n8n','import:workflow','--input=/tmp/workflow-id-fixture.json'],text=True,capture_output=True)
   assert imported.returncode==0,imported.stderr+imported.stdout
  # Reproduce an installed workflow with the old ID and active webhook paths.
  old=json.loads(json.dumps(workflow));old['id']='ivrMaintenanceMcp'
  next(n for n in old['nodes'] if n['name']=='retrieve_knowledge')['parameters']['workflowId']['value']=old['id']
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
  api('/api/v1/workflows/ivrWorkflow/publish',{})
  time.sleep(1)
  assert knowledge_api('/health')['status']=='ok'
  histories={}
  def turn(session,text,expected_tool='retrieve_knowledge'):
   history=histories.setdefault(session,[])
   result=api('/webhook/ivr-agent',{'sessionId':session,'model':'fixture-model','text':text,'messages':history})
   history.extend([{'role':'user','content':text},{'role':'assistant','content':result['reply']}])
   print('Reply:',json.dumps(result,ensure_ascii=False))
   assert '\n' not in result['reply'] and len(result['reply'])<=200
   assert expected_tool in result['tools']
   return result
  # Reproduce an existing table from revision 5, preserving its schema/rows.
  inverse={'派工單號':'reference_number','派工日期':'dispatch_date','工單名稱':'title','設備編號':'equipment_number','維修內容':'maintenance_items','FAN數量':'quantity','備註':'notes','起機測試':'test_result'}
  columns=next(n for n in workflow['nodes'] if n['name']=='Ensure work_orders')['parameters']['columns']['column']
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
  utterances=['我增加工单。','二零二六年十一月十二号，名称是台积电，工单名称，呃设备编号是一二三四，维修项目五六七八，数量八个。','测试正常。']
  initial=turn('report-call',utterances[0])
  assert initial['reply'].count('？')==1 and '日期' in initial['reply'] and '編號' in initial['reply']
  tables=api('/api/v1/data-tables')['data']
  table=next(t for t in tables if t['name']=='work_orders')
  def rows():return [r for r in api('/api/v1/data-tables/'+table['id']+'/rows')['data'] if r['session_id']!='historic-spaced']
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
  before=len(calls)
  oldest=turn('report-call','可以列出最旧的工单吗？')
  assert 'YCS-16860' in oldest['reply']
  assert any(m.get('content')==utterances[0] for m in calls[before]['messages']),'Same call lost conversational context'
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
  assert not any(m.get('content')==utterances[0] for m in calls[before]['messages']),'Memory leaked between callers'
  prompt=turn('incomplete-report','我增加工单。')
  assert prompt['reply'].count('？')==1 and len(rows())==1
  incomplete=turn('incomplete-report','不知道。','add_work_order')
  records=rows();assert len(records)==2
  partial=next(row for row in records if row['session_id']=='incomplete-report')
  assert partial['dispatch_date']=='' and partial['equipment_number']=='' and partial['quantity']=='' and partial['maintenance_items']==''
  assert '已新增' in incomplete['reply'] and '？' not in incomplete['reply']
  repeat=turn('incomplete-report','不知道。','add_work_order')
  assert len(rows())==2,'retry must upsert the same Data Table row'
  inserts=[batch for batch in embedding if any('Q:' in str(item) for item in batch['input'])]
  assert inserts and all('Q:' in str(item) and 'A:' in str(item) for batch in inserts for item in batch['input']),'Q/A pairs must stay together'
  turn('example-call','我要新增工單。')
  example='十一月十二号A一二三五年一维，Fan两个。'
  exampleReply=turn('example-call',example,'add_work_order')
  assert exampleReply['reply']=='工單 A1235 已新增。'
  exampleRow=next(r for r in rows() if r['reference_number']=='A1235')
  assert json.loads(exampleRow['results'])=={'transcripts':['我要新增工單。',example],'fields':{'派工單號':'A1235','派工日期':'2026/11/12','維修內容':'五年一維','FAN數量':2,'備註':'','起機測試':''}}
  fullReport='我要回報工單，2026年6月2日下午14:00臺積電F15P1/2_ME VFD備品與維修。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。'
  turn('equipment-call',fullReport)
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
  print('PASS workflow ID migration and isolated n8n with real knowledge service: split spoken-number report, one follow-up question then native Data Table upsert even with missing fields, table-backed retrieval and enrichment despite model refusing tools, persisted record/retry, simplified Chinese lookups, month filtering/date follow-ups, direct one-line answers and isolated call memory (synthetic LLM/embeddings/PDF OCR).')

 except Exception:
  print('Model requests:',len(calls),'Embedding calls:',len(embedding))
  try:print(subprocess.check_output(['docker','logs','--tail','30',CONTAINER],text=True))
  except:pass
  raise
 finally:
  server.shutdown()
  subprocess.run(['docker','rm','-f',CONTAINER,KNOWLEDGE_CONTAINER],stdout=subprocess.DEVNULL,check=False)
