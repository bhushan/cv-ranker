import { AppError } from '../errors';
import { inflateRawSync } from 'node:zlib';
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_DOCX_EXPANDED_BYTES=32*1024*1024;
function validateDocxArchive(bytes:Buffer) {
  const invalid=()=>{throw new AppError('INVALID_FILE','Choose a valid unencrypted DOCX CV with at most 32 MB of expanded content.');};
  try {
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(bytes.readUInt32LE(i)===0x06054b50 && i+22+bytes.readUInt16LE(i+20)===bytes.length) {end=i;break;}
    if(end<0) return invalid();
    const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
    if(bytes.readUInt16LE(end+4)!==0 || bytes.readUInt16LE(end+6)!==0 || bytes.readUInt16LE(end+8)!==count || !count || count>512 || start+size!==end) return invalid();
    const names=new Set<string>();let cursor=start,total=0;
    for(let i=0;i<count;i++) {
      if(cursor+46>end || bytes.readUInt32LE(cursor)!==0x02014b50) return invalid();
      const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),expanded=bytes.readUInt32LE(cursor+24),nameSize=bytes.readUInt16LE(cursor+28),extraSize=bytes.readUInt16LE(cursor+30),commentSize=bytes.readUInt16LE(cursor+32),local=bytes.readUInt32LE(cursor+42);
      if((flags&1)!==0 || (method!==0&&method!==8) || compressed===0xffffffff || expanded===0xffffffff || local===0xffffffff || bytes.readUInt16LE(cursor+34)!==0 || cursor+46+nameSize+extraSize+commentSize>end) return invalid();
      const name=bytes.subarray(cursor+46,cursor+46+nameSize).toString('utf8');
      if(!name || names.has(name) || name.startsWith('/') || name.split(/[\\/]/).includes('..')) return invalid();
      names.add(name);total+=expanded;
      if(total>MAX_DOCX_EXPANDED_BYTES || local+30>start || bytes.readUInt32LE(local)!==0x04034b50 || bytes.readUInt16LE(local+6)!==flags || bytes.readUInt16LE(local+8)!==method) return invalid();
      const localNameSize=bytes.readUInt16LE(local+26),localExtraSize=bytes.readUInt16LE(local+28),data=local+30+localNameSize+localExtraSize;
      if(data+compressed>start || bytes.subarray(local+30,local+30+localNameSize).toString('utf8')!==name) return invalid();
      const raw=bytes.subarray(data,data+compressed);
      // Verify actual output, not just attacker-controlled ZIP size declarations.
      if(method===0 ? raw.length!==expanded : inflateRawSync(raw,{maxOutputLength:Math.max(1,expanded)}).length!==expanded) return invalid();
      cursor+=46+nameSize+extraSize+commentSize;
    }
    if(cursor!==end || !names.has('[Content_Types].xml') || !names.has('word/document.xml')) return invalid();
  } catch(error) {if(error instanceof AppError)throw error;return invalid();}
}
export function validateDocument(filename: string, bytes: Buffer): 'PDF' | 'DOCX' {
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new AppError('FILE_TOO_LARGE', 'CVs must be 4 MB or smaller.');
  if (!bytes.length) throw new AppError('INVALID_FILE', 'Choose a nonempty PDF or DOCX CV.');
  if (/\.pdf$/i.test(filename) && bytes.subarray(0,5).toString()==='%PDF-') return 'PDF';
  if (/\.docx$/i.test(filename) && bytes[0]===0x50 && bytes[1]===0x4b && bytes[2]===3 && bytes[3]===4) {validateDocxArchive(bytes);return 'DOCX';}
  throw new AppError('INVALID_FILE', 'Only valid PDF and DOCX files are accepted.');
}
