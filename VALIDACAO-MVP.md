# Refinamento global: MVP enxuto — 15/10/2026

Diretório exclusivo: C:\Users\RENATO\Documents\ChatGPT\Diagnostico RGS IA.

## Comportamento

- A escolha compara impacto potencial, viabilidade e velocidade de validação. O menor escopo suficiente tem prioridade; uma solução mais ampla exige justificativa ligada ao gargalo.
- Cada candidato tem escopoInicial: descrição, validação inicial, até duas evoluções opcionais e indicação de consulta essencial ao MVP.
- A composição não pode trocar a solução selecionada. A recomendação apresenta primeira implementação e, quando pertinente, “Evolução possível após validação inicial”.
- Consulta útil, mas não essencial, não é exigida no fluxo inicial. Funções opcionais não devem ser incorporadas por padrão.
- As vinte famílias canônicas continuam disponíveis internamente. O relatório usa rótulos de negócio, uma principal e até duas complementares; alternativas mostram no máximo três famílias relevantes.
- A família exibida na solução escolhida acompanha a classificação do relatório. Os rótulos exibidos são conferidos contra as famílias internas sustentadas.
- A métrica principal tem finalidade de resultado do negócio. Atividade do modelo pode aparecer apenas em métricas técnicas secundárias quando útil.
- Volume não recebe qualificação sem referência. Um número isolado não permite concluir alto/baixo volume; fatos e demanda relatada prevalecem.
- Linguagem pública evita jargão. Cada seção tem uma função: oportunidade, capacidade, comparação, escolha e etapas. A composição deixa de inserir uma repetição fixa da explicação da IA.

## Quality Gate

Seis critérios adicionados, total de trinta e um:

1. escopoNecessario: ausência de funções dispensáveis no primeiro escopo.
2. alternativaEnxuta: consideração da menor solução suficiente e teste inicial.
3. metricaNegocio: principal ligada à dor, além de atividade técnica.
4. volumeSustentado: qualificações com referência.
5. linguagemEmpresario: termos que ajudem a entender a solução.
6. semRedundancia: informação nova em cada seção.

Erros determinísticos adicionais cobrem qualificações de volume sem referência textual, jargão na proposta, métricas claramente técnicas como principal e repetição literal longa entre seções. Avaliação semântica de suficiência do MVP, qualidade da métrica e repetição por paráfrase continua no auditor independente.

## Validação

| Check | Resultado |
| --- | --- |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test | 163 passaram; 14 opt-in ignorados |
| npm run test:quality | 16 passaram, incluídos na suíte completa |
| npm run build | PASS |
| npm run test:e2e | 4 passaram |
| Layout, formulário, CSS e rate limit | Arquivos com os mesmos hashes anteriores |

Trinta regressões foram adicionadas em tests/incremental.test.ts: classificação interna e rótulos públicos, limite de famílias, subconjunto relevante em vez de lista completa, consulta/painel apenas como evolução, respeito à escolha da seleção, volume com e sem referência, jargão, principal técnica versus secundária, finalidade da métrica, repetição, seis checks novos e limite de tamanho da recomendação.

As regressões anteriores de esclarecimento e respostas indisponíveis continuam passando. Não houve alteração do frontend, formulário principal, ordem dos campos, logo, estilos, rate limit, autenticação, dependências ou credenciais. Nenhum commit, push ou deploy executado.

## Limite desta rodada

Não foram feitas novas chamadas à OpenAI. Os testes automatizados verificam contratos, composição, bloqueios e revisão; não comprovam precisão semântica universal do modelo nem substituem gerações reais. Relatórios históricos de outras versões não são aceitação desta mudança. A suíte real opt-in continua disponível quando houver acesso e saldo válidos.
