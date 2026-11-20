import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mammoth from 'mammoth';
import {htmlScenarioText} from './scenario-files.mjs';

const run = promisify(execFile);
const command = (tool, args) => run(tool, args, {timeout:60000,maxBuffer:4*1024*1024});
const pngMagic = Buffer.from('89504e470d0a1a0a','hex');
export const imageType = bytes => bytes.subarray(0,8).equals(pngMagic) ? 'png' :
  bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'jpeg' :
  /^GIF8[79]a$/.test(bytes.toString('ascii',0,6)) ? 'gif' :
  bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':'';

async function imageData(bytes, dir) {
  const type = imageType(bytes);
  if(!type)throw new Error('Invalid scenario image');
  if(type==='png'&&bytes.length>=24&&bytes.length<=850000){
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    if(width>0&&height>0&&width<=2048&&height<=2048&&width*height<=2560000)
      return `data:image/png;base64,${bytes.toString('base64')}`;
  }
  if(type==='jpeg'&&bytes.length<=850000&&dir===undefined)
    return `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const input=path.join(dir,'figure.'+type),output=path.join(dir,'figure.jpeg');
  await fs.writeFile(input,bytes);
  await command('convert',['-limit','memory','64MiB','-limit','map','128MiB','-limit','disk','0',`${type}:${input}[0]`,'-resize','1600x1600>','-background','white','-alpha','remove','-quality','82','jpeg:'+output]);
  const jpeg=await fs.readFile(output);
  if(jpeg.length>1250000)throw new Error('Scenario image exceeds the normalized size limit');
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
async function temporary(prefix, operation) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),prefix));
  try{return await operation(dir);}finally{await fs.rm(dir,{force:true,recursive:true});}
}
function attachmentName(url) {
  try {
    const decoded=decodeURIComponent(url.replace(/^\.\//,''));
    const segments=decoded.split('/');
    return !/[\\:\x00-\x1f]/.test(decoded)&&segments.every(segment=>segment&&segment!=='.'&&segment!=='..')?segments.at(-1):'';
  } catch {return '';}
}
function imagePart(source,locator,image,text='') {
  return {kind:'image',source,locator,image,text};
}
export function belongsToSection(value, section) {
  return !section || Number(value?.match(/^(?:情境|scenario)\s*(\d+)/i)?.[1])===section;
}
export async function extractRagAssets(file,attachments=[],section) {
  const extension=path.extname(file.name).toLowerCase();
  if(!['.pdf','.html','.htm','.docx'].includes(extension))return [];
  return temporary('ivr-rag-assets-',async dir=>{
    const assets=[];
    if(extension==='.pdf'){
      const info=(await command('pdfinfo',[file.path])).stdout;
      const count=Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
      if(!Number.isInteger(count)||count<1||count>100)throw new Error('Visual RAG supports PDFs with 1–100 pages');
      const {stdout}=await command('pdftotext',['-layout',file.path,'-']);
      const pages=stdout.split('\f');
      const prefix=path.join(dir,'page');
      await command('pdftoppm',['-scale-to','1600','-jpeg',file.path,prefix]);
      const rendered=(await fs.readdir(dir)).filter(name=>/^page-\d+\.jpg$/.test(name))
        .sort((left,right)=>Number(left.match(/\d+/)[0])-Number(right.match(/\d+/)[0]));
      for(const name of rendered){
        const page=Number(name.match(/\d+/)[0]),locator=`page ${page}`;
        const lines=(pages[page-1]??'').split('\n').map(line=>line.trim()).filter(Boolean);
        assets.push({kind:'page',source:file.name,locator,image:await imageData(await fs.readFile(path.join(dir,name)))});
        if(lines.length)assets.push({kind:'text',source:file.name,locator,text:lines.join('\n')});
        const tableRows=lines.filter(line=>/\S {3,}\S/.test(line)).map(line=>line.split(/ {3,}/).join(' | '));
        if(tableRows.length>=2)assets.push({kind:'table',source:file.name,locator,text:tableRows.join('\n')});
      }
      if(rendered.length!==count)throw new Error('PDF renderer did not return every page');
      const list=(await command('pdfimages',['-list',file.path])).stdout.split('\n').slice(2).map(line=>line.trim().split(/\s+/)).filter(row=>/^\d+$/.test(row[0]));
      for(const page of [...new Set(list.map(row=>Number(row[0])))]){
        const figures=list.filter(row=>Number(row[0])===page);
        // Large images remain available in the rendered page.
        if(figures.length>12||figures.some(row=>Number(row[3])*Number(row[4])>4000000))continue;
        const imagePrefix=`figure-${page}`;
        await command('pdfimages',['-f',String(page),'-l',String(page),'-png',file.path,path.join(dir,imagePrefix)]);
        const names=(await fs.readdir(dir)).filter(name=>name.startsWith(imagePrefix+'-')).sort();
        for(const [index,name] of names.entries()){
          if(figures[index]?.[2]!=='image')continue;
          assets.push(imagePart(file.name,`page ${page}, image ${index+1}`,await imageData(await fs.readFile(path.join(dir,name)),dir)));
        }
      }
    }else if(extension==='.docx'){
      let index=0;
      await mammoth.convertToHtml({path:file.path},{convertImage:mammoth.images.imgElement(async image=>{
        if(/^image\/(?:png|jpeg|gif|webp)$/.test(image.contentType)){
          const locator=`image ${++index}`;
          // Mammoth may invoke converters concurrently.
          await temporary('ivr-rag-word-',async imageDir=>{
            assets.push(imagePart(file.name,locator,await imageData(await image.readAsBuffer(),imageDir)));
          });
        }
        return {src:''};
      })});
      assets.sort((left,right)=>left.locator.localeCompare(right.locator,undefined,{numeric:true}));
    }else{
      const images=[];
      htmlScenarioText(await fs.readFile(file.path,'utf8'),images);
      const attached=new Map(attachments.map(item=>[item.name,item.path]));
      for(const [index,item] of images.entries()){
        if(!belongsToSection(item.section,section))continue;
        const inline=item.src.match(/^data:image\/(?:png|jpe?g|gif|webp);base64,([a-z0-9+/=]+)$/i);
        const filename=attached.get(attachmentName(item.src));
        if(!inline&&!filename)continue;
        const bytes=inline?Buffer.from(inline[1],'base64'):await fs.readFile(filename);
        const locator=[item.section,`image ${index+1}`].filter(Boolean).join(' / ');
        assets.push(imagePart(file.name,locator,await imageData(bytes,dir),item.text));
      }
    }
    return assets;
  });
}

export function ragItems(documents,assets) {
  const text=documents.map(document=>({
    kind:document.sheet||document.row?'table':'text',
    source:document.source,
    locator:[document.sheet,document.section,document.row&&`row ${document.row}`,document.page&&`page ${document.page}`].filter(Boolean).join(' / '),
    text:document.text,
  }));
  return [...text,...assets].flatMap(item=>{
    if(item.image)return [item];
    const chars=Array.from(item.text);
    const chunks=[];
    for(let start=0;start<chars.length;start+=550){
      const text=chars.slice(start,start+700).join('').trim();
      if(text)chunks.push({...item,text});
      if(start+700>=chars.length)break;
    }
    return chunks;
  });
}
