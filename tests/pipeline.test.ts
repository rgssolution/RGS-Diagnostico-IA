import {stageResult,compactAudit} from "./fixture";
import {qualityCases} from "./quality-cases";
import {describe,it,expect,vi} from "vitest";
import type {z} from "zod";
import {validateFacts} from "../src/lib/diagnostic/extract-facts";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import type {StageCall,Stage} from "../src/lib/diagnostic/client";
import {deterministicChecks,isApproved} from "../src/lib/diagnostic/quality-gate";
import {issueClarification,readClarification} from "../src/lib/diagnostic/clarification";
import {input,stageValues,facts,fit,fixture,approved,question,candidates,selection} from "./fixture";
function scripted(overrides:Partial<Record<Stage,unknown>>={}){
 const spy=vi.fn(async(stage:Stage,schema:z.ZodType)=>schema.parse(stageResult(stage,overrides)));
 return {call:spy as StageCall,spy};
}
const context={fontes:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,Array.isArray(v)?v.join("; "):v])),fatos:facts,aderencia:fit,candidatos:candidates,selecao:selection};
describe("pipeline e bloqueios",()=>{
 it("executa as etapas na ordem e não retorna dados internos",async()=>{const {call,spy}=scripted();const r=await runPipeline(call,input);expect(r).toEqual({needs_clarification:false,diagnostico:fixture});expect(spy.mock.calls.map(c=>c[0])).toEqual(["analyze_process","solutions_selection","final_diagnosis","quality_gate"]);});
 it("auditor recebe fontes originais sem as conclusões prévias do gerador",async()=>{
  const {call,spy}=scripted();await runPipeline(call,input);
  const args=(spy.mock.calls as unknown[][]).find(c=>c[0]==="quality_gate")!;
  expect(args[3]).toHaveProperty("fontes");
  expect(args[3]).not.toHaveProperty("fatos");
  expect(args[3]).not.toHaveProperty("aderencia");
  expect(args[3]).not.toHaveProperty("selecao");
 }); it("pergunta antes de gerar candidato se falta dado crítico",async()=>{const {call,spy}=scripted({assess_ai_fit:{...fit,needs_clarification:true,perguntas:[question]}});expect((await runPipeline(call,input)).needs_clarification).toBe(true);expect(spy).toHaveBeenCalledTimes(2);});
 it("não interrompe por falta de volume para dimensionar",async()=>{const {call}=scripted();expect((await runPipeline(call,input)).needs_clarification).toBe(false);});
 it("não inventa operação quando o usuário declara desconhecer os fatos básicos",async()=>{
  const {call,spy}=scripted();
  const result=await runPipeline(call,qualityCases.find(c=>c.id==="Insuficiente")!.input);
  expect(result.needs_clarification).toBe(true);expect(spy).not.toHaveBeenCalled();
  if(result.needs_clarification)expect(result.perguntas).toHaveLength(2);
 }); it("audita e descarta pergunta que só dimensiona impacto",async()=>{
  const {call,spy}=scripted({
   assess_ai_fit:{...fit,needs_clarification:true,perguntas:[question]},
   clarification_gate:{revisoes:[{id:"q1",classe:"DIMENSIONAMENTO",mudancaMaterial:"nenhuma",indispensavel:false,direcaoUtilComRessalvas:true,justificativa:"Volume só dimensiona.",alternativaSeA:{familia:"Apoio à decisão",autonomia:"assistiva",descricao:"Não altera a natureza."},alternativaSeB:{familia:"Apoio à decisão",autonomia:"assistiva",descricao:"Não altera a natureza."}}]}
  });
  expect((await runPipeline(call,input)).needs_clarification).toBe(false);
  expect(spy).toHaveBeenCalledTimes(5);
 }); it("auditoria pode pedir esclarecimento e ocultar o rascunho",async()=>{const {call}=scripted({quality_gate:{...approved,status:"NEEDS_CLARIFICATION",perguntas:[question]}});const result=await runPipeline(call,input);expect(result.needs_clarification).toBe(true);expect(result).not.toHaveProperty("diagnostico");});
 it("revisor independente corrige uma vez sem regenerar a cadeia",async()=>{let audits=0;const {call,spy}=scripted();const wrapped:StageCall=async(stage,schema,prompt,data)=>{if(stage==="quality_gate" && audits++===0)return schema.parse(compactAudit({...approved,status:"REVISE",correcoes:["Melhore a justificativa comparativa."]}));if(stage==="revise_diagnosis")return schema.parse({alteracoes:[{campo:"solucoes.0.observacao",valor:"Primeiro teste com revisão das prioridades pela equipe."}],auditoria:stageValues.quality_gate});return call(stage,schema,prompt,data);};expect((await runPipeline(wrapped,input)).needs_clarification).toBe(false);expect(audits).toBe(1);expect(spy.mock.calls.filter(c=>c[0]==="final_diagnosis")).toHaveLength(1);});
 it("não exibe diagnóstico reprovado após revisão",async()=>{const {call,spy}=scripted({quality_gate:{...approved,status:"REVISE",correcoes:["Recomendação inadequada."]},revise_diagnosis:{alteracoes:[],auditoria:compactAudit({...approved,status:"REVISE",correcoes:["Recomendação inadequada."]})}});await expect(runPipeline(call,input)).rejects.toThrow("quality_gate_rejected");expect(spy).toHaveBeenCalledTimes(5);});
 it("APPROVED com check falso não aprova",()=>{expect(isApproved({...approved,verificacoes:{...approved.verificacoes,metrica:{ok:false,observacao:"Não mede a dor."}}},[])).toBe(false);});
 it("rejeita citação inventada e mantém proveniência literal",()=>{expect(()=>validateFacts({...facts,evidencias:[{id:"F1",campo:"processo",trecho:"Informação que não foi fornecida"}]},context.fontes)).toThrow("ungrounded_facts");});
 it("exige todas as vinte famílias, sem duplicatas",async()=>{const {call}=scripted({assess_ai_fit:{...fit,familiasAvaliadas:Array(20).fill(fit.familiasAvaliadas[0])}});await expect(runPipeline(call,input)).rejects.toThrow();});
 it("bloqueia números inventados e métricas desconectadas",()=>{expect(deterministicChecks({...fixture,recomendacao:{...fixture.recomendacao,texto:fixture.recomendacao.texto+" Economia de 85%."}},context).join()).toContain("Número não informado");expect(deterministicChecks({...fixture,metricas:{...fixture.metricas,principal:{...fixture.metricas.principal,gargalo:"Sem conexão"}}},context).join()).toContain("não referencia");});
 it("não aceita família ou candidato público divergentes",()=>{expect(deterministicChecks({...fixture,familias:{...fixture.familias,principal:"IA conversacional"}},context)).not.toHaveLength(0);});
});
describe("esclarecimentos sem chat",()=>{
 it("assina perguntas, valida respostas e expira",()=>{const ticket=issueClarification(input,[question],"test",0);const extra={token:ticket.token,respostas:[{id:"q1",resposta:"Priorizar retornos."}]};const supplement=readClarification(input,extra,"test",1);expect(supplement.fontes.resposta_q1).toBe("Priorizar retornos.");expect(supplement.fontes.resposta_q1).not.toContain(question.pergunta);expect(()=>readClarification(input,extra,"test",1800001)).toThrow();});
 it("rejeita adulteração, mudança do formulário e falta de resposta",()=>{const ticket=issueClarification(input,[question],"test");expect(()=>readClarification(input,{token:ticket.token+"x",respostas:[{id:"q1",resposta:"Teste"}]},"test")).toThrow();expect(()=>readClarification({...input,objetivo:"Outro objetivo"},{token:ticket.token,respostas:[{id:"q1",resposta:"Teste"}]},"test")).toThrow();expect(()=>readClarification(input,{token:ticket.token,respostas:[]},"test")).toThrow();});
});