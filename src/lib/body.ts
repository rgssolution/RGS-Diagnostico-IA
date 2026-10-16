export class BodyTooLarge extends Error {}
export async function readBody(request:Request, max = 24000) {
 const declared = Number(request.headers.get("content-length"));
 if (declared > max) throw new BodyTooLarge();
 if(!request.body) throw new SyntaxError();
 const reader = request.body.getReader();
 const chunks:Uint8Array[] = []; let size = 0;
 try {
  while(true) {
   const {done,value} = await reader.read(); if(done) break;
   size += value.byteLength;
   if(size > max) { await reader.cancel(); throw new BodyTooLarge(); }
   chunks.push(value);
  }
 } finally { reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset = 0;
 for(const chunk of chunks) {bytes.set(chunk,offset); offset += chunk.length;}
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}