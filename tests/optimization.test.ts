import {calculationControl} from "../src/lib/diagnostic/solution-policy";
import {describe,it,expect,vi,beforeEach} from "vitest";
import {z} from "zod";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import {createStageCall,createUsage,outputBudgets,type Stage,type StageCall} from "../src/lib/diagnostic/client";
import {analysisContext} from "../src/lib/diagnostic/consolidated";
import {reviseDiagnosis} from "../src/lib/diagnostic/revise-diagnosis";
import {input,facts,fit,candidates,selection,fixture,stageValues,stageResult} from "./fixture";
const {parse}=vi.hoisted(()=>({parse:vi.fn()}));
vi.mock("openai",()=>({default:class{responses={parse}}}));
const context={fontes:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,Array.isArray(v)?v.join("; "):v])),fatos:facts,aderencia:fit,candidatos:candidates,selecao:selection};
beforeEach(()=>{parse.mockReset();vi.stubEnv("OPENAI_API_KEY","test");vi.stubEnv("OPENAI_MODEL","fallback");vi.stubEnv("OPENAI_ANALYSIS_MODEL","");vi.stubEnv("OPENAI_AUDIT_MODEL","");});
function scripted(overrides:Partial<Record<Stage,unknown>>={}){const spy=vi.fn(async(stage:Stage,schema:z.ZodType)=>schema.parse(stageResult(stage,overrides)));return {call:spy as StageCall,spy};}
describe("orçamento de chamadas e contexto",()=>{
 it("aprova em quatro chamadas, sem gate de perguntas no caminho normal",async()=>{const {call,spy}=scripted();expect((await runPipeline(call,input)).needs_clarification).toBe(false);expect(spy.mock.calls.map(c=>c[0])).toEqual(["analyze_process","solutions_selection","final_diagnosis","quality_gate"]);});
 it("uma revisão corrigível usa cinco chamadas e não regenera soluções",async()=>{
  const {call,spy}=scripted({quality_gate:{...stageValues.quality_gate,status:"REVISE",correcoes:["A observação deve explicar o limite da alternativa." ]},revise_diagnosis:{alteracoes:[{campo:"solucoes.0.observacao",valor:"Revisão inicial das sugestões."},{campo:"solucoes.0.observacao",valor:"Sugere prioridades; a equipe mantém a decisão sobre cada contato."}],auditoria:stageValues.quality_gate}});
  const r=await runPipeline(call,input);expect(r.needs_clarification).toBe(false);expect(spy).toHaveBeenCalledTimes(5);expect(spy.mock.calls.filter(c=>c[0]==="solutions_selection")).toHaveLength(1);expect(spy.mock.calls.at(-1)![0]).toBe("revise_diagnosis");
 });
 it("contexto interno não replica vinte famílias e quinze justificativas sem evidência",()=>{const c=analysisContext(facts,fit);expect(c.aderencia.familiasAvaliadas).toHaveLength(1);expect(c.aderencia.dimensoes).toHaveLength(1);expect(c.fatos).not.toHaveProperty("evidencias");expect(c.evidencias).toEqual(facts.evidencias);});
 it("auditor não recebe avaliações e conclusões do redator",async()=>{const {call,spy}=scripted();await runPipeline(call,input);const data=spy.mock.calls.find(c=>c[0]==="quality_gate") as unknown[];expect(data[3]).not.toHaveProperty("analysisContext");expect(data[3]).not.toHaveProperty("selecao");expect(data[3]).toHaveProperty("fontes.processo",input.processo);});
 it("rejeita referência positiva que não existe na fonte",async()=>{const v=structuredClone(stageValues.analyze_process);v.aderencia.familiasAvaliadas[0].evidencias=["F99"];await expect(runPipeline(scripted({analyze_process:v}).call,input)).rejects.toThrow();});
 it("não permite quatro soluções na chamada consolidada",async()=>{const v={...stageValues.solutions_selection,candidatos:[...candidates.candidatos,...candidates.candidatos]};await expect(runPipeline(scripted({solutions_selection:v}).call,input)).rejects.toThrow();});
});
describe("revisão direcionada não dispensa qualidade",()=>{
 it("recusa patch de candidato ou fonte factual",async()=>{const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"recomendacao.candidatoId",valor:"C2"}],auditoria:stageValues.quality_gate}});await expect(reviseDiagnosis(call,context,fixture,["Corrigir seleção"])).rejects.toThrow();});
 it("corrige qualificador sem fonte no resumo atual sem alterar evidências",async()=>{
  const d=structuredClone(fixture);d.operacao.resumo="Processo comercial com alto volume de propostas.";
  const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"operacao.resumo",valor:facts.processo}],auditoria:stageValues.quality_gate}});
  const r=await reviseDiagnosis(call,context,d,["Classificação de volume sem referência nas fontes."]);
  expect(r.operacao.resumo).toBe(facts.processo);expect(r.gargalos).toEqual(d.gargalos);
 });
 it("schema impede remover a frase de controle ao revisar a etapa exata",async()=>{
  const d=structuredClone(fixture);d.funcionamento[0]="Regras conferem indicadores. "+calculationControl;
  const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"funcionamento.0",valor:"Regras conferem indicadores."}],auditoria:stageValues.quality_gate}});
  await expect(reviseDiagnosis(call,context,d,["Corrigir texto"])).rejects.toThrow();
 });
 it("não altera a citação literal para encobrir um fato sem fonte",async()=>{
  const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"gargalos.0.evidencia",valor:"Outra citação"}],auditoria:stageValues.quality_gate}});
  await expect(reviseDiagnosis(call,context,fixture,["Corrigir fato"])).rejects.toThrow();
 });
 it("recusa patch que apenas repete o campo existente",async()=>{
  const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"operacao.resumo",valor:fixture.operacao.resumo}],auditoria:stageValues.quality_gate}});
  await expect(reviseDiagnosis(call,context,fixture,["Corrigir descrição"])).rejects.toThrow("quality_gate_rejected");
 });
 it("recusa promessa mesmo se o auditor a aprovar",async()=>{const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"solucoes.0.observacao",valor:"Garante confiabilidade."}],auditoria:stageValues.quality_gate}});await expect(reviseDiagnosis(call,context,fixture,["Corrigir linguagem"])).rejects.toThrow("quality_gate_rejected");});
 it("recusa auditoria falsa e revisão vazia para um defeito real",async()=>{await expect(reviseDiagnosis(scripted().call,context,fixture,["Defeito real"])).rejects.toThrow("quality_gate_rejected");const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"solucoes.0.observacao",valor:"Revisão humana necessária."}],auditoria:{...stageValues.quality_gate,verificacoes:{...stageValues.quality_gate.verificacoes,iaSubstantiva:false}}}});await expect(reviseDiagnosis(call,context,fixture,["Capacidade sem IA"])).rejects.toThrow("quality_gate_rejected");});
 it("mantém o original intacto e aplica o último patch duplicado",async()=>{const before=structuredClone(fixture);const {call}=scripted({revise_diagnosis:{alteracoes:[{campo:"solucoes.0.observacao",valor:"Primeira observação."},{campo:"solucoes.0.observacao",valor:"Outra observação."}],auditoria:stageValues.quality_gate}});const result=await reviseDiagnosis(call,context,fixture,["Corrigir"]);expect(result.solucoes[0].observacao).toBe("Outra observação.");expect(fixture).toEqual(before);});
});
describe("telemetria segura e SDK",()=>{
 it("conta tokens reais quando presentes, sem guardar texto ou prompts",async()=>{parse.mockResolvedValue({status:"completed",output_parsed:{ok:true},usage:{input_tokens:100,output_tokens:20,total_tokens:120}});const usage=createUsage();await createStageCall(AbortSignal.timeout(1000),usage)("analyze_process",z.object({ok:z.boolean()}),"segredo do prompt",{usuario:"conteúdo privado"});expect(usage).toMatchObject({stages:1,inputTokens:100,outputTokens:20,totalTokens:120,usageStages:1});expect(JSON.stringify(usage)).not.toMatch(/privado|segredo/);expect(parse.mock.calls[0][0]).toMatchObject({model:"fallback",store:false,max_output_tokens:2400});});
 it("distingue usage ausente de tokens medidos e conta falha como tentativa",async()=>{parse.mockResolvedValueOnce({status:"completed",output_parsed:{ok:true}}).mockRejectedValueOnce(new Error("chave privada"));const usage=createUsage(),call=createStageCall(AbortSignal.timeout(1000),usage);await call("final_diagnosis",z.object({ok:z.boolean()}),"",{});await expect(call("quality_gate",z.object({ok:z.boolean()}),"",{})).rejects.toThrow("stage_quality_gate_invalid_response");expect(usage).toMatchObject({stages:2,usageStages:0,totalTokens:0});});
 it("preserva modelos separados, incluindo revisão no modelo auditor",async()=>{vi.stubEnv("OPENAI_ANALYSIS_MODEL","analysis");vi.stubEnv("OPENAI_AUDIT_MODEL","audit");parse.mockResolvedValue({status:"completed",output_parsed:{ok:true}});const call=createStageCall(AbortSignal.timeout(1000));for(const stage of ["solutions_selection","quality_gate","revise_diagnosis"] as const)await call(stage,z.object({ok:z.boolean()}),"",{});expect(parse.mock.calls.map(c=>c[0].model)).toEqual(["analysis","audit","audit"]);});
 it("não faz retry oculto nem entrega saída truncada",async()=>{parse.mockResolvedValue({status:"incomplete",incomplete_details:{reason:"max_output_tokens"}});await expect(createStageCall(AbortSignal.timeout(1000))("analyze_process",z.object({ok:z.boolean()}),"",{})).rejects.toThrow("incomplete_tokens");expect(parse).toHaveBeenCalledTimes(1);expect(Object.values(outputBudgets).every(n=>n<5500)).toBe(true);});
});
