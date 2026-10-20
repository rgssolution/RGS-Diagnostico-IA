# Validação — otimização de custo, tokens e latência

Data: 16/10/2026. Projeto exclusivo: `C:\Users\RENATO\Documents\ChatGPT\Diagnostico RGS IA`.

## Resultado medido

Seis cenários sintéticos executados na OpenAI: Atendimento, Financeiro, Marketing, Vendas, RH e Operações. Mesmos modelos configurados nos dois lotes (análise e auditoria: gpt-4.1); nenhuma alteração de `.env.local` ou escolha de modelo hardcoded. Baseline: código do commit `053cf52`, copiado temporariamente e removido depois das medições. Os tokens são os contadores reais de usage da SDK, completos em todas as chamadas retidas.

| Média por diagnóstico | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Chamadas | 6.67 | 4.50 | 32.5% |
| Duração (segundos) | 85.1 | 47.7 | 43.9% |
| Tokens de entrada | 42955.3 | 17823.0 | 58.5% |
| Tokens de saída | 9624.2 | 5010.3 | 47.9% |
| Tokens totais | 52579.5 | 22833.3 | 56.6% |

| Caso | Chamadas antes/depois | Segundos antes/depois | Tokens antes/depois | Qualidade final |
| --- | ---: | ---: | ---: | --- |
| Atendimento | 10 / 5 | 119.5 / 38.6 | 80935 / 25786 | Aprovada |
| Financeiro | 6 / 4 | 89.7 / 45.5 | 46001 / 19743 | Aprovada |
| Marketing | 6 / 5 | 72.6 / 49.9 | 46354 / 23781 | Aprovada |
| Vendas | 6 / 4 | 92.8 / 50.9 | 47435 / 20310 | Aprovada |
| RH | 6 / 5 | 68.0 / 49.7 | 46814 / 26915 | Aprovada |
| Operacoes | 6 / 4 | 68.0 / 51.8 | 47938 / 20465 | Aprovada |

## O que mudou

- Extração factual + aderência: uma chamada `analyze_process`. Avalia quinze dimensões/vinte famílias; emite somente avaliações sustentadas, com evidências existentes. Classificações não evidenciadas são normalizadas localmente.
- Candidatos + seleção: uma chamada `solutions_selection`, duas a três alternativas, comparação, MVP/evolução e arquitetura determinística/IA. Reutiliza validação de famílias, evidências e seleção.
- Composição consome `analysisContext`, sem o formulário completo duplicado junto de todas as avaliações negativas e justificativas anteriores.
- Quality Gate independente permanece obrigatório, com os trinta e um critérios. Recebe fontes originais, relatório exato e contexto essencial dos candidatos, sem conclusões da extração/aderência/seleção. Saída compacta: booleanos por critério e texto somente para correções/perguntas.
- Uma revisão pontual em `revise_diagnosis` substitui a regeneração de candidatos, seleção, composição e nova auditoria. O revisor auditor, independente do redator, produz patches e certifica a resposta resultante nos mesmos critérios. O servidor aplica literalmente e executa novamente o gate determinístico. Não permite trocar candidato, família ou evidência literal; rejeita patch repetido, sem efeito ou revisão vazia de defeito real. Pode corrigir descrições factuais contra as fontes originais, sem inventar etapas futuras. A frase controlada de separação dos cálculos fica protegida no schema.
- Esclarecimento só é avaliado por modelo quando existe pergunta candidata a bloquear; mantém duas perguntas no máximo e não bloqueia por dimensionamento ou indisponibilidade de resposta.
- Prompts compartilhados foram reduzidos; cada função recebe instruções específicas. Sem remoção do método ou retorno a um prompt único.

## Validações em código

Limites de famílias/alternativas e campos obrigatórios já eram, em grande parte, determinísticos. Foram preservados e reforçados: máximo de três candidatos na etapa consolidada, referências restritas aos IDs reais, consulta adequada exige evidência e uso proposto, números ausentes bloqueados também em escopo/capacidade/composição e patches, integridade da seleção, métricas vinculadas a gargalos, infraestrutura/jargão proibidos, promessas fortes, volume sem referência, duplicação estrutural e regras/cálculos separados do LLM. O auditor continua responsável pela coerência semântica, relevância, arquitetura e sustentação dos benefícios.

Orçamentos de saída: análise 2.400; soluções/seleção 2.600; composição 3.200; Quality Gate 1.400; esclarecimento 1.000; revisão por patches 3.800. A margem das etapas consolidadas preserva campos de rastreabilidade e engenharia. Respostas incompletas são rejeitadas; não há retry automático escondido. OPENAI_ANALYSIS_MODEL e OPENAI_AUDIT_MODEL continuam com fallback para OPENAI_MODEL.

Telemetria em desenvolvimento: `[diagnostico-usage]`, stages, durationMs, inputTokens, outputTokens, totalTokens e usageStages. Inclui tentativas com falha; usageStages distingue ausência de contadores de zero tokens medidos. Sem conteúdo, prompts, respostas completas ou credenciais; nada disso entra no payload HTTP. Relatórios de testes são somente dados sintéticos.

## Validação final

- `npm test`: 183 testes locais aprovados; testes reais/revalidação opt-in ficam separados.
- `npm run lint`: aprovado sem avisos.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm run test:quality`: 16 aprovados, subconjunto da suíte.
- `npm run test:e2e`: quatro aprovados (mobile/tablet/desktop e esclarecimento).
- Seis gerações reais finais aprovadas pelo gate e avaliador, entre quatro e cinco chamadas cada.
- `RGS_RECHECK_OPTIMIZATION=1 npx vitest run tests/optimization-live-recheck.test.ts`: sete verificações aprovadas, sem nova cobrança. Exige ausência de falha posterior à saída salva e produz COMPARATIVO.json.

Frontend, formulário, conteúdo visual, CSS, cores, logo, dependências, rate limit e payload público preservados.

## Limites e transparência

As médias usam uma saída final retida por cenário após as correções, não todas as tentativas de desenvolvimento. A rodada completa intermediária teve reprovações reais de volume/controle de cálculo e falsos negativos lexicais. Os controles rejeitaram saídas inadequadas; as causas foram corrigidas e os cenários afetados repetidos. Falsos negativos lexicais foram reavaliados sem alterar a geração salva; esses relatórios preservam avaliacaoInicial. O avaliador agora reconhece descrições de negócio equivalentes e continua rejeitando cópia mecânica por regra/identificador. Não confundir ausência de palavra específica com ausência de capacidade inteligente.

Os lotes antes/depois foram sequenciais internamente e parcialmente simultâneos entre si. É uma amostra pequena, com variação do provedor/modelo e revisões; não comprova média de produção, taxa de aprovação ou custo em dinheiro. O baseline Financeiro não passou no critério externo de consulta analítica complementar; o depois passou em todos os seis. Os arquivos antigos permanecem como histórico, com qualidade reavaliada em COMPARATIVO.json.

Quatro chamadas é o caminho normal; cinco cobre um desvio isolado. Múltiplos desvios, perguntas críticas tardias ou esclarecimento em duas requisições HTTP podem exceder cinco no total: a qualidade e a auditoria têm precedência. Uma reavaliação excepcional de aderência pode adicionar uma chamada. Falha estrutural que exige trocar a solução continua bloqueada; não se aprova por economia de chamadas.

Fontes técnicas consultadas: [Structured Outputs — documentação oficial OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs). SDK local consultada para os campos usage e max_output_tokens.

Arquivos principais: `consolidated.ts`, `pipeline.ts`, `client.ts`, `prompts.ts`, `final-diagnosis.ts`, `quality-gate.ts`, `revise-diagnosis.ts`, builders de aderência/candidatos e rota API (somente telemetria); testes, README e relatórios sintéticos. Nenhum commit, push ou deploy nesta etapa.
