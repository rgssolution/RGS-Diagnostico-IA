import {evaluateQuality} from "./quality-evaluator";
import {describe,it,expect} from "vitest";
import {precisionErrors,criticalCalculations} from "../src/lib/diagnostic/solution-policy";
import {deterministicChecks,isApproved} from "../src/lib/diagnostic/quality-gate";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import type {StageCall} from "../src/lib/diagnostic/client";
import {fixture,input,stageValues,candidates,approved,facts,fit,selection} from "./fixture";
import {qualityCases} from "./quality-cases";
const sources={processo:input.processo};
describe("precisão técnica e linguagem responsável",()=>{
 for(const claim of ["A IA calcula o faturamento.","A IA realiza os cálculos financeiros.","A IA cruza os dados e calcula o lucro.","O LLM soma os valores."])
 it("rejeita cálculo pelo modelo: "+claim,()=>{const d=structuredClone(fixture);d.funcionamento.push(claim);expect(precisionErrors(d,sources)).toContain("Cálculo crítico atribuído ao modelo de linguagem.");});
 for(const claim of ["Elimina a maior parte do trabalho.","Reduz substancialmente o retrabalho.","Garante confiabilidade.","Traz benefícios imediatos.","Cobre integralmente os gargalos.","Reduz drasticamente o trabalho."])
 it("rejeita promessa forte: "+claim,()=>{const d=structuredClone(fixture);d.solucoes[0].observacao=claim;expect(precisionErrors(d,sources)).toContain("Promessa forte sem sustentação verificável.");});
 for(const quantity of ["3 meses","100 registros","50 atendimentos","6 meses","três meses","cem registros"])
 it("rejeita requisito quantitativo inventado: "+quantity,()=>{const d=structuredClone(fixture);d.preRequisitos=["É necessário histórico de "+quantity];expect(precisionErrors(d,{processo:"Disponibilidade solicitada 24x7; equipe de 3 pessoas."})).toContain("Pré-requisito quantitativo sem base nas fontes.");});
 it("aceita base representativa sem impor mínimo e separação responsável",()=>{const d=structuredClone(fixture);d.preRequisitos=["Histórico suficiente para estabelecer padrões, validado no piloto."];d.funcionamento.push("A IA somente interpreta os resultados; as regras calculam os indicadores. O piloto não garante confiabilidade.");expect(precisionErrors(d,sources)).toEqual([]);});
 it("não confunde numeral em outra unidade com requisito de histórico",()=>{const d=structuredClone(fixture);d.preRequisitos=["Histórico de 6 meses."];expect(precisionErrors(d,{processo:"Temos 6 pessoas e não sabemos a extensão do histórico."})).not.toEqual([]);expect(precisionErrors(d,{processo:"O histórico disponível e autorizado é de 6 meses."})).toEqual([]);});
 it("rejeita métrica apenas descritiva",()=>{const d=structuredClone(fixture);d.metricas.principal.comoMedir="Comparar em linguagem descritiva.";expect(precisionErrors(d,sources)).toContain("Métrica sem medição objetiva.");});
 for(const sample of qualityCases.filter(s=>!s.clarify))it("aplica limites de precisão em "+sample.id,()=>{
  const d=structuredClone(fixture);d.recomendacao.texto+=" Garante confiabilidade.";expect(precisionErrors(d,{processo:sample.input.processo})).not.toEqual([]);
 });
 for(const check of ["calculoLLM","quantidadesJustificadas","promessasResponsaveis","capacidadeNegocio","inteligenciaExplicita","arquiteturaSeparada","consultaContextual","mensurabilidade"] as const)
 it("reprova auditoria com novo critério falso: "+check,()=>{expect(isApproved({...approved,verificacoes:{...approved.verificacoes,[check]:{ok:false,observacao:"Requer revisão."}}},[])).toBe(false);});
 it("detecta obrigações exatas também fora de finanças",()=>{for(const text of ["Saldo de estoque","Consolidação tabular","Regras fiscais","Validações objetivas","Agrupamentos e filtros"])expect(criticalCalculations({processo:text})).toBe(true);});
 it("ordena validação, cálculo, inteligência e revisão na saída auditada",async()=>{
  let reviewed:string[]=[];
  const call:StageCall=async(stage,schema,_prompt,data)=>{
   if(stage==="quality_gate")reviewed=(data as {diagnostico:typeof fixture}).diagnostico.funcionamento;
   const value=stage==="generate_candidates"?{candidatos:candidates.candidatos.map(c=>({...c,engenharia:{...c.engenharia,calculosCriticos:"Separados do modelo de linguagem"}}))}:stage==="final_diagnosis"?{...stageValues.final_diagnosis,funcionamento:{entrada:"Receber vendas e custos autorizados.",validacaoEstrutural:"Conferir campos e integridade.",deterministica:"Calcular faturamento e lucro por regras conferidas.",inteligencia:"Interpretar tendências sobre os indicadores conferidos.",entrega:"Entregar síntese com fontes.",consultaLinguagemNatural:null,validacaoHumana:"Pessoa revisa exceções e decide."}}:stageValues[stage];
   return schema.parse(value);
  };
  const r=await runPipeline(call,{...input,processo:input.processo+" Calcular lucro."});expect(r.needs_clarification).toBe(false);
  expect(reviewed[1]).toContain("integridade");expect(reviewed[2]).toContain("regras conferidas");expect(reviewed[3]).toContain("Interpretar");expect(reviewed.at(-1)).toContain("revisa");
  if(!r.needs_clarification){expect(r.diagnostico.funcionamento).toEqual(reviewed);for(const label of ["Por que essa solução:","Como a IA agrega valor:","Como a arquitetura deve funcionar:","Resultado potencial:"])expect(r.diagnostico.recomendacao.texto).toContain(label);expect(r.diagnostico.metricas.principal.comoMedir).toContain("Unidade:");}
 });
 it("exige consulta quando avaliada como adequada e não a força em criação de conteúdo",()=>{
  const c={fontes:sources,fatos:facts,aderencia:fit,selecao:selection,candidatos:{candidatos:candidates.candidatos.map(x=>({...x,escopoInicial:{...x.escopoInicial,consultaEssencial:true},engenharia:{...x.engenharia,consultaLinguagemNatural:{adequada:true,motivo:"Consulta analítica útil para comparar resultados.",evidencias:["F1"],usoProposto:"Consultar os dados com fontes."}}}))}};
  expect(deterministicChecks(fixture,c)).toContain("Consulta analítica adequada não incorporada ao workflow.");
  const d={...fixture,funcionamento:[...fixture.funcionamento,"Usuário consulta os resultados em linguagem natural, com fontes e permissões."]};
  expect(deterministicChecks(d,c)).not.toContain("Consulta analítica adequada não incorporada ao workflow.");
  expect(deterministicChecks(fixture,{...c,candidatos:candidates})).toEqual([]);
 });
 it("revisa uma promessa reprovada pelo servidor mesmo quando o auditor marca APPROVED",async()=>{
  let drafts=0;
  const call:StageCall=async(stage,schema)=>{
   if(stage==="final_diagnosis"){
    drafts++;
    return schema.parse(drafts===1?{...stageValues.final_diagnosis,recomendacao:{...stageValues.final_diagnosis.recomendacao,resultadoPotencial:"Garante confiabilidade."}}:stageValues.final_diagnosis);
   }
   return schema.parse(stageValues[stage]);
  };
  const result=await runPipeline(call,input);expect(drafts).toBe(2);expect(result.needs_clarification).toBe(false);
  if(!result.needs_clarification)expect(result.diagnostico.recomendacao.texto).not.toContain("Garante confiabilidade");
 });

 it("projeta o workflow atual da extração, sem usar o fluxo futuro da composição",async()=>{
  const call:StageCall=async(stage,schema)=>schema.parse(stageValues[stage]);
  const r=await runPipeline(call,input);expect(r.needs_clarification).toBe(false);
  if(!r.needs_clarification){expect(r.diagnostico.operacao.workflow).toEqual(facts.workflowAtual);expect(r.diagnostico.operacao.resumo).toBe(facts.processo);expect(r.diagnostico.operacao.workflow).not.toEqual(r.diagnostico.funcionamento);}
 });

 it("reconhece busca contextual e identificação de intenção sem aceitar cópia mecânica",()=>{
  const sample=qualityCases.find(c=>c.id==="Atendimento")!;
  const d=structuredClone(fixture);
  d.solucoes[0].capacidadeIA="Busca e apresenta informação do catálogo, adaptando resposta ao contexto da conversa.";
  d.solucoes[1].capacidadeIA="Responde dúvidas, identifica casos de negociação ou exceção e encaminha ao humano.";
  expect(evaluateQuality(sample,{needs_clarification:false,diagnostico:d})).not.toContain("Capacidade inteligente não descrita.");
  d.solucoes[0].capacidadeIA="Copiar campos por uma regra fixa.";
  expect(evaluateQuality(sample,{needs_clarification:false,diagnostico:d})).toContain("Capacidade inteligente não descrita.");
 });

});
