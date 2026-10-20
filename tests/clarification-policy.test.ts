import {stageResult,compactAssessment} from "./fixture";
import {describe,it,expect,vi} from "vitest";
import {z} from "zod";
import {runPipeline,initialDirection} from "../src/lib/diagnostic/pipeline";
import {reviewClarifications} from "../src/lib/diagnostic/clarification-gate";
import {questionsSchema} from "../src/lib/diagnostic/schemas";
import {clarificationResponseSchema} from "../src/lib/diagnostic/public-contract";
import {issueClarification,requestSchema} from "../src/lib/diagnostic/clarification";
import type {Stage,StageCall} from "../src/lib/diagnostic/client";
import {stageValues,fitForApi,fit,candidates,question,input} from "./fixture";
import {qualityCases} from "./quality-cases";
const financial={...qualityCases.find(s=>s.id==="Financeiro")!.input,decisoes:"Não consigo dar exemplo de decisão contextual."};
const contextQuestion={id:"q1",pergunta:"Pode dar um exemplo de decisão contextual tomada no fechamento?",mudaRecomendacao:"Aprofundar a interpretação dos resultados."};
const alternative={familia:"Análise de dados",autonomia:"assistiva",descricao:"Interpretar os indicadores conferidos, com decisão humana."};
const dimensionReview={id:"q1",classe:"DIMENSIONAMENTO",mudancaMaterial:"nenhuma",indispensavel:false,direcaoUtilComRessalvas:true,justificativa:"O fechamento e o dashboard já permitem recomendar análise; exemplo apenas aprofunda.",alternativaSeA:alternative,alternativaSeB:alternative};
function values(){
 const supported=["Análise de dados","Detecção de padrões / anomalias","Apoio à decisão"];
 const financialFit={...fit,aderencia:"Alta" as const,familiasAvaliadas:fit.familiasAvaliadas.map(f=>({...f,aderencia:supported.includes(f.familia)?"Alta" as const:"Baixa" as const,evidencias:supported.includes(f.familia)?["F3"]:[]}))};
 const c=candidates.candidatos.map(x=>({...x,escopoInicial:{descricao:"Interpretar o fechamento conferido e destacar variações para o gestor.",validacaoInicial:"Comparar o tempo de análise do fechamento em ciclos equivalentes.",evolucoes:["Consultar indicadores por perguntas em linguagem natural."],consultaEssencial:false},solucao:x.id==="C1"?"Copiloto Financeiro com IA":"Analisador de variações financeiras",familias:financialFit.familiasAvaliadas.filter(f=>f.aderencia==="Alta").map(f=>f.familia),problema:"Consolidação e conferência manuais demoradas.",capacidadeIA:"Interpretar indicadores, identificar variações e anomalias e produzir síntese executiva.",evidencias:["F3"],engenharia:{...x.engenharia,calculosCriticos:"Separados do modelo de linguagem",papelDeterministico:"Validar dados e calcular faturamento, custos e lucro por regras conferidas."}}));
 const v={...stageValues,
  extract_facts:{...stageValues.extract_facts,processo:financial.processo,objetivo:financial.objetivo,workflowAtual:["Receber vendas e custos.","Consolidar e conferir dados manualmente.","Calcular indicadores e montar dashboard."],decisoes:[financial.decisoes]},
  assess_ai_fit:fitForApi({...financialFit,needs_clarification:true,perguntas:[contextQuestion]}),
  generate_candidates:{candidatos:c},
  final_diagnosis:{...stageValues.final_diagnosis,
   solucoes:c.map(x=>({id:x.id,solucao:x.solucao,familias:x.familias,problema:x.problema,capacidadeIA:x.capacidadeIA,impactoPotencial:x.impactoPotencial,esforco:x.esforco,observacao:x.coberturaDaDor})),
   familias:{principal:"Análise de dados",complementares:["Detecção de padrões / anomalias","Apoio à decisão"],justificativa:"A leitura dos indicadores e do dashboard sustenta interpretação e análise de variações."},
   gargalos:[{problema:"Consolidação e conferência manuais demoradas.",consequencia:"Pode atrasar a interpretação do fechamento.",evidenciaId:"F3"}],
   recomendacao:{candidatoId:"C1",porQue:"O fechamento e o dashboard sustentam uma direção de análise útil, mesmo sem exemplo de decisão.",valorIA:"Interpretar variações, padrões e anomalias e sintetizar resultados para decisão humana.",arquiteturaDeterministica:"Consolidação e cálculos financeiros por regras conferidas, antes da interpretação pela IA.",resultadoPotencial:"Pode reduzir esforço de análise; benefício a validar no piloto."},
   funcionamento:{entrada:"Receber vendas e custos autorizados.",validacaoEstrutural:"Conferir campos e estrutura.",deterministica:"Calcular faturamento, custos, lucro e indicadores por regras conferidas.",inteligencia:"Analisar variações, tendências e anomalias entre meses.",entrega:"Produzir síntese executiva e atualizar a visão analítica do dashboard.",consultaLinguagemNatural:"Quando pertinente, usuário consulta os resultados em linguagem natural com fontes.",validacaoHumana:"Equipe revisa divergências e decide ações."},
   preRequisitos:["Dados autorizados e regras de cálculo conferidas."],
   metricas:{principal:{finalidade:"Resultado do negócio",nome:"Tempo de fechamento mensal",registro:"Registrar início e fim do fechamento.",calculo:"Calcular duração entre os marcos registrados.",comparacao:"Comparar ciclos equivalentes antes e depois do piloto.",unidade:"horas"},secundarias:[]}},
  clarification_gate:{revisoes:[dimensionReview]}
 };
 return v;
}
function scripted(overrides:Partial<Record<Stage,unknown>>={}){
 const base=values();
 const spy=vi.fn(async(stage:Stage,schema:z.ZodType)=>schema.parse(stageResult(stage,{...base,...overrides,analyze_process:undefined,solutions_selection:undefined})));
 return {call:spy as StageCall,spy};
}
describe("esclarecimento material, no máximo duas perguntas",()=>{
 for(const answer of ["não sei","não tenho","não se aplica","não consigo informar"])
 it("financeiro continua com ressalvas após resposta: "+answer,async()=>{
  const {call,spy}=scripted();const r=await runPipeline(call,financial,{resposta_q1:answer},{resposta_q1:contextQuestion.pergunta});
  expect(r.needs_clarification).toBe(false);
  if(!r.needs_clarification){expect(r.diagnostico.familias.principal).toBe("Análise de dados");expect(r.diagnostico.validacoes).toContain(initialDirection);expect(r.diagnostico.validacoes.join(" ")).toContain(contextQuestion.pergunta);expect(r.diagnostico.recomendacao.texto).toContain("Copiloto Financeiro");}
  const review=spy.mock.calls.find(c=>c[0]==="clarification_gate") as unknown[];
  expect(review[3]).toHaveProperty("perguntasContexto.resposta_q1",contextQuestion.pergunta);
 });
 it("não pede exemplo de decisão se a base já permite análise",async()=>{const {call}=scripted();expect((await runPipeline(call,financial)).needs_clarification).toBe(false);});
 it("descarta pedidos de volume, esforço, custo, ROI, prioridade fina e profundidade em todas as etapas",async()=>{
  for(const gap of ["volume","esforço","custo","ROI","prioridade fina","profundidade"]){
   const q={...contextQuestion,pergunta:"Pode informar o detalhamento de "+gap+"?"};
   const {call}=scripted({assess_ai_fit:{...values().assess_ai_fit,perguntas:[q]},select_solution:{...stageValues.select_solution,needs_clarification:true,perguntas:[q]}});
   const r=await runPipeline(call,financial);expect(r.needs_clarification).toBe(false);if(!r.needs_clarification)expect(r.diagnostico.validacoes.join(" ")).toContain(gap);
  }
 });
 it("pedido não material persistente da auditoria não esgota revisão nem impede entrega",async()=>{
  const {call,spy}=scripted({quality_gate:{...stageValues.quality_gate,status:"NEEDS_CLARIFICATION",perguntas:[contextQuestion]}});
  const r=await runPipeline(call,financial);expect(r.needs_clarification).toBe(false);
  expect(spy.mock.calls.filter(c=>c[0]==="revise_diagnosis")).toHaveLength(1);
 });
 it("não ignora defeito real de qualidade junto ao pedido não material",async()=>{
  const {call}=scripted({quality_gate:{...stageValues.quality_gate,status:"NEEDS_CLARIFICATION",perguntas:[contextQuestion],verificacoes:{...stageValues.quality_gate.verificacoes,metrica:false}}});
  await expect(runPipeline(call,financial)).rejects.toThrow("quality_gate_rejected");
 });
 for(const change of ["solucao","risco","arquitetura"])
 it("permite pergunta material sobre "+change+" mesmo sem trocar família ou autonomia",async()=>{
  const review={...dimensionReview,classe:"CRITICA",mudancaMaterial:change,indispensavel:true,direcaoUtilComRessalvas:false,alternativaSeB:{...alternative,descricao:"Outro desenho essencial depende da resposta, com proteção operacional distinta."}};
  const {call}=scripted({clarification_gate:{revisoes:[review]}});
  expect(await reviewClarifications(call,{processo:financial.processo},[contextQuestion])).toHaveLength(1);
 });
 it("diferença hipotética não é indispensável se há direção segura com ressalvas",async()=>{
  const {call}=scripted({clarification_gate:{revisoes:[{...dimensionReview,classe:"CRITICA",mudancaMaterial:"familia",indispensavel:true,alternativaSeB:{...alternative,familia:"Geração de texto"}}]}});
  expect(await reviewClarifications(call,{processo:financial.processo},[contextQuestion])).toEqual([]);
 });
 it("reavalia classificação conservadora antes de pedir outro exemplo",async()=>{
  let assessments=0;const {call}=scripted();
  const wrapped:StageCall=async(stage,schema,prompt,data)=>{
   if(stage==="analyze_process" && assessments++===0)return schema.parse({fatos:values().extract_facts,aderencia:compactAssessment({...fit,familiasAvaliadas:fit.familiasAvaliadas.map(f=>({...f,aderencia:"Baixa" as const,evidencias:[]}))})});
   return call(stage,schema,prompt,data);
  };
  expect((await runPipeline(wrapped,financial)).needs_clarification).toBe(false);expect(assessments).toBe(2);
 });
 it("limita perguntas e respostas também no contrato público e ticket assinado",()=>{
  const qs=[question,{...question,id:"q2"}];
  expect(questionsSchema.safeParse(qs).success).toBe(true);
  expect(questionsSchema.safeParse([...qs,{...question,id:"q3"}]).success).toBe(false);
  expect(()=>issueClarification(input,[...qs,{...question,id:"q3"}],"test")).toThrow();
  const ticket=issueClarification(input,qs,"test");expect(clarificationResponseSchema.safeParse(ticket).success).toBe(true);
  expect(requestSchema.safeParse({...input,esclarecimentos:{token:ticket.token,respostas:[{id:"q1",resposta:"não sei"},{id:"q2",resposta:"não tenho"},{id:"q3",resposta:"não se aplica"}]}}).success).toBe(false);
 });
 it("o novo check provoca revisão e segue com diagnóstico em vez de pedir mais contexto",async()=>{
  let audits=0;const {call}=scripted();
  const wrapped:StageCall=async(stage,schema,prompt,data)=>{
   if(stage==="quality_gate" && audits++===0)return schema.parse({...stageValues.quality_gate,status:"REVISE",verificacoes:{...stageValues.quality_gate.verificacoes,bloqueioDimensionamento:false},correcoes:["Continuar a direção inicial e registrar o detalhamento como validação." ]});
   if(stage==="revise_diagnosis")return schema.parse({alteracoes:[{campo:"solucoes.0.observacao",valor:"Teste inicial com interpretação dos indicadores conferidos e revisão humana."}],auditoria:stageValues.quality_gate});
   return call(stage,schema,prompt,data);
  };
  const r=await runPipeline(wrapped,financial);expect(r.needs_clarification).toBe(false);expect(audits).toBe(1);
 });

 it("correções que só repetem pedidos de contexto não bloqueiam após revisão independente",async()=>{
  const {call}=scripted({quality_gate:{...stageValues.quality_gate,status:"NEEDS_CLARIFICATION",perguntas:[contextQuestion],correcoes:["Validar o volume antes de dimensionar esforço e custo."]},assess_ai_fit:{...values().assess_ai_fit,needs_clarification:false,perguntas:[]},clarification_gate:{revisoes:[dimensionReview],correcoesApenasContexto:true}});
  expect((await runPipeline(call,financial)).needs_clarification).toBe(false);
 });
 it("preserva correção real mesmo com todos os checks marcados verdadeiros",async()=>{
  const {call}=scripted({quality_gate:{...stageValues.quality_gate,status:"NEEDS_CLARIFICATION",perguntas:[contextQuestion],correcoes:["Corrigir uma atribuição indevida de cálculo ao modelo."]},assess_ai_fit:{...values().assess_ai_fit,needs_clarification:false,perguntas:[]},clarification_gate:{revisoes:[dimensionReview],correcoesApenasContexto:false}});
  await expect(runPipeline(call,financial)).rejects.toThrow("quality_gate_rejected");
 });

});
