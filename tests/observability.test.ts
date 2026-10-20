import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {input,fixture} from "./fixture";
const {run}=vi.hoisted(()=>({run:vi.fn()}));
vi.mock("../src/lib/diagnostic/pipeline",()=>({runPipeline:run}));
vi.mock("../src/lib/rate-limit",()=>({limiter:{take:()=>({allowed:true})}}));
vi.mock("../src/lib/diagnostic/client",async original=>({...await original<object>(),createStageCall:()=>vi.fn()}));
import {POST} from "../src/app/api/analisar/route";
const request=()=>new Request("http://localhost/api/analisar",{method:"POST",headers:{"content-type":"application/json","x-private-header":"header-secret"},body:JSON.stringify(input)});
beforeEach(()=>{vi.stubEnv("NODE_ENV","production");vi.stubEnv("OPENAI_API_KEY","key-secret");vi.stubEnv("OPENAI_MODEL","test");run.mockReset();vi.spyOn(console,"info").mockImplementation(()=>{});vi.spyOn(console,"error").mockImplementation(()=>{});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
for(const code of ["stage_analyze_process_api_status_429","stage_solutions_selection_timeout","stage_final_diagnosis_incomplete_tokens","stage_quality_gate_missing_parsed_response","quality_gate_rejected","invalid_metric_reference","stage_analyze_process_schema_invalid_type_fatos_processo"]){
 it("preserva código técnico em produção: "+code,async()=>{
  run.mockRejectedValue(Object.assign(new Error(code),{evaluation:[input.processo],headers:{authorization:"key-secret"},response:"provider-private-output"}));
  const r=await POST(request());expect(r.status).toBe(502);expect(await r.json()).toEqual({error:"Não foi possível concluir um diagnóstico aprovado agora. Suas respostas foram preservadas; tente novamente."});
  expect(console.error).toHaveBeenCalledExactlyOnceWith("[diagnostico-error]",code);expect(console.info).toHaveBeenCalledOnce();
  const logs=JSON.stringify([vi.mocked(console.error).mock.calls,vi.mocked(console.info).mock.calls]);for(const value of [input.processo,"key-secret","header-secret","provider-private-output"])expect(logs).not.toContain(value);
 });
}
for(const value of [new Error("email cliente@example.com; API key sk-private; prompt privado"),new Error("quality_gate_rejected\nrespostas privadas"),new Error("stage_unknown_api_status_429"),{message:"dados pessoais"},null]){
 it("não registra mensagens ou objetos inesperados",async()=>{run.mockRejectedValue(value);expect((await POST(request())).status).toBe(502);expect(console.error).toHaveBeenCalledExactlyOnceWith("[diagnostico-error]","unknown_error");});
}
it("em produção registra somente os seis números e não muda payload de sucesso",async()=>{
 run.mockResolvedValue({needs_clarification:false,diagnostico:fixture});const r=await POST(request());expect(r.status).toBe(200);expect(await r.json()).toEqual({needs_clarification:false,diagnostico:fixture});expect(console.error).not.toHaveBeenCalled();
 expect(console.info).toHaveBeenCalledExactlyOnceWith("[diagnostico-usage]",{stages:0,durationMs:expect.any(Number),inputTokens:0,outputTokens:0,totalTokens:0,usageStages:0});
});
