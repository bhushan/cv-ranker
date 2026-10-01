import { getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { AppError } from '../errors';
import { validateDocument } from './validation';
interface PositionedText { str: string; transform: number[] }
export function arrangePdfLines(items: PositionedText[]): string {
  const rows: { y:number; parts:PositionedText[] }[]=[];
  for (const item of [...items].sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4])) {
    if (!item.str.trim()) continue;
    const y=item.transform[5];
    let row=rows.find(r=>Math.abs(r.y-y)<3);
    if (!row) {row={y,parts:[]};rows.push(row);}
    row.parts.push(item);
  }
  return rows.sort((a,b)=>b.y-a.y).map(row=>row.parts.sort((a,b)=>a.transform[4]-b.transform[4]).map(part=>part.str).join(' ').replace(/\s+/g,' ').trim()).join('\n');
}
export async function extractDocument(filename: string, bytes: Buffer): Promise<string> {
  const type = validateDocument(filename,bytes);
  try {
    let text: string;
    if (type==='PDF') {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      if(pdf.numPages>50) throw new AppError('CV_PARSE_FAILED','CVs must contain 50 pages or fewer.');
      const pages:string[]=[];
      let characters=0;
      for (let number=1;number<=pdf.numPages;number++) {
        const page=await pdf.getPage(number);
        const content=await page.getTextContent();
        if(content.items.length>20000) throw new AppError('CV_PARSE_FAILED','CV text is too complex to process. Upload a shorter, simpler document.');
        const items=content.items.filter((item):item is typeof item & PositionedText=>'str' in item && 'transform' in item);
        const pageText=arrangePdfLines(items);characters+=pageText.length;
        if(characters>100000) throw new AppError('CV_PARSE_FAILED','CV text is too long. Upload a shorter document.');
        pages.push(`[Page ${number}]\n${pageText}`);
      }
      text=pages.join('\n\n');
    } else {
      const result = await mammoth.extractRawText({buffer:bytes}); text = result.value;
    }
    if (text.replace(/\[Page \d+\]/g,'').trim().length<40 || text.length>100000) throw new Error('Unreadable document');
    return text;
  } catch(error) { if(error instanceof AppError) throw error; throw new AppError('CV_PARSE_FAILED', 'Could not read this CV. Use a text-based PDF or DOCX; scanned images are not supported.'); }
}
