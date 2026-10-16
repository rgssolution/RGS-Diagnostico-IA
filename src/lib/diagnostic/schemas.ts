import {z} from "zod";
export const families=[
 "IA conversacional","Agentes / autonomia","Geração de texto","Geração de imagem","Geração de vídeo","Geração de áudio","Voz / speech","Visão computacional","Busca inteligente / RAG","Extração e interpretação de documentos","Classificação / roteamento","Recomendação / scoring / next best action","Análise de dados","Previsão / modelos preditivos","Detecção de padrões / anomalias","Personalização","Apoio à decisão","Automação agentic","Tradução / transformação","Resumo / síntese"
] as const;
export const dimensions=["repetitividade","escala","disponibilidade","linguagemNatural","variabilidade","decisao","dadosHistorico","personalizacao","velocidade","dependenciaHumana","interpretacao","geracaoConteudo","multimodalidade","multiplasEtapas","conhecimentoInterno"] as const;
export const auditChecks=["dorReal","familiaCoerente","familiaMaisAderente","especificidade","conservadorismo","oportunidadeRelevante","infraestruturaOculta","iaSubstantiva","dadosInventados","hipotesesComoFatos","sinaisIgnorados","metodologia","preRequisitos","metrica","contradicoes","competencia","calculoLLM","quantidadesJustificadas","promessasResponsaveis","capacidadeNegocio","inteligenciaExplicita","arquiteturaSeparada","consultaContextual","mensurabilidade","bloqueioDimensionamento","escopoNecessario","alternativaEnxuta","metricaNegocio","volumeSustentado","linguagemEmpresario","semRedundancia"] as const;
export const text=z.string().min(1).max(1600);
const list=z.array(text).max(15);
const refs=z.array(z.string().min(1).max(40)).max(20);
export const family=z.enum(families);
const familyLabels:Partial<Record<typeof families[number],string>>={
 "Agentes / autonomia":"Agentes de IA para executar tarefas",
 "Voz / speech":"Voz",
 "Busca inteligente / RAG":"Busca inteligente em informações da empresa",
 "Recomendação / scoring / next best action":"Recomendação e priorização",
 "Automação agentic":"Execução de tarefas com IA",
 "Resumo / síntese":"Resumo e síntese"
};
export function displayFamily(value:typeof families[number]){return familyLabels[value]||value;}
export const publicFamilies=families.map(displayFamily) as [string,...string[]];
export const publicFamily=z.enum(publicFamilies);
export function internalFamily(value:string){const match=families.find(f=>displayFamily(f)===value);if(!match)throw new Error("invalid_family_label");return match;}
export const scopeSchema=z.object({descricao:text.max(180),validacaoInicial:text.max(160),evolucoes:z.array(text.max(100)).max(2),consultaEssencial:z.boolean()}).strict();

const level=z.enum(["Baixo","Médio","Alto"]);
const fitLevel=z.enum(["Baixa","Média","Alta"]);
export const questionSchema=z.object({id:z.string().regex(/^q[1-2]$/),pergunta:z.string().min(5).max(350),mudaRecomendacao:text}).strict();
export const questionsSchema=z.array(questionSchema).max(2);
const evidence=z.object({id:z.string().regex(/^F\d{1,2}$/),campo:z.string().max(60),trecho:text}).strict();
export const factsSchema=z.object({
 processo:text,objetivo:text,workflowAtual:list,participantes:list,ferramentas:list,dificuldades:list,tarefasRepetitivas:list,decisoes:list,restricoes:list,sinaisDePerda:list,informacoesAusentes:list,exigeCalculoExato:z.boolean(),evidencias:z.array(evidence).min(1).max(20)
}).strict();
const dimensionSchema=z.object({classificacao:z.enum(["forte","moderada","fraca","não evidenciada"]),evidencias:refs,justificativa:text}).strict();
const dimensionShape=Object.fromEntries(dimensions.map(d=>[d,dimensionSchema])) as Record<typeof dimensions[number],typeof dimensionSchema>;
export const consultationSchema=z.object({adequada:z.boolean(),motivo:text,evidencias:refs,usoProposto:text.nullable()}).strict();
export const fitSchema=z.object({
 dimensoes:z.object(dimensionShape).strict(),
 familiasAvaliadas:z.array(z.object({familia:family,aderencia:fitLevel,evidencias:refs,justificativa:text}).strict()).length(20),
 consultaLinguagemNatural:consultationSchema,aderencia:fitLevel,conclusoes:list,medirParaDimensionar:list,needs_clarification:z.boolean(),perguntas:questionsSchema
}).strict();
export const engineeringSchema=z.object({
 calculosCriticos:z.enum(["Ausentes no escopo","Separados do modelo de linguagem"]),papelDeterministico:text,papelIA:text,validacao:text,consultaLinguagemNatural:consultationSchema
}).strict();
export const candidateSchema=z.object({
 id:z.string().regex(/^C[1-4]$/),solucao:text,tipo:z.literal("IA"),familias:z.array(family).min(1).max(4),
 escopoInicial:scopeSchema,problema:text,capacidadeIA:text,evidencias:refs,coberturaDaDor:text,impactoPotencial:level,justificativaImpacto:text,esforco:level,dependencias:list,risco:text,velocidadeDeTeste:text,dadosDisponiveis:text,facilidadeDeMedir:text,integracao:text,maturidade:text,engenharia:engineeringSchema
}).strict();
export const candidatesSchema=z.object({candidatos:z.array(candidateSchema).min(2).max(4)}).strict();
export const selectionSchema=z.object({candidatoId:z.string().max(20),alternativas:refs,justificativaComparativa:text,needs_clarification:z.boolean(),perguntas:questionsSchema}).strict();
const metric=z.object({nome:text,comoMedir:text,gargalo:text}).strict();
export const diagnosisSchema=z.object({
 operacao:z.object({resumo:text,fatos:list,workflow:list}).strict(),
 gargalos:z.array(z.object({problema:text,consequencia:text,evidencia:text}).strict()).min(1).max(3),
 oportunidade:z.object({parteProcesso:text,capacidadeNecessaria:text,beneficioPotencial:text}).strict(),
 familias:z.object({principal:publicFamily,complementares:z.array(publicFamily).max(2),justificativa:text}).strict(),
 solucoes:z.array(z.object({id:z.string().max(20),solucao:text,familias:z.array(publicFamily).min(1).max(3),problema:text,capacidadeIA:text,impactoPotencial:level,esforco:level,observacao:text}).strict()).min(2).max(3),
 recomendacao:z.object({candidatoId:z.string().max(20),texto:text}).strict(),
 funcionamento:z.array(text).min(3).max(8),preRequisitos:z.array(text).min(1).max(15),validacoes:list,
 metricas:z.object({principal:metric,secundarias:z.array(metric).max(2)}).strict()
}).strict();
const checkShape=Object.fromEntries(auditChecks.map(c=>[c,z.object({ok:z.boolean(),observacao:text}).strict()])) as Record<typeof auditChecks[number],z.ZodObject<{ok:z.ZodBoolean;observacao:typeof text}>>;
export const auditSchema=z.object({status:z.enum(["APPROVED","REVISE","NEEDS_CLARIFICATION"]),verificacoes:z.object(checkShape).strict(),correcoes:list,perguntas:questionsSchema}).strict();
export type Facts=z.infer<typeof factsSchema>;
export type Fit=z.infer<typeof fitSchema>;
export type Candidates=z.infer<typeof candidatesSchema>;
export type Selection=z.infer<typeof selectionSchema>;
export type Diagnosis=z.infer<typeof diagnosisSchema>;
export type Audit=z.infer<typeof auditSchema>;
export type Question=z.infer<typeof questionSchema>;
export type Sources=Record<string,string>;
export type Completion={needs_clarification:false;diagnostico:Diagnosis}|{needs_clarification:true;perguntas:Question[]};