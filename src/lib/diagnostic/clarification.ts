import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {formSchema,type FormInput} from "../form";
import type {Question,Sources} from "./schemas";
const publicQuestion=z.object({id:z.string().regex(/^q[1-2]$/),pergunta:z.string().min(5).max(350)}).strict();
const ticketSchema=z.object({hash:z.string().length(64),expires:z.number(),perguntas:z.array(publicQuestion).min(1).max(2)}).strict();
export const requestSchema=formSchema.extend({
 esclarecimentos:z.object({token:z.string().min(1).max(5000),respostas:z.array(z.object({id:z.string().regex(/^q[1-2]$/),resposta:z.string().trim().min(1).max(1000)}).strict()).min(1).max(2)}).strict().optional()
}).strict();
function hashInput(input:FormInput){return createHash("sha256").update(JSON.stringify(formSchema.parse(input))).digest("hex");}
function sign(payload:string,secret:string){return createHmac("sha256",secret).update("rgs-clarification-v1:"+payload).digest();}
export function issueClarification(input:FormInput,questions:Question[],secret:string,now=Date.now()){
 const perguntas=questions.map(({id,pergunta})=>({id,pergunta}));
 const payload=Buffer.from(JSON.stringify(ticketSchema.parse({hash:hashInput(input),expires:now+30*60*1000,perguntas}))).toString("base64url");
 return {needs_clarification:true as const,perguntas,token:payload+"."+sign(payload,secret).toString("base64url")};
}
export function readClarification(input:FormInput,extra:NonNullable<z.infer<typeof requestSchema>["esclarecimentos"]>,secret:string,now=Date.now()):{fontes:Sources;perguntasContexto:Sources} {
 const parts=extra.token.split(".");
 if(parts.length!==2)throw new Error("invalid_ticket");
 const expected=sign(parts[0],secret),provided=Buffer.from(parts[1],"base64url");
 if(expected.length!==provided.length || !timingSafeEqual(expected,provided))throw new Error("invalid_ticket");
 const ticket=ticketSchema.parse(JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")));
 if(ticket.expires<=now || ticket.hash!==hashInput(input))throw new Error("expired_or_changed");
 if(extra.respostas.length!==ticket.perguntas.length || new Set(extra.respostas.map(a=>a.id)).size!==extra.respostas.length || extra.respostas.some(a=>!ticket.perguntas.some(q=>q.id===a.id)))throw new Error("missing_answers");
 return {
  fontes:Object.fromEntries(ticket.perguntas.map(q=>["resposta_"+q.id,extra.respostas.find(a=>a.id===q.id)!.resposta])),
  perguntasContexto:Object.fromEntries(ticket.perguntas.map(q=>["resposta_"+q.id,q.pergunta]))
 };
}