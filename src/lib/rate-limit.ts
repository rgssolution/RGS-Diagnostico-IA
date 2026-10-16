const WINDOW = 10 * 60 * 1000;
const MAX = 5;
export class RateLimiter {
 private entries = new Map<string,{count:number;reset:number}>();
 take(key:string, now = Date.now()) {
  for (const [k,v] of this.entries) if (v.reset <= now) this.entries.delete(k);
  let entry = this.entries.get(key);
  if (!entry) {
   if(this.entries.size >= 10000) return {allowed:false, retryAfter:600};
   entry = {count:0,reset:now+WINDOW}; this.entries.set(key,entry);
  }
  if (entry.count >= MAX) return {allowed:false,retryAfter:Math.ceil((entry.reset-now)/1000)};
  entry.count++; return {allowed:true,retryAfter:0};
 }
}
export const limiter = new RateLimiter();