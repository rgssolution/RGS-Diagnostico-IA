# Refinamento global do motor — 15/10/2026

Projeto independente e diretório exclusivo: `C:\Users\RENATO\Documents\ChatGPT\Diagnostico RGS IA`.

**Estado: implementação e validações locais concluídas; validações reais ainda incompletas. Após a recarga informada, algumas chamadas passaram, mas o provedor voltou a retornar credit_balance_exhausted, inclusive em execução sequencial.**

## O que foi encontrado

O motor anterior já exigia IA relevante, mas a separação de tarefas exatas dependia de termos restritos das fontes e de instruções. A recomendação era texto livre; o workflow podia posicionar a declaração de cálculo antes da validação estrutural. Não havia avaliação estruturada de consulta analítica em linguagem natural, registro/cálculo/unidade obrigatório nas métricas ou bloqueio específico de promessas fortes e requisitos quantitativos por extenso.

## Regras alteradas

- Tarefas exatas abrangem somas, faturamento, custos, lucro, margens, saldo de estoque, consolidação tabular, filtros, agrupamentos, validações objetivas e regras contábeis/fiscais. A extração também classifica semanticamente a necessidade de processamento exato, combinada com reconhecimento conservador dos termos das fontes.
- Cada candidato declara papel determinístico, papel da IA e validação. Cálculo crítico não pode ser delegado ao modelo de linguagem.
- A consulta em linguagem natural é avaliada na aderência e em cada candidato: adequação, motivo, evidências e uso proposto. Não é inserida automaticamente. Quando o candidato escolhido a considera adequada, o workflow precisa incorporá-la.
- Nomes curtos de negócio, até cento e dez caracteres, substituem descrições longas no título da solução.
- A recomendação usa plano estruturado interno: nome projetado do candidato, motivo da escolha ligado à dor e ao comparativo, valor da IA, arquitetura e resultado potencial. O backend compõe os cinco blocos no campo público já existente, sem modificar o frontend.
- Workflow estruturado e ordenado pelo servidor: entrada → validação estrutural → regras/cálculos → inteligência → entrega → consulta opcional → revisão humana/exceções. Quando há tarefa exata, validação e etapa determinística são obrigatórias antes da IA.
- Resumo e workflow atuais são projetados da extração factual. A composição final não pode substituí-los por etapas da solução futura. Essa correção veio de uma saída real de Atendimento que misturou os dois fluxos.
- Métricas exigem registro, cálculo objetivo, comparação e unidade. Uma principal, até duas secundárias e nenhuma meta inventada.
- Bloqueios adicionais detectam atribuição direta de cálculo ao LLM, promessas fortes, mínimos quantitativos sem base contextual (inclusive por extenso) e medição meramente descritiva. Uma negação explícita de garantia não é tratada como promessa.
- Um APPROVED do auditor não contorna erros determinísticos: a proposta é revisada e auditada novamente; reprovação persistente impede a entrega.

A classificação nas vinte famílias do briefing anterior é preservada, sem roteamento por setor, sem chatbot por padrão e sem infraestrutura técnica como solução de negócio.

## Quality Gate: oito novos critérios, total de vinte e quatro

1. calculoLLM: nenhuma tarefa exata atribuída ao modelo.
2. quantidadesJustificadas: nenhum mínimo de histórico/registros/amostras inventado, nem número deslocado de outro contexto.
3. promessasResponsaveis: nenhum ganho forte garantido sem evidência.
4. capacidadeNegocio: solução além de simples automação renomeada.
5. inteligenciaExplicita: ação inteligente e valor explicados.
6. arquiteturaSeparada: validação e regras/cálculos antes da IA, com revisão apropriada.
7. consultaContextual: valor de interação avaliado, com inclusão coerente e não automática.
8. mensurabilidade: registro, cálculo, comparação e unidade objetivos em todas as métricas.

Os dezesseis critérios anteriores continuam obrigatórios. APPROVED exige todos verdadeiros e nenhum erro determinístico, correção ou pergunta pendente. REVISE refaz candidatos, seleção, composição e auditoria uma vez. NEEDS_CLARIFICATION permanece limitado a perguntas críticas.

## Validação local

| Verificação | Resultado |
| --- | --- |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test | 115 testes passaram; 14 testes opt-in ignorados por padrão |
| npm run test:quality | 16 testes passaram |
| npm run build | PASS |
| npm run test:e2e | 4 cenários passaram |
| GET / | HTTP 200 |
| Frontend, CSS, layout base, formulário, rota e rate limit | Hashes idênticos aos capturados no início desta tarefa |

A suíte offline cobre Atendimento, Financeiro, Marketing, Vendas, RH, Operações, Compras, Logística, Documentos, Conhecimento interno, Anomalias, Previsão, Multimodal, regras fixas sem contexto inteligente e informação insuficiente. Testes offline verificam contratos, montagem ordenada, bloqueios e critérios do avaliador; não provam competência semântica do modelo.

Regressões específicas cobrem as quatro atribuições indevidas de cálculo, seis promessas fortes, mínimos de histórico em algarismos e por extenso, numeral com unidade diferente na fonte, base representativa sem número arbitrário, métricas descritivas, cada um dos oito checks novos falso, reconhecimento de regras fora de finanças, conteúdo auditado idêntico ao entregue, consulta adequada presente e consulta não forçada, além da revisão de promessa mesmo quando o auditor responde APPROVED.

Os E2E cobrem mobile, tablet, desktop, formulário obrigatório, loading, falha, preservação de respostas, resultado com dez seções e esclarecimento sem chat. Frontend não foi editado.

## Cenário financeiro

Entrada de regressão: balanço mensal, planilha de vendas, planilha de custos, consolidação manual, cálculo de faturamento/custos/lucro/margens, dashboard e conferência manual, com gestor interpretando resultados e comparando meses.

Contrato/validações esperados: capacidade financeira inteligente; validação estrutural e cálculo conferido antes da IA; interpretação, variações/anomalias, tendências, síntese executiva, apoio à decisão e possibilidade de consulta analítica; métricas objetivas; nenhum mínimo de histórico arbitrário ou promessa de ganho garantido.

**Regressão offline: PASS. Geração real desta versão: não concluída, HTTP 429.** Não há novo diagnóstico financeiro aprovado para apresentar como evidência real.

## Reexecução após a recarga

A execução das seis áreas foi retomada após o usuário informar a recarga. Algumas chamadas foram aceitas, mas os testes voltaram a receber HTTP 429. A verificação mínima chegou a retornar HTTP 200; isso não comprovou disponibilidade para completar o pipeline.

Na tentativa financeira posterior, isolada e com maxConcurrency=1, a extração passou e a avaliação de aderência retornou HTTP 429. A observação opt-in da resposta registrou somente metadados seguros: code=credit_balance_exhausted, type=insufficient_quota, retryAfter=null, sem headers de limite de tokens. Portanto, não há evidência de rate limit temporário; o código reportado continua sendo o de créditos.

| Caso após a recarga | Resultado observado |
| --- | --- |
| Financeiro | Tentativa isolada interrompida na aderência por credit_balance_exhausted; validação real pendente |
| Atendimento | Uma saída exigiu revisão automática e falhou no avaliador por falso negativo de capacidade; a revisão manual também encontrou fluxo futuro na operação atual. Ambas as causas foram corrigidas e receberam regressões. Nova geração da versão corrigida pendente |
| Marketing | HTTP 429 na composição; sem diagnóstico aprovado |
| Vendas | HTTP 429 na geração de candidatos durante revisão; sem diagnóstico aprovado |
| RH | Uma geração passou no pipeline e no avaliador em seis chamadas, antes da correção da projeção factual; não comprova a validação completa da versão final |
| Operações | Reexecução não concluída antes da interrupção da bateria; pendente |

O lote paralelo foi interrompido para evitar chamadas redundantes. A tentativa isolada demonstrou que reduzir concorrência não resolveu o erro de créditos. Nenhum limite da aplicação foi alterado. O usuário foi informado e foi solicitada conferência do saldo disponível na organização vinculada à OPENAI_API_KEY do projeto.

A descrição de busca contextual e identificação de intenção no caso Atendimento era válida; o avaliador reconhecia um vocabulário estreito demais. A correção amplia o reconhecimento dessas capacidades sem aceitar cópia mecânica como inteligência. O outro problema era real: o relatório usava etapas futuras no workflow atual. Resumo e workflow agora são projetados da extração factual, em vez de serem reescritos na composição final.

Fonte oficial: [OpenAI — Error codes](https://developers.openai.com/api/docs/guides/error-codes). O código credit_balance_exhausted requer disponibilidade de créditos na organização correspondente; não se resolve por repetição de chamadas.

Registros em tests/results-refinamento: LIMITE-PROVEDOR.json, BLOQUEIO.json, relatórios de falha e saídas parciais de Atendimento e RH. Essas saídas não são um conjunto final de seis aprovações. tests/results contém resultados da versão anterior, que também não comprovam este refinamento.

Depois de regularizado o acesso da chave:

```powershell
$env:RGS_LIVE='1'
$env:RGS_CAPTURE_RATE='1'
$env:RGS_LIVE_CASES='Financeiro,Atendimento,Marketing,Vendas,RH,Operacoes'
npm run test:live -- --maxConcurrency=1
```

Revalidar as saídas da versão final com o avaliador e revisar o cenário financeiro antes de declarar concluído o aceite real. A revalidação opt-in inclui também evidência HTTP financeira, que precisa ser gerada nesta versão.

## Arquivos desta entrega

- src/lib/diagnostic/prompts.ts: regras globais de precisão e profundidade.
- src/lib/diagnostic/schemas.ts: oito critérios extras e contratos internos de engenharia/consulta.
- src/lib/diagnostic/precision-plan.ts: planos estruturados de recomendação, workflow e métrica, e composição pública.
- src/lib/diagnostic/extract-facts.ts: identificação semântica e conservadora de tarefas exatas.
- src/lib/diagnostic/assess-ai-fit.ts: avaliação de consulta com proveniência.
- src/lib/diagnostic/generate-candidates.ts: engenharia, consulta e nome curto.
- src/lib/diagnostic/final-diagnosis.ts: composição ordenada e preservação do contrato público.
- src/lib/diagnostic/quality-gate.ts e solution-policy.ts: auditoria e bloqueios adicionais.
- tests/fixture.ts, structure.test.ts, precision.test.ts, quality-cases.ts, quality-evaluator.ts, quality.test.ts e live.test.ts: contratos e regressões.
- README.md, VALIDACAO.md e tests/results-refinamento/: documentação e evidências desta validação.

Frontend, perguntas, ordem dos campos, identidade visual, logo, cores, responsividade, rate limit, rota, integração e configuração das credenciais/modelos não foram alterados. Nenhuma dependência, autenticação, commit, push ou deploy foi modificado/executado.

## Limites

Os bloqueios lexicais cobrem padrões comprovados e não substituem a auditoria semântica. Detectar um número nas fontes não demonstra, sozinho, que ele justifica um pré-requisito; o novo critério contextual também avalia essa relação. Um modelo pode errar, e a execução real está pendente; não há promessa de precisão universal nem de latência. O MVP recomenda a arquitetura da solução futura e não executa o fechamento financeiro ou as operações de estoque do cliente.
