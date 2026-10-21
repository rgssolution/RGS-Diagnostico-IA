import {zodTextFormat} from "openai/helpers/zod";
import {reviseDiagnosis} from "../src/lib/diagnostic/revise-diagnosis";
import {describe,it,expect,vi} from "vitest";
import type {z} from "zod";
import type {Stage,StageCall} from "../src/lib/diagnostic/client";
import {precisionErrors,calculationControl} from "../src/lib/diagnostic/solution-policy";
import {auditChecks,type Fit} from "../src/lib/diagnostic/schemas";
import {deterministicChecks,isApproved} from "../src/lib/diagnostic/quality-gate";
import {ANALYZE,SOLUTIONS,FINAL,AUDIT} from "../src/lib/diagnostic/prompts";
import {runPipeline} from "../src/lib/diagnostic/pipeline";
import {fixture,approved,facts,fit,candidates,selection,stageValues,stageResult,fitForApi} from "./fixture";
import {qualityCases} from "./quality-cases";
const financial=qualityCases.find(c=>c.id==="Financeiro")!.input;
const context={fontes:{processo:financial.processo},fatos:facts,aderencia:fit,candidatos:candidates,selecao:selection};
describe("precisão final sem aumentar chamadas",()=>{
 for(const text of ["Cobre toda a dor do processo.","Resolve completamente o problema.","Elimina o problema.","Garante redução dos erros.","Elimina o retrabalho.","Resolve integralmente o fechamento.","Benefícios garantidos.","Pode eliminar o retrabalho."])
 it("bloqueia promessa absoluta: "+text,()=>{const d=structuredClone(fixture);d.solucoes[0].observacao=text;expect(precisionErrors(d,context.fontes)).toContain("Promessa forte sem sustentação verificável.");});
 for(const text of ["Ataca diretamente os principais gargalos.","Tem potencial para reduzir o tempo de revisão.","Pode contribuir para detectar desvios.","Pode aumentar a capacidade de revisão.","Atua sobre os principais pontos identificados; validar em piloto.","Não resolve completamente o problema.","Não elimina o retrabalho.","Sem garantir redução dos erros."])
 it("permite benefício proporcional e negação: "+text,()=>{const d=structuredClone(fixture);d.solucoes[0].observacao=text;expect(precisionErrors(d,context.fontes)).toEqual([]);});
 for(const text of ["A IA reduz erros de cálculo.","A IA pode reduzir erros de cálculo.","O LLM corrige erros de cálculo."])
 it("não atribui prevenção matemática à IA: "+text,()=>{const d=structuredClone(fixture);d.oportunidade.beneficioPotencial=text;expect(precisionErrors(d,context.fontes)).toContain("Benefício matemático atribuído à IA que apenas interpreta resultados.");});
 for(const text of ["A IA identifica inconsistências e destaca anomalias.","A IA sinaliza possíveis problemas para revisão humana.","Pode reduzir retrabalho de análise e ampliar a capacidade de revisão.","As regras conferidas podem reduzir erros de cálculo; a IA interpreta os resultados.","A IA não reduz erros de cálculo."])
 it("preserva detecção, revisão e benefício das regras: "+text,()=>{const d=structuredClone(fixture);d.oportunidade.beneficioPotencial=text;expect(precisionErrors(d,context.fontes)).toEqual([]);});
 for(const check of ["causalidadeBeneficio","atribuicaoMetrica"] as const)
 it("nova falha semântica impede aprovação: "+check,()=>{expect(isApproved({...approved,verificacoes:{...approved.verificacoes,[check]:{ok:false,observacao:"Etapa fora do controle da IA ou métrica não atribuível."}}},[])).toBe(false);});
 it("mantém os 31 critérios prévios e adiciona somente dois",()=>{expect(auditChecks).toHaveLength(33);expect(auditChecks.slice(-2)).toEqual(["causalidadeBeneficio","atribuicaoMetrica"]);for(const key of ["calculoLLM","consultaContextual","mensurabilidade","bloqueioDimensionamento","promessasResponsaveis","semRedundancia"])expect(auditChecks).toContain(key);});
 it("os quatro prompts não ultrapassam o tamanho anterior",()=>{for(const [value,limit] of [[ANALYZE,2804],[SOLUTIONS,5248],[FINAL,6330],[AUDIT,6208]] as const)expect(value.length).toBeLessThanOrEqual(limit);});
 it("consulta adequada opcional precisa aparecer na evolução, sem forçar todo diagnóstico",()=>{
  const c={...context,candidatos:{candidatos:candidates.candidatos.map(x=>({...x,engenharia:{...x.engenharia,consultaLinguagemNatural:{adequada:true,motivo:"Consulta útil após validar o piloto.",evidencias:["F1"],usoProposto:"Consultar o histórico de propostas."}}}))}};
  expect(deterministicChecks(fixture,c)).toContain("Consulta útil não essencial ausente da evolução.");
  expect(deterministicChecks({...fixture,recomendacao:{...fixture.recomendacao,texto:fixture.recomendacao.texto+"\n\nEvolução possível após validação inicial: Permitir perguntas sobre o histórico em linguagem natural."}},c)).not.toContain("Consulta útil não essencial ausente da evolução.");
  expect(deterministicChecks(fixture,context)).not.toContain("Consulta útil não essencial ausente da evolução.");
 });
 it("reconhece consulta essencial em linguagem livre sem exigir análise histórica adicional",()=>{
  const c={...context,candidatos:{candidatos:candidates.candidatos.map(x=>({...x,escopoInicial:{...x.escopoInicial,consultaEssencial:true},engenharia:{...x.engenharia,consultaLinguagemNatural:{adequada:true,motivo:"Responder a pergunta do cliente.",evidencias:["F1"],usoProposto:"Responder perguntas com base no catálogo."}}}))}};
  const d=structuredClone(fixture);d.funcionamento=["IA responde perguntas interpretando linguagem livre e cruzando com o catálogo."];
  expect(deterministicChecks(d,c)).not.toContain("Consulta analítica adequada não incorporada ao workflow.");
  d.funcionamento=["Entregar classificação sem interação com o usuário."];
  expect(deterministicChecks(d,c)).toContain("Consulta analítica adequada não incorporada ao workflow.");
 });
 for(const source of ["Calcular lucro mensal","Calcular lucro em 2026"])
 it("schema da revisão financeira é serializável e mantém proteções: "+source,async()=>{
  const d=structuredClone(fixture);d.funcionamento.push(calculationControl);
  const c={...context,fontes:{processo:source}};
  const call:StageCall=async(stage,schema)=>{
   expect(()=>zodTextFormat(schema,stage)).not.toThrow();
   const patch={campo:"funcionamento."+(d.funcionamento.length-1),valor:calculationControl};
   expect(schema.safeParse({alteracoes:[patch],auditoria:stageValues.quality_gate}).success).toBe(true);
   expect(schema.safeParse({alteracoes:[{...patch,valor:"Sem a frase de proteção."}],auditoria:stageValues.quality_gate}).success).toBe(false);
   expect(schema.safeParse({alteracoes:[{...patch,valor:calculationControl+" 99"}],auditoria:stageValues.quality_gate}).success).toBe(/\d/.test(source));
   throw new Error("schema_checked");
  };
  await expect(reviseDiagnosis(call,c,d,["Verificar benefício."])).rejects.toThrow("schema_checked");
 });
 it("financeiro compõe arquitetura, benefício e métrica atribuíveis em quatro chamadas",async()=>{
  const supported=["Análise de dados","Detecção de padrões / anomalias","Apoio à decisão"];
  const assessment:Fit={...fit,aderencia:"Alta",familiasAvaliadas:fit.familiasAvaliadas.map(f=>({...f,aderencia:supported.includes(f.familia)?"Alta":"Baixa",evidencias:supported.includes(f.familia)?["F3"]:[]}))};
  const cs=candidates.candidatos.map((c,i)=>({...c,solucao:i?"Analisador de anomalias do fechamento":"Copiloto Financeiro com IA",familias:assessment.familiasAvaliadas.filter(f=>f.aderencia==="Alta").map(f=>f.familia),problema:"Tempo e retrabalho do fechamento mensal",capacidadeIA:"Interpretar indicadores, explicar variações, detectar anomalias e sintetizar resultados.",evidencias:["F3"],escopoInicial:{descricao:"Analisar indicadores conferidos e entregar síntese para revisão do gestor.",validacaoInicial:"Comparar o tempo de fechamento com escopo equivalente.",evolucoes:["Permitir perguntas sobre lucro e gastos em linguagem natural."],consultaEssencial:false},engenharia:{...c.engenharia,calculosCriticos:"Separados do modelo de linguagem",consultaLinguagemNatural:{adequada:true,motivo:"Consulta de variações útil depois do piloto.",evidencias:["F3"],usoProposto:"Perguntar por que o lucro caiu ou qual gasto mais aumentou."}}}));
  const raw={...stageValues.final_diagnosis,operacao:{fatos:["Um gestor consolida vendas e gastos e faz conferência manual."]},gargalos:[{problema:"Tempo e retrabalho do fechamento mensal",consequencia:"Pode atrasar a revisão e a compreensão dos resultados.",evidenciaId:"F3"}],oportunidade:{parteProcesso:"Revisão e análise do fechamento",capacidadeNecessaria:"Interpretar variações e destacar anomalias para revisão.",beneficioPotencial:"Pode reduzir tempo de revisão e ampliar a detecção de inconsistências."},familias:{principal:"Análise de dados",complementares:["Detecção de padrões / anomalias","Apoio à decisão"],justificativa:"A interpretação dos indicadores apoia o gestor."},solucoes:cs.map(c=>({id:c.id,solucao:c.solucao,familias:c.familias,problema:c.problema,capacidadeIA:c.capacidadeIA,impactoPotencial:c.impactoPotencial,esforco:c.esforco,observacao:"Revisão humana mantida; resultado a validar no piloto."})),recomendacao:{candidatoId:"C1",porQue:"Ataca os principais pontos de retrabalho e análise do fechamento.",valorIA:"Interpreta resultados, explica variações e identifica anomalias.",arquiteturaDeterministica:"Cálculos de receita, gastos e lucro seguem regras conferidas antes da interpretação.",resultadoPotencial:"Pode reduzir o tempo de revisão e ampliar a identificação de inconsistências."},funcionamento:{entrada:"Receber as planilhas autorizadas de vendas e gastos.",validacaoEstrutural:"Conferir campos e consistência.",deterministica:"Consolidar dados e calcular receita, gastos e lucro por regras exatas.",inteligencia:"Interpretar variações, destacar anomalias e produzir síntese executiva.",entrega:"Entregar os resultados conferidos e a análise para o gestor.",consultaLinguagemNatural:"Consultar os indicadores em linguagem natural.",validacaoHumana:"Gestor revisa a síntese e decide ações."},metricas:{principal:{finalidade:"Resultado do negócio",nome:"Tempo total dedicado ao fechamento mensal",registro:"Registrar início e fim do fechamento pelo gestor.",calculo:"Medir duração entre os marcos registrados.",comparacao:"Comparar fechamentos mensais com escopo e carga semelhantes antes e depois do piloto.",unidade:"horas"},secundarias:[]}};
  const overrides={extract_facts:{...stageValues.extract_facts,processo:financial.processo,objetivo:financial.objetivo,participantes:[financial.participantes],workflowAtual:["Consolidar vendas e gastos.","Calcular e conferir manualmente os resultados.","Montar dashboard e revisar variações."],exigeCalculoExato:true},assess_ai_fit:fitForApi(assessment),generate_candidates:{candidatos:cs},final_diagnosis:raw};
  const spy=vi.fn(async(stage:Stage,schema:z.ZodType)=>schema.parse(stageResult(stage,overrides)));
  const result=await runPipeline(spy as StageCall,financial);expect(result.needs_clarification).toBe(false);expect(spy).toHaveBeenCalledTimes(4);
  if(!result.needs_clarification){const d=result.diagnostico;expect(d.metricas.principal.nome).toBe("Tempo total dedicado ao fechamento mensal");expect(d.funcionamento.some(s=>s.includes(calculationControl))).toBe(true);expect(d.funcionamento.join(" ")).not.toContain("Consultar os indicadores");expect(d.recomendacao.texto).toContain("Evolução possível após validação inicial:");expect(precisionErrors(d,{processo:financial.processo})).toEqual([]);}
 });
});
