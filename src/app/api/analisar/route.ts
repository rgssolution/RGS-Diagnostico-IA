import {formSchema} from "@/lib/form";
import {limiter} from "@/lib/rate-limit";
import {BodyTooLarge,readBody} from "@/lib/body";
import {createStageCall,createUsage} from "@/lib/diagnostic/client";
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
 const usage=createUsage();const started=Date.now();
 try{
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(270000)]);
  const result=await runPipeline(createStageCall(signal,usage),input,additional.fontes,additional.perguntasContexto);
  if(result.needs_clarification){
   // Uma rodada. Só chega aqui se a lacuna material persistir após avaliar toda a base disponível.
   if(esclarecimentos)return reply({error:"Falta esclarecer um ponto essencial sobre a natureza ou os limites da solução. Revise a descrição do processo."},422);
   return reply(issueClarification(input,result.perguntas,process.env.OPENAI_API_KEY));
  }
  if(Buffer.byteLength(JSON.stringify(result))>48000)throw new Error("output_limit");
  return reply(result);
 }catch(error){
  const message=error instanceof Error?error.message:"unknown_error";
  // Log only known technical codes; unexpected messages may contain private data.
  const stageCode=/^stage_(?:analyze_process|solutions_selection|final_diagnosis|quality_gate|clarification_gate|revise_diagnosis|extract_facts|assess_ai_fit|generate_candidates|select_solution)_(?:api_status_[0-9]{3}|timeout|incomplete_tokens|incomplete_response|missing_parsed_response|invalid_json|invalid_response|schema_[A-Za-z0-9_]{1,180}|output_limit_(?:analyze_process|solutions_selection|final_diagnosis|quality_gate|clarification_gate|revise_diagnosis|extract_facts|assess_ai_fit|generate_candidates|select_solution))$/.test(message);
  const knownCode=["quality_gate_rejected","quality_gate_no_supported_opportunity","model_not_configured","output_limit","invalid_consultation_evidence","missing_families","invalid_family_evidence","duplicate_assessment","invalid_question_review","invalid_metric_reference","invalid_recommendation","ungrounded_facts","duplicate_candidates","candidate_evidence","candidate_consultation_evidence","candidate_consultation_scope","candidate_type","duplicate_family","unsupported_candidate_family","unsupported_ai_opportunity","invalid_clarification","invalid_duplicate_patch","invalid_noop_patch","invalid_family_label","invalid_selection"].includes(message) || /^invalid_dimension_evidence_(?:repetitividade|escala|disponibilidade|linguagemNatural|variabilidade|decisao|dadosHistorico|personalizacao|velocidade|dependenciaHumana|interpretacao|geracaoConteudo|multimodalidade|multiplasEtapas|conhecimentoInterno)_(?:unknown_ref|missing_ref|unsupported_ref)$/.test(message);
  console.error("[diagnostico-error]",stageCode || knownCode?message:"unknown_error");
  return reply({error:"Não foi possível concluir um diagnóstico aprovado agora. Suas respostas foram preservadas; tente novamente."},502);
 }finally{
  console.info("[diagnostico-usage]",{stages:usage.stages,durationMs:Date.now()-started,inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,totalTokens:usage.totalTokens,usageStages:usage.usageStages});
 }
}