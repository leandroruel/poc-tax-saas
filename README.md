# TaxMan

MVP B2B para cálculo auditável de IOF com autenticação, isolamento por empresa, regras globais versionadas e histórico imutável.

## Executar com Docker

Crie o arquivo local de ambiente e substitua todos os valores `replace-*`:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -base64 32
openssl rand -base64 32
docker compose up --build
```

A primeira saída pode ser usada em `BETTER_AUTH_SECRET`; as duas seguintes, em
`PERSONAL_DATA_ENCRYPTION_KEY` e `PERSONAL_DATA_INDEX_KEY`. Defina também uma
senha própria em `TAXMAN_ADMIN_PASSWORD`.

Acesse `http://localhost:3001`. O seed cria o super-admin usando
`TAXMAN_ADMIN_EMAIL` e `TAXMAN_ADMIN_PASSWORD`; não existem credenciais padrão
embutidas na aplicação.

No primeiro login, conclua o onboarding com CPF, empresa, CNPJ e segmento. O
arquivo [.env.example](.env.example) documenta todas as variáveis necessárias.

## Desenvolvimento com pnpm

Com PostgreSQL disponível e `apps/api/.env` configurado:

```bash
pnpm install
pnpm --filter api prisma:migrate
pnpm --filter api seed
pnpm dev
```

- Web: `http://localhost:3001`
- API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`

## Decisões importantes

- Better Auth `Organization` é o tenant canônico; um usuário possui no máximo um `Member` por constraint de banco.
- O cliente nunca envia `tenantId`; a API o deriva da organização ativa da sessão.
- CPF reside em `UserProfile`, protegido por AES-256-GCM e índice cego HMAC-SHA256. A API não devolve CPF.
- Cálculos e logs de auditoria são append-only; uma recálculo cria novo registro relacionado.
- Somente `super_admin` administra regras globais. Tenants não alteram fórmulas.
- A vigência é escolhida por `operation.occurredOn`, não pela data atual nem por uma data livre de consulta.
- O MVP suporta somente crédito PJ com principal/prazo definidos e VGBL. Outras modalidades são rejeitadas em vez de aproximadas.

Veja [o mapa do domínio](apps/api/src/domain/README.md) para localizar rapidamente cada regra de negócio.

## Aviso

Este MVP não substitui parecer tributário. As versões iniciais foram organizadas a partir de fontes oficiais, mas precisam de revisão e aprovação por profissional qualificado antes de uso produtivo.
