# Domínio do TaxMan

Esta pasta não importa Fastify, Prisma ou Better Auth. Ela contém somente regras que um desenvolvedor precisa ler para entender o negócio.

- `iof/operation.ts`: os únicos fatos de operação aceitos no MVP — crédito PJ com principal/prazo definidos e VGBL.
- `iof/rule.ts`: contrato tipado de uma versão de regra e de seu tratamento tributário.
- `iof/iof-engine.ts`: decisão determinística do IOF. A data da operação escolhe a vigência; somente versões aprovadas participam.
- `iof/outcome.ts`: todos os resultados possíveis, inclusive falta de contexto e operação não suportada.
- `fixed-income/operation.ts`: fatos aceitos no recorte de resgate integral ou vencimento de CDB/RDB tributável para PF residente.
- `fixed-income/rule.ts`: versões independentes das regras de IOF-TVM e IRRF, incluindo políticas explícitas de prazo e arredondamento.
- `fixed-income/fixed-income-tax-engine.ts`: liquidação conjunta e determinística; calcula primeiro o IOF sobre o rendimento e depois o IRRF sobre o rendimento líquido de IOF.
- `fixed-income/outcome.ts`: memória de liquidação com os dois tributos, bases, alíquotas, códigos de receita e evidências.
- `rule-governance/rule-version-lifecycle.ts`: workflow editorial e status de implantação derivados da vigência.
- `identity/`: normalização e validação de CPF/CNPJ. Criptografia é responsabilidade da infraestrutura.
- `tenancy/tenant-context.ts`: segmento e identidade do tenant usados pelo motor.
- `tenancy/organization-access.ts`: papéis e permissões organizacionais. É a política central usada pelos guards HTTP e pela UI.
- `operations/import-batch.ts`: ciclo de vida permitido para lotes; estados fechados e cancelados são terminais e imutáveis.
- `operations/csv.ts`: parsing determinístico de CSV, incluindo delimitador, aspas e números de linha para evidência.
- `operations/import-mapping.ts`: tradução explícita das colunas e formatos locais para operações IOF; valores inválidos nunca são aproximados.
- `shared/money.ts`: dinheiro em centavos com `bigint`, sem aritmética tributária em ponto flutuante.
- `shared/local-date.ts` e `shared/percentage.ts`: datas civis e percentuais sem dependência de timezone ou ponto flutuante.

O caminho de uma requisição é:

`HTTP → caso de uso → portas → domínio → adaptadores Prisma`

Regras globais nunca recebem `tenantId`. Dados de cálculo sempre recebem o tenant derivado da sessão autenticada.

O histórico de cálculos é um read model da aplicação. JSON persistido é validado por codecs antes de atravessar a porta `CalculationLedger`; o adapter Prisma não devolve `unknown` para as interfaces HTTP.

> O catálogo inicial implementa o recorte acordado para o MVP e deve ser validado por profissional tributário antes de uso produtivo ou tomada de decisão fiscal.

O módulo `fixed-income` é, por enquanto, uma especificação executável isolada: ele não está registrado na API nem possui regras aprovadas no seed. A habilitação depende de validar profissionalmente a contagem de dias, o arredondamento e o enquadramento dos produtos descritos em `docs/research/irrf-cdb-rdb.md`.
