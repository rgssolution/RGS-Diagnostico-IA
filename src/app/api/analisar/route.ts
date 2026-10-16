import {formSchema} from "@/lib/form";
import {limiter} from "@/lib/rate-limit";
import {BodyTooLarge,readBody} from "@/lib/body";
import {createStageCall} from "@/lib/diagnostic/client";
import {runPipeline} from "@/lib/diagnostic/pipeline";
import {issueClarification,readClarification,requestSchema} from "@/lib/diagnostic/clarification";
export const runtime="nodejs";
export const maxDuration=300;
function reply(data:unknown,status=200,extra:Record<string,string>={}){
 return Response.json(data,{status,headers:{"Cache-Control":"no-store",...extra}});
}
export async function POST(request:Request){
 const origin=request.headers.get("origin");
 if(origin && origin!==new URL(request.url).origin)return reply({error:"Origem da solicitação não permitida."},403);
 // Preservado: Vercel sobrescreve x-vercel-forwarded-for; fora dela bucket compartilhado.
 const key=process.env.VERCEL?request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()||"shared":"local";
 const rate=limiter.take(key);
 if(!rate.allowed)return reply({error:"Você atingiu o limite de análises. Aguarde alguns minutos e tente novamente."},429,{"Retry-After":String(rate.retryAfter)});
 if(!request.headers.get("content-type")?.includes("application/json"))return reply({error:"Envie os dados no formato esperado."},415);
 let data:unknown;
 try{data=await readBody(request);}catch(e){return reply({error:e instanceof BodyTooLarge?"O formulário excede o tamanho permitido.":"Não foi possível ler o formulário."},e instanceof BodyTooLarge?413:400);}
 const parsed=requestSchema.safeParse(data);
 if(!parsed.success)return reply({error:"Revise os campos obrigatórios e os limites de tamanho."},400);
 if(!process.env.OPENAI_API_KEY)return reply({error:"A análise está temporariamente indisponível. Tente novamente mais tarde."},503);
 if(!(process.env.OPENAI_ANALYSIS_MODEL||process.env.OPENAI_MODEL) || !(process.env.OPENAI_AUDIT_MODEL||process.env.OPENAI_MODEL))return reply({error:"A análise está temporariamente indisponível. Tente novamente mais tarde."},503);
 const {esclarecimentos,...rawInput}=parsed.data;
 const input=formSchema.parse(rawInput);
 let additional={fontes:{},perguntasContexto:{}};
 if(esclarecimentos){
  try{additional=readClarification(input,esclarecimentos,process.env.OPENAI_API_KEY);}
  catch{return reply({error:"As perguntas expiraram ou o formulário mudou. Gere uma nova análise com os dados atuais."},400);}
 }
 try{
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(270000)]);
  const result=await runPipeline(createStageCall(signal),input,additional.fontes,additional.perguntasContexto);
  if(result.needs_clarification){
   // Uma rodada. Só chega aqui se a lacuna material persistir após avaliar toda a base disponível.
   if(esclarecimentos)return reply({error:"Falta esclarecer um ponto essencial sobre a natureza ou os limites da solução. Revise a descrição do processo."},422);
   return reply(issueClarification(input,result.perguntas,process.env.OPENAI_API_KEY));
  }
  if(Buffer.byteLength(JSON.stringify(result))>48000)throw new Error("output_limit");
  return reply(result);
 }catch{
  return reply({error:"Não foi possível concluir um diagnóstico aprovado agora. Suas respostas foram preservadas; tente novamente."},502);
 }
}