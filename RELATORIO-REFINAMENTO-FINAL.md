# Refinamento final — Diagnóstico RGS IA

Data: 20/10/2026. Diretório exclusivo: `C:\Users\RENATO\Documents\ChatGPT\Diagnostico RGS IA`. Sem commit, push ou deploy.

## Alterações

- Promessas absolutas: bloqueio determinístico dos exemplos solicitados, preservando negações e benefícios condicionais; auditoria semântica complementar.
- Causalidade: novo critério `causalidadeBeneficio`; a interpretação de resultados não deve receber o mérito da prevenção de erros que não controla.
- Métrica: novo critério `atribuicaoMetrica`; principal ligada ao primeiro gargalo, mensurável e diretamente influenciada pelo escopo.
- Consulta útil opcional: obrigatoriamente apresentada na evolução; consulta essencial pode ser a própria pergunta do cliente, sem inventar análise histórica adicional.
- Mantidos os 31 critérios anteriores, totalizando 33. Fluxo normal preservado em quatro etapas/chamadas; revisão condicional já existente permanece.

## Correções técnicas comprovadas durante a regressão

1. A revisão financeira sem números nas fontes combinava duas regex. O Zod gerava `allOf`, rejeitado localmente pelo SDK antes da requisição. As restrições foram combinadas em uma única regex equivalente. Testes verificam serialização real pelo SDK, frase de proteção obrigatória e proibição de números quando ausentes nas fontes.
2. O verificador de consulta essencial não reconhecia “linguagem livre”. O cenário capturado mostrou explicitamente perguntas respondidas com base no catálogo. A verificação agora aceita essa formulação e mantém teste negativo para fluxo sem interação.
3. O auditor pediu consulta analítica de histórico adicional apesar de a consulta essencial já ser a pergunta do cliente. A instrução passou a avaliar o uso proposto sem exigir capacidade extra.
4. Após ocorrência de `invalid_noop_patch`, a instrução do revisor explicita omitir patches idênticos. O bloqueio e o teste negativo foram preservados.

A incompatibilidade de `allOf` foi reproduzida sem chamada paga e confirmada na [documentação oficial OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs).

## Arquivos de código e testes

- [src/lib/diagnostic/prompts.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/src/lib/diagnostic/prompts.ts>)
- [src/lib/diagnostic/schemas.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/src/lib/diagnostic/schemas.ts>)
- [src/lib/diagnostic/quality-gate.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/src/lib/diagnostic/quality-gate.ts>)
- [src/lib/diagnostic/solution-policy.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/src/lib/diagnostic/solution-policy.ts>)
- [src/lib/diagnostic/revise-diagnosis.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/src/lib/diagnostic/revise-diagnosis.ts>)
- [tests/quality-cases.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/tests/quality-cases.ts>)
- [tests/structure.test.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/tests/structure.test.ts>)
- [tests/final-refinement.test.ts](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/tests/final-refinement.test.ts>)

Também foram adicionados este relatório e evidências sintéticas em `tests/results-precisao-*`. Cópias e testes temporários de investigação foram removidos.

## Consumo observado

Comparação de uma geração completa de referência e a última geração aprovada disponível de cada caso, mesma entrada sintética por caso e mesmos modelos/budgets. Não é benchmark estatístico nem garantia de custo/latência. As tentativas intermediárias constam abaixo, sem selecionar apenas sucessos para ocultar custos de investigação.

| Caso | Chamadas antes → depois | Entrada antes → depois | Saída antes → depois | Total antes → depois | Variação total | Duração antes → depois |
|---|---:|---:|---:|---:|---:|---:|
| Atendimento | 4 → 4 | 15110 → 15856 | 4671 → 5549 | 19781 → 21405 | +8.2% | 43.0s → 42.5s |
| Financeiro | 4 → 4 | 15652 → 15909 | 5193 → 5260 | 20845 → 21169 | +1.6% | 45.3s → 42.5s |
| Vendas | 4 → 4 | 16057 → 14727 | 4940 → 4222 | 20997 → 18949 | -9.8% | 37.0s → 31.4s |

Total: **61623 → 61523 tokens (-0.16%)**. Quatro chamadas em cada uma dessas gerações completas. Algumas tentativas intermediárias acionaram a quinta chamada condicional de revisão, aumentando consumo e latência. Nenhuma nova chamada ou etapa foi adicionada ao produto.

Financeiro e Vendas foram aprovados antes do último esclarecimento do auditor sobre perguntas do cliente; Atendimento foi reexecutado após essa instrução. A suíte automatizada completa e o build foram executados depois de todas as alterações.

A referência Atendimento foi aprovada pelo motor antigo, mas o avaliador externo apontou “Capacidade inteligente não descrita”; a referência Financeiro reexecutada foi aprovada pelo motor antigo, mas o avaliador externo apontou consulta ausente. Não são referências de qualidade integralmente aprovadas. A primeira tentativa financeira foi interrompida em `invalid_clarification` e não foi usada como geração completa para comparar tokens.

### Tamanho dos prompts

Caracteres JavaScript, não tokens: ANALYZE 2804 → 2786; SOLUTIONS 5248 → 5171; FINAL 6330 → 6286; AUDIT 6208 → 6054. Todos menores; budgets e modelos inalterados.

## Validação final

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 229 aprovados, 21 ignorados (opt-in); 33 testes novos de refinamento incluídos.
- `npm run build`: aprovado.
- Financeiro real: aprovado, sem esclarecimento e com quatro chamadas.
- Vendas real: aprovado, quatro chamadas.
- Atendimento real após correção: aprovado, quatro chamadas.
- `git diff --check`: aprovado.

Os testes unitários de auditoria verificam a aplicação dos critérios e seus bloqueios; não simulam prova semântica do modelo. As gerações reais são evidência complementar.

## Exemplo financeiro real

- Solução: motor inteligente de fechamento financeiro.
- Entrada: planilhas mensais de vendas e gastos.
- Etapa exata: conferir estrutura, consolidar e calcular receita, gastos e lucro por regras conferidas.
- IA: resumir e explicar variações e tendências; revisão humana antes do fechamento.
- Métrica principal real: **Tempo total para fechamento mensal revisado**.
- Medição real: Data/hora de recebimento das planilhas e de entrega do fechamento aprovado Duração entre recebimento dos dados e aprovação final pelo gestor Comparar a média dos meses anteriores e posteriores à implantação Unidade: Horas.
- Evolução indicada na geração: explicações detalhadas em linguagem natural sob demanda e identificação de potenciais anomalias.
- Benefício proporcional: o tempo e o retrabalho podem diminuir; cálculos pertencem às regras exatas e a IA interpreta os resultados.

A regressão automatizada financeira também verifica a configuração com detecção de anomalias e síntese executiva, consulta opcional na evolução e métrica “Tempo total dedicado ao fechamento mensal”. Essa configuração de teste não deve ser confundida com a redação literal da geração real.

Saída completa: [Financeiro.json](<C:/Users/RENATO/Documents/ChatGPT/Diagnostico RGS IA/tests/results-precisao-final/Financeiro.json>)

## Todas as tentativas reais

| Pasta / caso | Tentativas de estágio | Etapas com usage | Tokens registrados | Resultado |
|---|---:|---:|---:|---|
| results-precisao-antes/Atendimento | 4 | 4 | 19781 | quality_evaluation_failed: Capacidade inteligente não descrita. |
| results-precisao-antes/Financeiro | 1 | 1 | 3578 | invalid_clarification |
| results-precisao-antes/Vendas | 4 | 4 | 20997 | aprovado |
| results-precisao-antes-reteste/Financeiro | 4 | 4 | 20845 | quality_evaluation_failed: Consulta analítica complementar ausente. |
| results-precisao-atendimento-corrigido/Atendimento | 4 | 4 | 21405 | aprovado |
| results-precisao-atendimento-final/Atendimento | 5 | 5 | 25884 | quality_gate_rejected: Consulta analítica adequada não incorporada ao workflow. |
| results-precisao-atendimento-trace/Atendimento | 5 | 5 | 26346 | aprovado |
| results-precisao-depois/Atendimento | 5 | 5 | 27549 | quality_gate_rejected: Consulta analítica adequada não incorporada ao workflow.; Classificação de volume sem referência nas fontes. |
| results-precisao-depois/Financeiro | 5 | 4 | 20979 | stage_revise_diagnosis_invalid_response |
| results-precisao-depois/Vendas | 5 | 4 | 19686 | stage_revise_diagnosis_invalid_response |
| results-precisao-depois-reteste/Atendimento | 5 | 5 | 28498 | quality_evaluation_failed: Família esperada ausente. |
| results-precisao-depois-reteste/Financeiro | 5 | 4 | 21403 | stage_revise_diagnosis_invalid_response |
| results-precisao-depois-reteste/Vendas | 4 | 4 | 21081 | aprovado |
| results-precisao-final/Atendimento | 5 | 5 | 26054 | invalid_noop_patch |
| results-precisao-final/Financeiro | 4 | 4 | 21169 | aprovado |
| results-precisao-final/Vendas | 4 | 4 | 18949 | aprovado |

Quando `usageStages` é menor que tentativas de estágio, o total registrado não equivale a uma geração completa. Nos casos `stage_revise_diagnosis_invalid_response`, a serialização da revisão falhou antes do envio ao provedor. Contagens locais são preservadas nos JSONs.

## Limites preservados

Sem alteração de frontend, formulário, layout, identidade visual, rate limit, modelos, budgets, arquitetura ou estrutura geral do pipeline. Sem nova auditoria, chat ou funcionalidade de consulta na ferramenta gratuita. A consulta é somente recomendação para a solução futura do cliente. Sem commit, push ou deploy.
