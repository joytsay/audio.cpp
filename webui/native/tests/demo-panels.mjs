import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.UI_BROWSER_TOOLS ? path.resolve(process.env.UI_BROWSER_TOOLS,'package.json') : import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.UI_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1584,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(/\/(v1|llm)\//,route=>{
  const name=new URL(route.request().url()).pathname;
  let json={data:[]};
  if(name.endsWith('/models-root'))json={models_root:'/app/models'};
  else if(name.endsWith('/path-status'))json={exists:false};
  else if(name.endsWith('/greetings'))json={content:'greeting\n"您好"\n'};
  else if(name.endsWith('/hotwords'))json={content:'context\n""\n'};
  else if(name.endsWith('/prompt'))json={content:'Demo prompt'};
  else if(name.endsWith('/voices'))json={voices:[]};
  else if(name.endsWith('/demo-settings'))json={settings:null};
  else if(name.endsWith('/system-info'))json={display_name:'NVIDIA Jetson AGX Orin',description:'Model: NVIDIA Jetson AGX Orin Developer Kit'};
  return route.fulfill({json});
 });
 const url=(process.env.UI_BASE_URL||'http://127.0.0.1:4174/').replace(/\/$/,'')+'/#/demo';
 await page.goto(url);await page.getByText('Using default model settings',{exact:true}).waitFor();
 const assistant=await page.getByLabel('Live assistant waveform',{exact:true}).boundingBox();
 const mic=await page.getByLabel('Live microphone waveform',{exact:true}).boundingBox();
 assert.ok(assistant.x<mic.x,'assistant must be left of microphone');
 await page.getByLabel('System prompt',{exact:true}).fill('Draft kept while hidden');
 const originalConversation=await page.locator('.conversation').boundingBox();
 await page.getByRole('button',{name:'Hide session',exact:true}).click();
 assert.equal(await page.getByRole('region',{name:'Session details',exact:true}).isVisible(),false);
 assert.ok((await page.locator('.conversation').boundingBox()).width>originalConversation.width);
 await page.getByRole('button',{name:'Show session',exact:true}).click();
 assert.equal(await page.getByRole('region',{name:'Session details',exact:true}).isVisible(),true);
 for(const [panel,other] of [['events','scenarios'],['scenarios','events']]) {
  await page.getByRole('button',{name:`Hide ${panel}`,exact:true}).click();
  assert.equal(await page.locator(`#demo-${panel}`).isVisible(),false);
  const box=await page.locator(`#demo-${other}`).boundingBox(), container=await page.locator('.bottom-panels').boundingBox();
  assert.ok(Math.abs(box.width-container.width)<2,'remaining bottom panel must expand');
  assert.equal(await page.getByRole('separator',{name:'Resize events and scenarios',exact:true}).isVisible(),false);
  await page.getByRole('button',{name:`Show ${panel}`,exact:true}).click();
 }
 await page.getByRole('button',{name:'Hide settings',exact:true}).click();
 assert.equal(await page.locator('#demo-settings').isVisible(),false);
 assert.ok((await page.locator('main').boundingBox()).x<1);
 await page.getByRole('button',{name:'Show settings',exact:true}).click();
 assert.equal(await page.getByLabel('System prompt',{exact:true}).inputValue(),'Draft kept while hidden');
 for(const panel of ['settings','session','events','scenarios'])await page.getByRole('button',{name:`Hide ${panel}`,exact:true}).click();
 assert.equal(await page.locator('.bottom-panels').isVisible(),false);
 assert.equal(await page.getByRole('separator',{name:'Resize bottom panels',exact:true}).isVisible(),false);
 assert.ok((await page.locator('.conversation').boundingBox()).height>originalConversation.height);
 await page.reload();await page.getByText('Using default model settings',{exact:true}).waitFor({state:'attached'});
 for(const panel of ['settings','session','events','scenarios']) {
  assert.equal(await page.getByRole('button',{name:`Show ${panel}`,exact:true}).isVisible(),true);
  assert.equal(await page.locator(panel==='session'?'#demo-session-details':`#demo-${panel}`).isVisible(),false);
 }
 await page.screenshot({path:'/tmp/geovision-panels-hidden.png'});
 for(const panel of ['settings','session','events','scenarios'])await page.getByRole('button',{name:`Show ${panel}`,exact:true}).click();
 await page.getByRole('button',{name:'Hide session',exact:true}).focus();await page.keyboard.press('Enter');
 const restore=page.getByRole('button',{name:'Show session',exact:true});await restore.waitFor();
 assert.equal(await restore.evaluate(element=>element===document.activeElement),true,'focus moves to the restore button');
 await restore.click();
 await page.screenshot({path:'/tmp/geovision-panels-controls.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Hide session',exact:true}).click();
 await page.getByRole('button',{name:'Show session',exact:true}).click();
 assert.equal(await page.getByRole('region',{name:'Session details',exact:true}).isVisible(),true,'session remains restorable on mobile');
 assert.deepEqual(errors,[]);
 console.log('PASS swapped waveforms; four panel hide/show controls; layout expansion; preserved drafts; persisted visibility; keyboard focus; mobile restoration');
}finally{await browser.close()}
