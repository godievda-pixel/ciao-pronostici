import { readFile } from 'node:fs/promises';

function maskStringsAndComments(source) {
  const chars=[...String(source ?? '')];
  let quote='';
  let lineComment=false;
  let blockComment=false;
  let escaped=false;
  for(let i=0;i<chars.length;i++){
    const c=chars[i],n=chars[i+1]||'';
    if(lineComment){ if(c==='\n') lineComment=false; else chars[i]=' '; continue; }
    if(blockComment){ chars[i]=' '; if(c==='*'&&n==='/'){ chars[i+1]=' '; blockComment=false; i++; } continue; }
    if(quote){
      if(escaped){ chars[i]=' '; escaped=false; continue; }
      if(c==='\\'){ chars[i]=' '; escaped=true; continue; }
      if(c===quote){ quote=''; continue; }
      chars[i]=' '; continue;
    }
    if(c==='/'&&n==='/'){ chars[i]=chars[i+1]=' '; lineComment=true; i++; continue; }
    if(c==='/'&&n==='*'){ chars[i]=chars[i+1]=' '; blockComment=true; i++; continue; }
    if(c==='\''||c==='"'||c==='`'){ quote=c; continue; }
  }
  return chars.join('');
}

function isSafeOccurrence(masked,index,token){
  const before=masked.slice(0,index);
  const after=masked.slice(index+token.length);
  const prev=before.match(/\S\s*$/)?.[0]?.trim()||'';
  const next=after.match(/^\s*\S/)?.[0]?.trim()||'';
  if(prev==='.') return true;
  if(next===':') return true;
  const prefix=before.slice(Math.max(0,before.length-24));
  if(/\b(?:const|let|var)\s+$/.test(prefix)) return true;
  return false;
}

export function findUnsafeDisplayNameReferences(source){
  const raw=String(source ?? '');
  const masked=maskStringsAndComments(raw);
  const token='display_name';
  const out=[];
  for(let from=0;;){
    const index=masked.indexOf(token,from);
    if(index<0)break;
    if(!isSafeOccurrence(masked,index,token)){
      out.push({
        index,
        excerpt:raw.slice(Math.max(0,index-80),Math.min(raw.length,index+token.length+80)),
      });
    }
    from=index+token.length;
  }
  return out;
}

export function inspectTelegramProfileFlow(source){
  const raw=String(source ?? '');
  return {
    unsafeDisplayNameReferences:findUnsafeDisplayNameReferences(raw),
    stateDisplayNameReferences:(raw.match(/(?:user|row|storedUser|dbUser)(?:\?\.)?\.display_name/g)||[]).length,
    telegramIdentityAnchors:(raw.match(/telegram_id|telegramId|tgu\.id|telegramUserId/g)||[]).length,
  };
}

if(process.argv[1]&&process.argv[2]){
  const source=await readFile(process.argv[2],'utf8');
  console.log(JSON.stringify(inspectTelegramProfileFlow(source),null,2));
}
