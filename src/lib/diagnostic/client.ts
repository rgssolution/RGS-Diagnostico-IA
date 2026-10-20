import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
export type Stage = "analyze_process"|"solutions_selection"|"revise_diagnosis"|"extract_facts"|"assess_ai_fit"|"generate_candidates"|"select_solution"|"final_diagnosis"|"quality_gate"|"clarification_gate";
export type StageCall = <T>(stage:Stage,schema:z.ZodType<T>,instructions:string,input:unknown)=>Promise<T>;
export const outputBudgets:Record<Stage,number>={analyze_process:2400,solutions_selection:2600,final_diagnosis:3200,quality_gate:1400,clarification_gate:1000,revise_diagnosis:3800,extract_facts:1800,assess_ai_fit:2400,generate_candidates:2600,select_solution:800};
export type Usage={stages:number;durationMs:number;inputTokens:number;outputTokens:number;totalTokens:number;usageStages:number};
export function createUsage(){return {stages:0,durationMs:0,inputTokens:0,outputTokens:0,totalTokens:0,usageStages:0} satisfies Usage;}
export function createStageCall(signal:AbortSignal,usage:Usage=createUsage()):StageCall {
 const client = new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:65000,maxRetries:0});
 const analysis = process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_MODEL;
 const audit = process.env.OPENAI_AUDIT_MODEL || process.env.OPENAI_MODEL;
 if(!analysis || !audit) throw new Error("model_not_configured");
 return async <T>(stage:Stage,schema:z.ZodType<T>,instructions:string,input:unknown):Promise<T>=>{
  usage.stages++;const started=Date.now();
  try {
  const response = await client.responses.parse({
   model:stage==="quality_gate" || stage==="clarification_gate" || stage==="revise_diagnosis"?audit:analysis,store:false,instructions,input:JSON.stringify(input),
   max_output_tokens:outputBudgets[stage],
   text:{format:zodTextFormat(schema,stage)}
  },{signal});
  if(response.usage){usage.usageStages++;usage.inputTokens+=response.usage.input_tokens;usage.outputTokens+=response.usage.output_tokens;usage.totalTokens+=response.usage.total_tokens;}
  if(response.status!=="completed")throw new Error(response.incomplete_details?.reason==="max_output_tokens"?"incomplete_tokens":"incomplete_response");
  if(!response.output_parsed)throw new Error("missing_parsed_response");
  const result = schema.parse(response.output_parsed);
  if(Buffer.byteLength(JSON.stringify(result))>48000) throw new Error("output_limit_"+stage);
  return result;
  }catch(e){
   const status=typeof e==="object" && e!==null && "status" in e?e.status:null;
   const own=e instanceof Error && ["incomplete_tokens","incomplete_response","missing_parsed_response","output_limit_"+stage].includes(e.message)?e.message:null;
   const kind=own || (e instanceof z.ZodError
    ? "schema_"+e.issues.map(issue=>issue.code+"_"+issue.path.join("_")).join("_").slice(0,180)
    : typeof status==="number" ? "api_status_"+status
    : e instanceof Error && /timeout|abort/i.test(e.name) ? "timeout"
    : e instanceof SyntaxError ? "invalid_json" : "invalid_response");
   // Código técnico seguro: nunca incluir mensagem, headers ou body do erro original.
   throw new Error("stage_"+stage+"_"+kind);
  }finally{usage.durationMs+=Date.now()-started;}
 };
}