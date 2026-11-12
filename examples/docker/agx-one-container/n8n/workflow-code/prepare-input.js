const body = $input.first().json.body;
if (!body || typeof body.text !== 'string' || !body.text.trim() || typeof body.sessionId !== 'string' || !body.sessionId.trim() || typeof body.model !== 'string' || !body.model.trim()) throw new Error('text, sessionId and model are required');
const messages = Array.isArray(body.messages) ? body.messages : [];
if (messages.length > 100 || messages.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Invalid conversation history');
const text=body.text.trim();
const user_transcripts=messages.filter(m=>m.role==='user').map(m=>m.content);
let query=text;
if(!/[工公]單/.test(text)&&/^(?:那|我要查詢|查詢)?(?:最舊|最早|最新|全部|所有)(?:的|呢|[。？?\s])*$/u.test(text)&&user_transcripts.some(t=>/[工公]單/.test(t)))query=`查詢工單：${text}`;
return [{json:{text,query,sessionId:body.sessionId,model:body.model,user_transcripts}}];
