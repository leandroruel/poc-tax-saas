# Domínio do TaxMan

Esta pasta não importa Fastify, Prisma ou Better Auth. Ela contém somente regras que um desenvolvedor precisa ler para entender o negócio.

- `iof/operation.ts`: os únicos fatos de operação aceitos no MVP — crédito PJ com principal/prazo definidos e VGBL.
- `iof/rule.ts`: contrato tipado de uma versão de regra e de seu tratamento tributário.
- `iof/iof-engine.ts`: decisão determinística do IOF. A data da operação escolhe a vigência; somente versões aprovadas participam.
- `iof/outcome.ts`: todos os resultados possíveis, inclusive falta de contexto e operação não suportada.
- `rule-governance/rule-version-lifecycle.ts`: workflow editorial e status de implantação derivados da vigência.
- `identity/`: normalização e validação de CPF/CNPJ. Criptografia é responsabilidade da infraestrutura.
- `tenancy/tenant-context.ts`: segmento e identidade do tenant usados pelo motor.
- `tenancy/organization-access.ts`: papéis e permissões organizacionais. É a política central usada pelos guards HTTP e pela UI.
- `operations/import-batch.ts`: ciclo de vida permitido para lotes; estados fechados e cancelados são terminais e imutáveis.
- `operations/csv.ts`: parsing determinístico de CSV, incluindo delimitador, aspas e números de linha para evidência.
- `operations/import-mapping.ts`: tradução explícita das colunas e formatos locais para operações IOF; valores inválidos nunca são aproximados.
- `shared/money.ts`: dinheiro em centavos com `bigint`, sem aritmética tributária em ponto flutuante.

O caminho de uma requisição é:

`HTTP → caso de uso → portas → domínio → adaptadores Prisma`

Regras globais nunca recebem `tenantId`. Dados de cálculo sempre recebem o tenant derivado da sessão autenticada.

O histórico de cálculos é um read model da aplicação. JSON persistido é validado por codecs antes de atravessar a porta `CalculationLedger`; o adapter Prisma não devolve `unknown` para as interfaces HTTP.

> O catálogo inicial implementa o recorte acordado para o MVP e deve ser validado por profissional tributário antes de uso produtivo ou tomada de decisão fiscal.
