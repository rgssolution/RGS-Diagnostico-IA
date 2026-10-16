import type {Diagnosis,Sources} from "./schemas";
function normalized(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
const infrastructure=/\b(make|n8n|zapier|scripts?|macros?|python|apis?|webhooks?|cron|low[ -]?code)\b|\bbanco de dados\b|\bferramentas? de orquestracao\b/;
const negation=/\bnao (?:precisa|necessita|requer)(?: de)? (?:ia|inteligencia artificial)\b|\b(?:ia|inteligencia artificial) (?:nao e necessaria|e desnecessaria|nao agrega)\b|\bsem (?:necessidade|uso|participacao) de (?:ia|inteligencia artificial)\b|\bautomacao tradicional\b/;
export function solutionPolicyErrors(value:unknown):string[]{
 const raw=(typeof value==="string"?value:JSON.stringify(value)).replace(/"(?:id|candidatoId)"\s*:\s*"C[1-4]"/g,"");
 const content=normalized(raw);
 const errors:string[]=[];
 if(/[\u200b\u200c\u2060\ufeff]/u.test(raw) || /\bC[-\s]*[1-4¹²³⁴]/u.test(raw))errors.push("Artefato de formatação ou referência interna na prosa pública.");
 if(infrastructure.test(content))errors.push("Infraestrutura técnica apresentada como solução de negócio.");
 if(negation.test(content))errors.push("Conclusão fora do posicionamento de oportunidade de IA.");
 return errors;
}
export function publicSolutionContent(d:Diagnosis){
 // Fatos e citações do usuário são preservados, mesmo quando mencionam tecnologias.
 return {oportunidade:d.oportunidade,familias:d.familias,solucoes:d.solucoes,recomendacao:d.recomendacao,funcionamento:d.funcionamento,preRequisitos:d.preRequisitos,validacoes:d.validacoes,metricas:d.metricas};
}
export function criticalCalculations(fontes:Sources){
 const content=normalized(Object.values(fontes).join(" "));
 return /\b(somar?|somas|calcular|calculos?|faturamento|lucro|saldo de estoque|saldo do estoque|consolidacao tabular|validacoes objetivas|regras contabeis|regras fiscais|agrupamentos|filtros|margem|margens|cruzamento de valores|indicadores financeiros|fechamento financeiro)\b/.test(content);
}
export const calculationControl="As regras e validações objetivas são executadas por processamento conferido, separado da interpretação pela IA.";
export function unprovidedNumbers(d:Diagnosis,fontes:Sources){
 const known=new Set(Object.values(fontes).join(" ").match(/\d+(?:[.,]\d+)?/g)||[]);
 const metric=(m:Diagnosis["metricas"]["principal"])=>({...m,comoMedir:m.comoMedir.replace(/(?:multiplicar|multiplicado|vezes|x|×)\s*(?:por\s*)?100\b/gi,"expressar em percentual")});
 const content=JSON.stringify({...d,metricas:{principal:metric(d.metricas.principal),secundarias:d.metricas.secundarias.map(metric)}}).replace(/\b[FC]\d+\b/g,"");
 return [...new Set(content.match(/\d+(?:[.,]\d+)?/g)||[])].filter(n=>!known.has(n));
}
export function precisionErrors(d:Diagnosis,fontes:Sources):string[]{
 const errors:string[]=[];
 const content=normalized(JSON.stringify(publicSolutionContent(d))).replace(/\b(?:nao|sem)\s+(?:(?:podemos|pode)\s+)?(?:garant\w*|assegur\w*)\s+(?:(?:a|total|plena)\s+)?(?:confiabilidade|seguranca|agilidade|resultados)\b/g,"sem garantia");
 if(/\b(?:ia|llm|modelo de linguagem)\s+(?:(?:e responsavel por|vai|deve|pode|ira)\s+)?(?:calcul\w*|som(?:a|ar|am|ando)|executa os calculos|realiza os calculos|cruza os dados e calcula)\b/.test(content))errors.push("Cálculo crítico atribuído ao modelo de linguagem.");
 if(/\b(?:reduz\w*\s+(?:drasticamente|substancialmente|significativamente)|elimina(?:r)? (?:a maior parte|todo|todos)|cobre integralmente|beneficios imediatos|risco (?:zero|baixissimo)|(?:garant\w*|assegur\w*)\s+(?:(?:a|total|plena)\s+)?(?:confiabilidade|seguranca|agilidade|resultados))\b/.test(content))errors.push("Promessa forte sem sustentação verificável.");
 const known=normalized(Object.values(fontes).join(" "));
 const quantity=/\b(?:\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|cem|mil)\s+(?:mes(?:es)?|anos?|dias?|registros?|atendimentos?|amostras?|exemplos?|transacoes?)\b/g;
 for(const p of d.preRequisitos){const normalizedP=normalized(p);for(const q of normalizedP.match(quantity)||[])if(!known.includes(q))errors.push("Pré-requisito quantitativo sem base nas fontes.");}
 for(const m of [d.metricas.principal,...d.metricas.secundarias]){
  if(/linguagem descritiva|comparar descritivamente|pesquisa qualitativa|percepcao subjetiva/.test(normalized(m.comoMedir)))errors.push("Métrica sem medição objetiva.");
 }
 return [...new Set(errors)];
}

export function incrementalErrors(d:Diagnosis,fontes:Sources):string[]{
 const errors:string[]=[];
 const proposed=JSON.stringify(publicSolutionContent(d));
 const generated=normalized(JSON.stringify({proposta:publicSolutionContent(d),operacao:d.operacao,gargalos:d.gargalos.map(g=>({problema:g.problema,consequencia:g.consequencia}))}));
 const sources=normalized(Object.values(fontes).join(" "));
 const labels=generated.match(/\b(?:(?:alto|baixo|grande|pequeno|elevado|reduzido) volume|(?:grande|pequena|enorme) quantidade|(?:alta|baixa|pouca|muita|grande) demanda)\b/g)||[];
 if(labels.some(label=>!sources.includes(label)))errors.push("Classificação de volume sem referência nas fontes.");
 if(/\b(?:automacao agentic|pipeline|acervo|logica estruturada|casos nao estruturados|orquestracao)\b/.test(normalized(proposed)))errors.push("Linguagem técnica desnecessária na proposta pública.");
 if(/\b(?:tokens?|chamadas ao modelo|latencia do modelo|respostas geradas (?:pela ia|pelo modelo)|uso (?:da ia|do modelo))\b/.test(normalized(d.metricas.principal.nome)))errors.push("Métrica principal mede atividade da tecnologia, não resultado da dor.");
 const passages=[d.oportunidade.capacidadeNecessaria,d.oportunidade.beneficioPotencial,d.familias.justificativa,...d.solucoes.map(s=>s.observacao),...d.recomendacao.texto.split(/\n\s*\n/),...d.funcionamento].map(v=>normalized(v).replace(/^[^:]{1,60}:\s*/,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim()).filter(v=>v.length>=80);
 if(new Set(passages).size!==passages.length)errors.push("Argumento repetido entre seções sem informação nova.");
 return [...new Set(errors)];
}
