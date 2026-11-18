import {promises as fs} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';

const run=promisify(execFile);

function linePositions(length,coverage){
  const lines=[];
  let start=-1;
  for(let i=0;i<=length;i++){
    if(i<length&&coverage(i)>=0.8){
      if(start===-1)start=i;
    }else if(start!==-1){
      lines.push(Math.floor((start+i-1)/2));
      start=-1;
    }
  }
  return lines;
}

function detectGrid(gray){
  const header=/^P5\s+(\d+)\s+(\d+)\s+255\s/.exec(gray.toString('ascii',0,100));
  if(!header)return null;
  const width=Number(header[1]),height=Number(header[2]);
  const pixels=gray.subarray(header[0].length);
  if(pixels.length!==width*height)return null;
  const rows=linePositions(height,y=>{
    let ink=0;
    for(let x=0;x<width;x++)if(pixels[y*width+x]<110)ink++;
    return ink/width;
  });
  if(rows.length<3||rows.length>21)return null;
  const columns=linePositions(width,x=>{
    let ink=0;
    const top=rows[0]+1,bottom=rows.at(-1);
    for(let y=top;y<bottom;y++)if(pixels[y*width+x]<110)ink++;
    return ink/(bottom-top);
  });
  if(columns.length<3||columns.length>17)return null;
  if(columns.at(-1)-columns[0]<0.7*width)return null;
  if(rows.some((y,i)=>i>0&&y-rows[i-1]<10)||columns.some((x,i)=>i>0&&x-columns[i-1]<10))return null;
  return {rows,columns,width,pixels};
}

async function tableCells(grid,dir,recognize){
  const rows=[];
  for(let row=1;row<grid.rows.length;row++){
    const y=grid.rows[row-1]+2,height=grid.rows[row]-y-1;
    const cells=[];
    for(let col=1;col<grid.columns.length;col+=4){
      const batch=[];
      for(let index=col;index<Math.min(col+4,grid.columns.length);index++){
        const x=grid.columns[index-1]+2,width=grid.columns[index]-x-1;
        const border=8,stride=width+border*2;
        const image=Buffer.alloc(stride*(height+border*2),255);
        let dark=false;
        for(let j=0;j<height;j++){
          const start=(y+j)*grid.width+x;
          const line=grid.pixels.subarray(start,start+width);
          dark ||= line.some(pixel=>pixel<100);
          line.copy(image,(j+border)*stride+border);
        }
        if(!dark){batch.push('');continue;}
        const file=path.join(dir,`cell-${row}-${index}.pgm`);
        batch.push(fs.writeFile(file,Buffer.concat([Buffer.from(`P5\n${stride} ${height+border*2}\n255\n`),image]))
          .then(()=>recognize(file,'6')));
      }
      cells.push(...await Promise.all(batch));
    }
    rows.push(cells);
    if(row===1&&cells.filter(Boolean).length<Math.max(2,Math.ceil(cells.length*0.75)))return [];
  }
  return rows;
}

export async function readScenarioImage(bytes){
  const png=bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(!png&&!jpeg)return {};
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-image-'));
  const recognize=async(file,mode)=>{
    const {stdout}=await run('tesseract',[file,'stdout','-l',process.env.OCR_LANGUAGES||'chi_tra+eng','--psm',mode],{timeout:60000,maxBuffer:1024*1024});
    return stdout.trim().replace(/(?<=\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu,'');
  };
  try{
    const file=path.join(dir,png?'image.png':'image.jpg');
    await fs.writeFile(file,bytes);
    const {stdout}=await run('convert',[(png?'png:':'jpeg:')+file,'-background','white','-alpha','remove','-colorspace','gray','-resize','2500x2500>','-depth','8','pgm:-'],{
      encoding:'buffer',timeout:30000,maxBuffer:7*1024*1024,
    });
    const grid=detectGrid(stdout);
    const rows=grid?await tableCells(grid,dir,recognize):[];
    if(rows.length>1)return {rows};
    return {text:await recognize(file,'11')};
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
