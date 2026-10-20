import {compactAssessment} from "./fixture";
import {issueClarification} from "../src/lib/diagnostic/clarification";
import {beforeEach,describe,it,expect,vi} from "vitest";
import {formSchema} from "../src/lib/form";
import {diagnosticoSchema} from "../src/lib/diagnostico";
import {RateLimiter} from "../src/lib/rate-limit";
import {BodyTooLarge,readBody} from "../src/lib/body";
import {fixture,input,stageValues,fit,question} from "./fixture";
const {parse,take}=vi.hoisted(()=>({parse:vi.fn(),take:vi.fn()}));
vi.mock("openai",()=>({default:class{responses={parse}}}));
vi.mock("../src/lib/rate-limit",async importOriginal=>({...await importOriginal<object>(),limiter:{take}}));
import {POST} from "../src/app/api/analisar/route";
const request=(body:unknown=input)=>new Request("http://localhost/api/analisar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.stubEnv("NODE_ENV","test");vi.stubEnv("OPENAI_API_KEY","test-only");vi.stubEnv("OPENAI_MODEL","test-analysis");vi.stubEnv("OPENAI_AUDIT_MODEL","test-audit");take.mockReturnValue({allowed:true});parse.mockReset();});
describe("contratos preservados",()=>{
 it("valida formulário e múltipla escolha",()=>{expect(formSchema.safeParse(input).success).toBe(true);expect(formSchema.safeParse({...input,ferramentas:[]}).success).toBe(false);expect(formSchema.safeParse({...input,processo:"curto"}).success).toBe(false);expect(formSchema.safeParse({...input,ferramentas:["CRM","CRM"]}).success).toBe(false);});
 it("rejeita campos extras e tamanhos excessivos",()=>{expect(formSchema.safeParse({...input,objetivo:"x".repeat(301)}).success).toBe(false);expect(formSchema.safeParse({...input,extra:"x"}).success).toBe(false);});
 it("exige família de IA e limita indicadores",()=>{expect(diagnosticoSchema.safeParse(fixture).success).toBe(true);expect(diagnosticoSchema.safeParse({...fixture,metricas:{...fixture.metricas,secundarias:Array(3).fill(fixture.metricas.principal)}}).success).toBe(false);});
 it("limita cinco tentativas e expira a janela",()=>{const limiter=new RateLimiter();for(let i=0;i<5;i++)expect(limiter.take("a",0).allowed).toBe(true);expect(limiter.take("a",1).allowed).toBe(false);expect(limiter.take("b",1).allowed).toBe(true);expect(limiter.take("a",600001).allowed).toBe(true);});
 it("limita corpo real sem confiar em content-length",async()=>{await expect(readBody(new Request("http://localhost",{method:"POST",body:"x".repeat(24001)}))).rejects.toBeInstanceOf(BodyTooLarge);});
});
describe("API",()=>{
 it("executa quatro chamadas, store false e modelo independente para auditoria",async()=>{
  parse.mockImplementation(async(args)=>({status:"completed",output_parsed:stageValues[args.text.format.name as keyof typeof stageValues]}));
  const r=await POST(request());expect(r.status).toBe(200);expect((await r.json()).diagnostico).toEqual(fixture);expect(parse).toHaveBeenCalledTimes(4);
  for(const [args] of parse.mock.calls)expect(args.store).toBe(false);
  expect(parse.mock.calls.at(-1)![0].model).toBe("test-audit");
  expect(parse.mock.calls[0][0].model).toBe("test-analysis");
 });
 it("retorna perguntas assinadas e conclui após resposta sem expor etapas",async()=>{
  let clarified=false;
  parse.mockImplementation(async(args)=>{
   const stage=args.text.format.name as keyof typeof stageValues;
   return {status:"completed",output_parsed:stage==="analyze_process" && !clarified?{fatos:stageValues.extract_facts,aderencia:compactAssessment({...fit,needs_clarification:true,perguntas:[question]})}:stageValues[stage]};
  });
  const first=await POST(request());const pending=await first.json();
  expect(first.status).toBe(200);expect(pending.needs_clarification).toBe(true);expect(pending).not.toHaveProperty("diagnostico");
  expect(pending.perguntas[0]).not.toHaveProperty("mudaRecomendacao");
  clarified=true;
  const second=await POST(request({...input,esclarecimentos:{token:pending.token,respostas:[{id:"q1",resposta:"Priorizar retornos."}]}}));
  expect(second.status).toBe(200);expect((await second.json()).diagnostico).toEqual(fixture);
 });
 it("não cria chat quando uma lacuna material indispensável persiste",async()=>{
  parse.mockImplementation(async(args)=>({status:"completed",output_parsed:args.text.format.name==="analyze_process"?{fatos:stageValues.extract_facts,aderencia:compactAssessment({...fit,needs_clarification:true,perguntas:[question]})}:stageValues[args.text.format.name as keyof typeof stageValues]}));
  const pending=await (await POST(request())).json();
  const second=await POST(request({...input,esclarecimentos:{token:pending.token,respostas:[{id:"q1",resposta:"Não sei."}]}}));
  expect(second.status).toBe(422);expect(await second.text()).not.toContain("diagnostico");
 });
 it("respostas de indisponibilidade concluem por HTTP com base suficiente e ressalvas",async()=>{
  const ticket=issueClarification(input,[question],"test-only");
  parse.mockImplementation(async(args)=>{
   const stage=args.text.format.name as keyof typeof stageValues;
   const value=stage==="analyze_process"?{fatos:stageValues.extract_facts,aderencia:compactAssessment({...fit,needs_clarification:true,perguntas:[question]})}:stage==="clarification_gate"?{revisoes:stageValues.clarification_gate.revisoes.map(r=>({...r,classe:"DIMENSIONAMENTO",mudancaMaterial:"nenhuma",indispensavel:false,direcaoUtilComRessalvas:true}))}:stageValues[stage];
   return {status:"completed",output_parsed:value};
  });
  for(const answer of ["não sei","não tenho","não se aplica","não consigo informar"]){
   const r=await POST(request({...input,esclarecimentos:{token:ticket.token,respostas:[{id:"q1",resposta:answer}]}}));
   expect(r.status).toBe(200);const body=await r.json();expect(body.needs_clarification).toBe(false);
   expect(body.diagnostico.validacoes.join(" ")).toContain("já é possível identificar uma direção inicial");
   expect(JSON.stringify(body)).not.toContain("As respostas ainda não permitem uma recomendação confiável");
  }
 });
 it("rejeita ticket adulterado antes de chamar IA",async()=>{
  const r=await POST(request({...input,esclarecimentos:{token:"invalid.token",respostas:[{id:"q1",resposta:"Teste."}]}}));
  expect(r.status).toBe(400);expect(parse).not.toHaveBeenCalled();
 });
 it("telemetria de desenvolvimento só registra números no servidor",async()=>{
  vi.stubEnv("NODE_ENV","development");const info=vi.spyOn(console,"info").mockImplementation(()=>{});
  try{
   parse.mockImplementation(async(args)=>({status:"completed",output_parsed:stageValues[args.text.format.name as keyof typeof stageValues],usage:{input_tokens:10,output_tokens:5,total_tokens:15}}));
   const r=await POST(request());const body=await r.json();expect(r.status).toBe(200);expect(body).not.toHaveProperty("inputTokens");expect(body).not.toHaveProperty("stages");expect(info).toHaveBeenCalledOnce();expect(info.mock.calls[0][0]).toBe("[diagnostico-usage]");expect(info.mock.calls[0][1]).toMatchObject({stages:4,inputTokens:40,outputTokens:20,totalTokens:60,usageStages:4});expect(JSON.stringify(info.mock.calls)).not.toContain(input.processo);
  }finally{info.mockRestore();}
 });
 it("não registra telemetria de desenvolvimento em produção",async()=>{
  vi.stubEnv("NODE_ENV","production");const info=vi.spyOn(console,"info").mockImplementation(()=>{});
  try{parse.mockImplementation(async(args)=>({status:"completed",output_parsed:stageValues[args.text.format.name as keyof typeof stageValues]}));expect((await POST(request())).status).toBe(200);expect(info).not.toHaveBeenCalled();}finally{info.mockRestore();}
 });
 it("rejeita formulário inválido",async()=>{expect((await POST(request({}))).status).toBe(400);expect(parse).not.toHaveBeenCalled();});
 it("rejeita corpo grande",async()=>{expect((await POST(request({x:"x".repeat(25000)}))).status).toBe(413);});
 it("retorna rate limit com retry-after",async()=>{take.mockReturnValue({allowed:false,retryAfter:42});const r=await POST(request());expect(r.status).toBe(429);expect(r.headers.get("retry-after")).toBe("42");});
 it("não expõe erros do provider",async()=>{parse.mockRejectedValue(new Error("secret token"));const r=await POST(request());expect(r.status).toBe(502);expect(await r.text()).not.toContain("secret");});
 it("não aceita resposta incompleta",async()=>{parse.mockResolvedValue({status:"incomplete",output_parsed:fixture});expect((await POST(request())).status).toBe(502);});
 it("trata chave ausente",async()=>{vi.stubEnv("OPENAI_API_KEY","");expect((await POST(request())).status).toBe(503);});
 it("trata modelo ausente sem escolher modelo arbitrário",async()=>{vi.stubEnv("OPENAI_MODEL","");vi.stubEnv("OPENAI_ANALYSIS_MODEL","");vi.stubEnv("OPENAI_AUDIT_MODEL","");expect((await POST(request())).status).toBe(503);});
 it("rejeita JSON malformado e origem externa",async()=>{expect((await POST(new Request("http://localhost/api/analisar",{method:"POST",headers:{"content-type":"application/json"},body:"{"}))).status).toBe(400);expect((await POST(new Request("http://localhost/api/analisar",{method:"POST",headers:{origin:"https://evil.example"}}))).status).toBe(403);});
});