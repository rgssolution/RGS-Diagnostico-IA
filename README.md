# Diagnóstico RGS IA

Projeto independente em `C:\Users\RENATO\Documents\ChatGPT\Diagnostico RGS IA`, com repositório e dependências próprios. Não depende do RGS Social Selling.

Aplicação Next.js para identificar oportunidades reais de IA em processos empresariais. O formulário original é preservado. Cada diagnóstico aprovado conecta evidência, gargalo, consequência, capacidade inteligente, solução, funcionamento, pré-requisitos e métrica. Não há roteamento fixo por setor.

## Executar

```powershell
npm ci
npm run dev
```

Abra http://localhost:3000. Configure `.env.local` na raiz, sem versioná-lo:

```dotenv
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-4.1
OPENAI_ANALYSIS_MODEL=
OPENAI_AUDIT_MODEL=
```

As variáveis opcionais de análise e auditoria usam OPENAI_MODEL como fallback. Nenhuma chave é enviada ao navegador. A situação das validações, inclusive impedimentos da API, está registrada em VALIDACAO.md. Alterar modelo exige repetir os testes reais.

## Motor e contratos

1. Extração factual das fontes originais; evidências literais e identificação de cálculos críticos são anexadas pelo servidor.
2. Avaliação de quinze dimensões e das vinte famílias, com evidências obrigatórias para classificações positivas.
3. Geração de duas a quatro alternativas com IA substantiva, problema, capacidade, família, evidência, impacto, esforço, riscos e engenharia interna.
4. Seleção comparativa de uma iniciativa e alternativas existentes.
5. Composição das dez seções públicas, com duas a três soluções e uma métrica principal ligada ao primeiro gargalo; até duas secundárias.
6. Auditoria independente das fontes, candidatos, conteúdo final e erros determinísticos. O auditor não recebe as conclusões prévias da extração, aderência ou seleção.

O fluxo base usa seis chamadas. Uma revisão refaz candidatos, seleção, composição e auditoria, totalizando dez chamadas antes de eventuais auditorias de perguntas. Há no máximo uma revisão; reprovação persistente impede a entrega. O usuário recebe exatamente o diagnóstico auditado.

A seleção prioriza impacto potencial, viabilidade e velocidade de validação. Entre soluções suficientes para o gargalo, prefere o menor escopo inicial; funções úteis mas não necessárias ficam em evolução. Maior sofisticação não vence por si.

Todas as alternativas devem ter família e capacidade concreta de IA. O contrato não admite família principal nula. O relatório mostra uma família principal e até duas complementares relevantes, sem enumerar todas as capacidades internas. Infraestrutura técnica não é apresentada como solução de negócio. Citações factuais do próprio usuário são preservadas mesmo que mencionem tecnologias.

Cálculos, consolidações tabulares, filtros, agrupamentos e validações objetivas são separados do modelo de linguagem: processamento com regras conferidas produz valores e indicadores; IA interpreta resultados, variações e padrões. O workflow estruturado é ordenado pelo servidor: entrada, validação estrutural, regras/cálculos, inteligência, entrega, consulta opcional e revisão humana. Quando necessários, validação e processamento exato são obrigatórios antes da IA. Este MVP recomenda a arquitetura da futura solução; não recebe planilhas nem executa o fechamento financeiro do cliente.

A recomendação é composta no backend com nome, primeira implementação, motivo, valor da IA, arquitetura, resultado potencial e evolução possível após validar o início. Os campos públicos e o frontend são preservados; os rótulos das famílias são traduzidos para linguagem de negócio. A métrica principal representa o resultado da dor; métricas técnicas podem ser secundárias. Métricas exigem registro, cálculo, comparação e unidade; o servidor projeta essas informações no texto público.

A avaliação de consulta em linguagem natural é obrigatória na aderência e na engenharia de cada candidato, com motivo e evidências. A inclusão é contextual: dados/documentos e necessidade de interpretação podem justificar consulta analítica, sem criar um chatbot por padrão. Adequação não obriga inclusão no MVP: consulta não essencial fica na evolução.

Apenas fatos suficientes autorizam uma oportunidade. Se nenhuma família estiver sustentada, são solicitados esclarecimentos, sem inventar inteligência. Declarações explícitas de desconhecimento básico podem gerar perguntas antes de chamar o modelo. Ausência de volume ou tempo para dimensionamento não bloqueia, por si só, uma oportunidade clara.

Até duas perguntas críticas passam por auditoria específica de necessidade. O ticket assinado vincula perguntas ao formulário, expira em trinta minutos e admite uma complementação. Respostas viram fontes; perguntas geradas são apenas contexto. Persistência de lacuna após complementação retorna HTTP 422 e preserva o formulário.

## Vinte famílias suportadas internamente

1. IA conversacional
2. Agentes / autonomia
3. Geração de texto
4. Geração de imagem
5. Geração de vídeo
6. Geração de áudio
7. Voz / speech
8. Visão computacional
9. Busca inteligente / RAG
10. Extração e interpretação de documentos
11. Classificação / roteamento
12. Recomendação / scoring / next best action
13. Análise de dados
14. Previsão / modelos preditivos
15. Detecção de padrões / anomalias
16. Personalização
17. Apoio à decisão
18. Automação agentic
19. Tradução / transformação
20. Resumo / síntese

## Quality Gate

Trinta e um critérios: dor real, coerência da família, família mais aderente, especificidade, conservadorismo excessivo, oportunidade relevante, infraestrutura oculta, IA substantiva, dados inventados, hipóteses como fatos, sinais ignorados, metodologia, pré-requisitos, métrica, contradições e competência; cálculo pelo LLM; quantidades justificadas; promessas responsáveis; capacidade de negócio; inteligência explícita; arquitetura separada; consulta contextual; mensurabilidade; bloqueio por dimensionamento; escopo necessário; alternativa enxuta; métrica de negócio; volume sustentado; linguagem para empresário; ausência de redundância.

APPROVED exige todos verdadeiros, nenhuma correção/pergunta pendente e nenhum erro determinístico. REVISE exige correção e nova auditoria. NEEDS_CLARIFICATION admite somente lacunas críticas.

O servidor valida ids, famílias sustentadas, referências literais, igualdade entre alternativas avaliadas e exibidas, capacidade de IA, infraestrutura proibida na proposta pública, vínculo das métricas, números não fornecidos e controle dos cálculos. Nome, problema, capacidade, impacto e esforço públicos são projetados dos candidatos. Famílias exibidas formam um subconjunto relevante das famílias avaliadas, com rótulos de negócio; a solução escolhida mantém a classificação principal e complementares do relatório.

A verificação numérica é lexical e não garante verdade semântica. A auditoria verifica a substância; um nome de IA sozinho não aprova a proposta. Modelos podem errar, e a suíte sintética não é estimativa estatística de precisão.

## Testes

```powershell
npm run lint
npm run typecheck
npm test
npm run test:quality
npm run test:e2e
npm run build
```

Casos globais: Atendimento, Financeiro, Marketing, Vendas, RH, Operações, Compras, Documentos, Conhecimento interno, Anomalias, Previsão, Logística e Multimodal; também regras fixas sem contexto inteligente e informações insuficientes. Testes offline verificam contratos, bloqueios e avaliador; não comprovam competência semântica do modelo.

Gerações reais exigem opt-in e chave configurada; seis casos por padrão:

```powershell
$env:RGS_LIVE='1'
npm run test:live
```

Para selecionar outros casos, configure RGS_LIVE_CASES com os ids separados por vírgula. Há no máximo duas gerações simultâneas. `tests/results-refinamento` armazena somente relatórios sintéticos e avaliações, sem chave ou raciocínio interno. Falhas são registradas separadamente. Os relatórios em `tests/results` são da versão anterior e não comprovam a validação deste refinamento.

E2E cobre três tamanhos de tela, obrigatoriedade, loading, erro, preservação de respostas, dez seções e esclarecimento. CSS, logo, formulário, ordem dos campos e rate limit são preservados. A página apenas acompanha o novo contrato do resultado.

## Limites de execução

SDK oficial OpenAI, Responses API e store:false. Sem login, banco ou histórico persistente da aplicação. Corpo máximo de 24.000 bytes, respostas de esclarecimento até mil caracteres por pergunta. Resultado por etapa até 48.000 bytes. Até 5.500 tokens por etapa e 6.500 na composição.

Prazo global de 270 segundos, 65 segundos por chamada, sem repetição automática do SDK; navegador aguarda 285 segundos. A rota declara maxDuration=300; a hospedagem precisa suportar isso. Rate limit original de cinco tentativas por dez minutos, em memória por instância. Erros não expõem credenciais, conteúdo do provedor ou rascunhos rejeitados.

Nenhum commit, integração ou deploy é automático. Consulte VALIDACAO-MVP.md para esta atualização e VALIDACAO.md para a rodada anterior.
