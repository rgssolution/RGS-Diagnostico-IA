import {z} from "zod";
import {text,family,type Question,type Sources} from "./schemas";
import {BASE} from "./prompts";
import type {StageCall} from "./client";
export async function reviewClarificationsDetailed(call:StageCall,fontes:Sources,perguntas:Question[],perguntasContexto:Sources={},correcoes:string[]=[]){
 const ids=perguntas.map(q=>q.id) as [string,...string[]];
 const alternative=z.object({familia:family,autonomia:z.enum(["assistiva","execução supervisionada","execução autorizada"]),descricao:text}).strict();
 const baseSchema=z.object({revisoes:z.array(z.object({
  id:z.enum(ids),alternativaSeA:alternative,alternativaSeB:alternative,
  mudancaMaterial:z.enum(["familia","solucao","autonomia","risco","arquitetura","nenhuma"]),indispensavel:z.boolean(),direcaoUtilComRessalvas:z.boolean(),
  justificativa:text,classe:z.enum(["CRITICA","DIMENSIONAMENTO","JA_RESPONDIDA"])
 }).strict()).length(ids.length)}).strict();
 const schema=correcoes.length?baseSchema.extend({correcoesApenasContexto:z.boolean()}):baseSchema;
 const result=await call("clarification_gate",schema,BASE+`
AUDITOR DE NECESSIDADE DE PERGUNTAS. Reavalie cada pergunta com as fontes originais.
CRITICA somente se indispensavel=true, direcaoUtilComRessalvas=false e a resposta muda materialmente família, solução principal, autonomia, risco operacional/sensível ou arquitetura essencial. Declare alternativas tecnicamente distintas em alternativaSeA e alternativaSeB, cada uma com família e autonomia. Não invente alternativa que contrarie os limites do empresário.
DIMENSIONAMENTO: quantidade, volume, taxa atual, tempo atual, pico, frequência, esforço, custo, ROI, prioridade fina, profundidade, custo-benefício, urgência, ganho e tamanho da equipe que só dimensionam impacto. Nunca bloquear descoberta da oportunidade por isso. Use a mesma família/autonomia nas duas alternativas.
JA_RESPONDIDA: a fonte já esclarece o ponto, inclusive revisão humana, API disponível, base existente ou funcionamento fora do horário. Não repetir.
Detalhes de implementação (endpoints, fornecedor, autenticação, orçamento) são pré-requisitos/validações, não bloqueiam a natureza da recomendação.
Tipos específicos de dúvidas e subtarefas dentro de uma oportunidade clara definem escopo do piloto, não nova família. Se já há dor e capacidade claras, continue com ressalvas. Exceções complexas podem ir ao humano; não justificam automaticamente agente autônomo.
Dor e workflow de fato vagos podem justificar CRITICA: criação de conteúdo versus cópia de campos são naturezas diferentes. Autonomia em decisão sensível pode justificar CRITICA apenas quando existe proposta de execução automática e as fontes não limitam a apoio humano.
A motivação do proponente não prova criticidade. mudancaMaterial explicita qual decisão depende da resposta. Para família/autonomia, as alternativas devem diferir nesses campos. Para solução/risco/arquitetura, descreva estados essencialmente distintos em descricao, e não apenas custo, esforço ou abrangência.
Respostas não sei, não tenho, não se aplica e não consigo informar são respostas válidas de indisponibilidade, nunca reprovação automática. Leia perguntasContexto para entender a que se referem. Não apagam o processo e a dor já relatados.
Se a informação disponível já permite uma direção inicial útil com ressalvas e revisão humana, direcaoUtilComRessalvas=true e não bloqueie. Não exigir exemplo de decisão variável/contextual para analisar resultados, indicadores, desvios ou dashboards. Decisões específicas só aprofundam uma oportunidade analítica já sustentada.
No máximo duas perguntas, somente indispensáveis.
Se houver correcoes, avalie correcoesApenasContexto: true SOMENTE se todas solicitam contexto não indispensável, sem nenhum defeito real a corrigir. Não ignore cálculo incorreto, promessa, fato inventado, risco ou métrica inválida. Correções de dimensionamento podem ser registradas como validações; defeitos reais exigem revisão.
Retorne uma avaliação por id, sem novas perguntas.`,{fontes,perguntasContexto,perguntas,correcoes});
 if(new Set(result.revisoes.map(r=>r.id)).size!==ids.length)throw new Error("invalid_question_review");
 const criticalQuestions=perguntas.filter(q=>result.revisoes.some(r=>r.id===q.id && r.classe==="CRITICA" && r.indispensavel && !r.direcaoUtilComRessalvas && (r.mudancaMaterial==="familia"?r.alternativaSeA.familia!==r.alternativaSeB.familia:r.mudancaMaterial==="autonomia"?r.alternativaSeA.autonomia!==r.alternativaSeB.autonomia:["solucao","risco","arquitetura"].includes(r.mudancaMaterial) && r.alternativaSeA.descricao.trim()!==r.alternativaSeB.descricao.trim())));
 return {criticalQuestions,correctionsOnlyContext:!correcoes.length || ("correcoesApenasContexto" in result && result.correcoesApenasContexto===true)};
}

export async function reviewClarifications(call:StageCall,fontes:Sources,perguntas:Question[],perguntasContexto:Sources={}){
 return (await reviewClarificationsDetailed(call,fontes,perguntas,perguntasContexto)).criticalQuestions;
}
