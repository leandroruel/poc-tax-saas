# IRRF de CDB/RDB para pessoa física residente — recorte mínimo pesquisado

> Data de corte: 20/08/2026. Pesquisa técnica baseada somente em fontes oficiais primárias. Este documento não substitui validação por profissional tributário nem habilita, por si só, transmissão à Receita Federal.

## Conclusão executiva

O recorte mais defensável para uma primeira implementação é:

- beneficiário **pessoa física residente no Brasil**;
- instrumento informado e previamente validado como **CDB ou RDB tributável**;
- uma única aplicação/lote, sem movimentações intermediárias;
- **resgate integral** ou liquidação integral no vencimento;
- ausência de rendimentos periódicos, cessão, repactuação ou mudança de titularidade;
- principal aplicado e valor bruto liquidado conhecidos;
- IOF-TVM calculado antes do IRRF, quando houver;
- fonte pagadora/interveniente identificada.

O Banco Central define CDB e RDB como títulos privados representativos de depósitos a prazo feitos por pessoas físicas ou jurídicas. Também distingue seus emissores autorizados. [Banco Central — O que são CDB e RDB?](https://www.bcb.gov.br/meubc/faqs/p/o-que-sao-cdb-e-rdb)

A regra geral confirmada para aplicações de renda fixa de residentes está nos arts. 45 e 46 da IN RFB nº 1.585/2015. O MAFON 2025 classifica, no código 8053, rendimentos de aplicações financeiras de renda fixa, exceto fundos, pagos a pessoa física. [IN RFB nº 1.585/2015](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) [MAFON 2025, pp. 67–70](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

### Status das afirmações

| Item | Status | Resultado |
| --- | --- | --- |
| CDB | Confirmado | Título privado representativo de depósito a prazo e sujeito à tabela regressiva de IR para PF. |
| RDB | Confirmado quanto à natureza; inferência quanto ao enquadramento fiscal individual | É título privado representativo de depósito a prazo. A aplicação da regra geral decorre de ser renda fixa e de o produto ter sido previamente classificado como tributável; não foi localizada, nas fontes normativas consultadas, uma regra que nomeie isoladamente todo RDB. |
| Resgate integral | Confirmado | Resgate e liquidação são eventos alcançados pelo IRRF. |
| Vencimento | Inferência controlada | Deve entrar somente quando o evento do emissor for uma liquidação/resgate integral com pagamento ou crédito. A mera chegada da data contratual, sem liquidação, não foi encontrada como fato gerador autônomo. |
| IOF antes do IRRF | Confirmado | A base do IRRF usa o valor da alienação líquido do IOF. |
| Contagem exata de dias | Lacuna | As faixas são definidas em dias, mas as fontes diretamente aplicáveis consultadas não tornam inequívoca a convenção de contagem. |
| Arredondamento/truncamento do tributo | Lacuna | Não foi encontrada regra substantiva inequívoca e específica para o cálculo de IOF/IRRF deste recorte. |

## Regra confirmada do IRRF

### Fato gerador e momento da retenção

Os rendimentos de renda fixa decorrentes de alienação, liquidação total ou parcial, resgate, cessão ou repactuação estão sujeitos ao IRRF. Para esse fim, “alienação” inclui liquidação, resgate, cessão e repactuação. [IN RFB nº 1.585/2015, art. 46, §§ 1º e 2º](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) [MAFON 2025, código 8053, pp. 67–70](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

No recorte proposto, a retenção ocorre no pagamento ou crédito do rendimento ou na alienação da aplicação. A responsabilidade cabe à instituição ou entidade que faça o pagamento ou crédito ao beneficiário final ou, nos demais casos, à pessoa jurídica que paga o rendimento. [MAFON 2025, p. 70](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

Para PF, o MAFON classifica o regime como definitivo. [MAFON 2025, p. 69](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

### Base de cálculo e ordem IOF → IRRF

A base do IRRF é a diferença positiva entre o valor da alienação **líquido do IOF**, quando aplicável, e o valor da aplicação financeira. Essa redação confirma que o IOF deve ser apurado primeiro. [IN RFB nº 1.585/2015, art. 46, § 1º](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) [MAFON 2025, p. 68](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

Para o caso mínimo, sem rendimentos periódicos nem movimentos intermediários:

```text
rendimento_bruto = valor_bruto_liquidado - principal_aplicado
base_irrf = max(0, valor_bruto_liquidado - iof_devido - principal_aplicado)
irrf = base_irrf × aliquota_irrf
valor_liquido = valor_bruto_liquidado - iof_devido - irrf
```

As fórmulas acima são uma tradução matemática da base legal, não texto literal da norma. É uma **inferência operacional** válida apenas dentro das pré-condições deste recorte.

### Alíquotas por prazo

| Prazo da aplicação | Alíquota IRRF |
| --- | ---: |
| Até 180 dias | 22,5% |
| De 181 a 360 dias | 20% |
| De 361 a 720 dias | 17,5% |
| Acima de 720 dias | 15% |

As faixas constam do art. 1º da Lei nº 11.033/2004 e do art. 46 da IN RFB nº 1.585/2015, e são reproduzidas no MAFON. [Lei nº 11.033/2004, art. 1º](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11033compilado.htm) [IN RFB nº 1.585/2015, art. 46](https://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=67494) [MAFON 2025, p. 68](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)

## Dependência obrigatória: IOF sobre títulos e valores mobiliários

### Fato, contribuinte, responsável e base

O fato gerador do IOF-TVM inclui aquisição, cessão, resgate, repactuação ou pagamento para liquidação de títulos e valores mobiliários e ocorre no ato da operação. No resgate, o contribuinte é o titular da aplicação. Entre os responsáveis pela cobrança e recolhimento estão as instituições autorizadas a operar com títulos e valores mobiliários e, conforme o arranjo, a instituição que liquida a operação ao beneficiário final. [Decreto nº 6.306/2007, arts. 25–27](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm)

A base legal geral é o valor do resgate, cessão ou repactuação. Para operações de renda fixa, o art. 32 determina alíquota de 1% ao dia sobre esse valor, **limitada ao rendimento da operação** conforme o prazo e a tabela do Anexo. [Decreto nº 6.306/2007, arts. 28 e 32](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm)

Tradução operacional, ainda sujeita às lacunas de dias e precisão monetária:

```text
limite_iof = rendimento_bruto × percentual_limite_do_dia
iof_devido = min(valor_bruto_liquidado × 1% × quantidade_de_dias, limite_iof)
```

### Tabela regressiva diária

O Anexo do Decreto nº 6.306/2007 contém os seguintes percentuais-limite do rendimento. [Decreto nº 6.306/2007, Anexo](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm)

| Dia | % limite | Dia | % limite |
| ---: | ---: | ---: | ---: |
| 1 | 96% | 16 | 46% |
| 2 | 93% | 17 | 43% |
| 3 | 90% | 18 | 40% |
| 4 | 86% | 19 | 36% |
| 5 | 83% | 20 | 33% |
| 6 | 80% | 21 | 30% |
| 7 | 76% | 22 | 26% |
| 8 | 73% | 23 | 23% |
| 9 | 70% | 24 | 20% |
| 10 | 66% | 25 | 16% |
| 11 | 63% | 26 | 13% |
| 12 | 60% | 27 | 10% |
| 13 | 56% | 28 | 6% |
| 14 | 53% | 29 | 3% |
| 15 | 50% | 30 | 0% |

No 30º dia, o próprio Anexo fixa limite zero. Depois dele, o art. 33 reduz a zero a alíquota das demais operações com títulos ou valores mobiliários. Para o recorte ordinário aqui definido, o resultado é, portanto, **IOF zero a partir do 30º dia**. A classificação correta é alíquota/limite zero, e não uma isenção genérica nem ausência de fato gerador. [Decreto nº 6.306/2007, arts. 32 e 33 e Anexo](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm)

**Inferência para RDB:** como o art. 32 alcança operações de renda fixa em geral, o mesmo limite é esperado para RDB tributável; ainda assim, a fonte operacional específica localizada nomeia CDB, não RDB. O enquadramento deve ser validado antes de oferecer o cálculo como produto fiscal.

## Escrituração, código e recolhimento

- Código DARF: **8053 — Rendimentos de Capital — Títulos de renda fixa — Pessoa Física**. A agenda oficial de 2026 associa o débito a `DCTFWeb Geral Mensal / Reinf RET`. [Agenda Tributária da Receita, 03/06/2026](https://www.gov.br/receitafederal/pt-br/assuntos/agenda-tributaria/2026/junho/dia-03-06-2026)
- Para o IOF sobre títulos ou valores mobiliários, a Receita lista o código/variação **6854/02**, de periodicidade decendial. [Receita Federal — códigos e extensões do IOF](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/dctf/tabelas-de-codigos-extensoes/iof/imposto-sobre-operacoes-de-credito-e-seguro-ou-relativas-a-titulos-ou-valores-mobiliarios-iof)
- Na EFD-Reinf, o evento aplicável ao pagamento a PF é o **R-4010**. A tabela oficial vigente em 15/01/2026 mapeia a natureza **12017 — Rendimento de aplicações financeiras de renda fixa decorrente de alienação, liquidação, resgate, cessão ou repactuação** ao código estendido **8053-02**, com período decendial. [Tabelas oficiais da EFD-Reinf — 15/01/2026](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/sped/documentos-tecnicos-efd-reinf/versao-atual/tabelas/efd-reinf-tabelas-15012026.zip/view)
- O MAFON informa recolhimento até o terceiro dia útil subsequente ao decêndio do fato gerador. [MAFON 2025, p. 70](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/manuais/irrf/mafon-2025.pdf)
- Para fatos desde janeiro de 2024, retenções de IRRF não decorrentes do trabalho passaram à DCTFWeb. A DCTFWeb é formada a partir dos dados da EFD-Reinf, entre outras escriturações. [Perguntas e respostas DCTFWeb, setembro/2025, item 4.1](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/DCTFWeb/arquivos/perguntas-e-respostas-dctfweb-2025-09-23.pdf) [Serviço DCTFWeb](https://www.gov.br/pt-br/servicos/declarar-debitos-e-creditos-tributarios-federais?id=10969&origem=servico)
- Desde o ano-calendário de 2025, a DIRF foi integralmente substituída, para esses pagamentos, pelos eventos da EFD-Reinf/eSocial. [Receita Federal — fim da DIRF](https://www.gov.br/receitafederal/pt-br/canais_atendimento/fale-conosco/suporte-a-dirf/leiame)

O MVP pode produzir memória e exportação compatível para conferência, mas **não deve prometer transmitir EFD-Reinf, confessar débito em DCTFWeb ou emitir DARF** sem um escopo separado, credenciais, validação de leiaute e revisão tributária.

## Mudanças e tentativas de mudança em 2025–2026

A MP nº 1.303/2025 tentou substituir a tabela regressiva por IRRF de 17,5% sobre rendimentos de aplicações financeiras, com efeitos previstos a partir de 2026, além de alterar o tratamento da PF no ajuste anual. [MP nº 1.303/2025, arts. 3º e 5º](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/mpv/mpv1303.htm)

Essa mudança **não está vigente**: o Congresso registra a MP como “sem eficácia”, e o Ato do Presidente da Mesa nº 67/2025 declarou encerrada sua vigência em 08/10/2025. [Congresso Nacional — MPV 1303/2025](https://www.congressonacional.leg.br/pt_BR/materias/medidas-provisorias/-/mpv/169059) [Câmara dos Deputados — tramitação e Ato nº 67/2025](https://www.camara.leg.br/proposicoesWeb/prop_imp?idProposicao=2525180&tp=reduzida)

Portanto, na data de corte, permanecem as quatro faixas de 22,5% a 15%. A substituição da DIRF e a integração EFD-Reinf/DCTFWeb são mudanças operacionais vigentes, mas não alteram a fórmula material deste recorte.

## Lacunas que bloqueiam uma implementação fiscal definitiva

### Contagem dos dias

As fontes diretamente aplicáveis definem limites de 180/360/720 dias para IRRF e uma tabela de 1 a 30 dias para IOF, mas não foi localizada nelas uma definição inequívoca sobre:

- dias corridos ou úteis;
- inclusão ou exclusão do dia da aplicação e do dia da liquidação;
- horário e fuso para operações em datas-limite;
- tratamento de liquidação em fim de semana/feriado ou data contratual diferente da financeira.

Não se deve codificar essa convenção como fato legal sem confirmação por especialista e sem confrontá-la com a especificação operacional do emissor/depositária.

### Arredondamento e truncamento

Não foi localizada regra substantiva específica para arredondar ou truncar o IOF-TVM e o IRRF deste recorte. Uma FAQ da EFD-Reinf diz, em termos gerais, que o sistema trunca multiplicações na segunda casa decimal, mas a tolerância detalhada logo depois enumera eventos previdenciários e **não inclui o R-4010**. Logo, ela não é evidência suficiente para definir a fórmula tributária de CDB/RDB. [Receita Federal — FAQ EFD-Reinf 7.9](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/sped/efd-reinf/efdr/7-integracao-da-efd-reinf-com-a-dctfweb/7-9-quais-sao-os)

Antes de implementar, é necessário confirmar:

- escala interna de cálculo;
- regra de arredondamento ou truncamento de IOF e IRRF separadamente;
- momento em que a redução a centavos ocorre;
- se somatórios de lote usam valores por operação já reduzidos ou total de alta precisão;
- reconciliação com valores aceitos pela EFD-Reinf/DCTFWeb.

## Exclusões explícitas do MVP

Devem ficar fora até haver regras próprias e validação profissional:

- beneficiário PJ, não residente, imune, isento ou sob decisão judicial;
- LCI, LCA, CRI, CRA, poupança, debênture incentivada, LCD e qualquer instrumento isento ou com alíquota especial;
- fundos de investimento, ETF, COE, swap, ouro, renda variável, derivativos e títulos públicos;
- resgate parcial, múltiplos lotes, reinvestimento automático ou principal de origem composta;
- rendimentos/cupons periódicos, bônus ou remuneração adicional;
- cessão, alienação secundária, repactuação, portabilidade ou mudança de titularidade;
- aplicação com perda, estorno, correção retroativa, sucessão ou bloqueio judicial que exija tratamento diferente;
- geração/transmissão de R-4010, fechamento da EFD-Reinf, confissão na DCTFWeb ou emissão de DARF;
- definição automática da natureza tributária apenas pelo nome comercial do produto;
- qualquer cálculo enquanto contagem de dias e precisão monetária não estiverem formalmente aprovadas.

## Dados mínimos recomendados para futura modelagem

Isto é desenho de produto, não obrigação legal literal:

```text
instrumentType: CDB | RDB
taxTreatment: taxable_general_rule
beneficiaryPersonType: PF
beneficiaryResidency: BR
issuerTaxId
externalOperationId
investedAt
liquidatedAt
settlementKind: full_redemption | maturity_liquidation
principalAmount
grossSettlementAmount
hasPeriodicIncome: false
iofAmount + iofRuleVersion
irrfBase + irrfRate + irrfAmount + irrfRuleVersion
revenueCode: 8053
efdReinfNatureCode: 12017
sourceEvidenceSnapshot
```

CPF não é necessário para determinar a fórmula. Caso seja posteriormente necessário para escrituração, deve permanecer fora do motor tributário e ser tratado como dado pessoal protegido.

## Gate recomendado antes de desenvolver

Solicitar parecer escrito de profissional tributário que confirme, no mínimo:

1. enquadramento de CDB e RDB no mesmo tratamento para cada produto suportado;
2. convenção exata de contagem de dias do IRRF e IOF;
3. precisão, truncamento/arredondamento e cálculo em lote;
4. responsabilidade da fonte pagadora/interveniente em cada fluxo real;
5. campos e reconciliação do R-4010/12017/8053-02;
6. casos de alíquota zero, isenção, dispensa e retenção mínima;
7. exemplos homologados nas fronteiras de 29/30, 180/181, 360/361 e 720/721 dias.
