# TaxMan

MVP B2B para cálculo auditável de IOF com autenticação, isolamento por empresa, regras globais versionadas e histórico imutável.

## Executar com Docker

```bash
docker compose up --build
```

Acesse `http://localhost:3001`. O seed local cria o super-admin:

- e-mail: `admin@taxman.local`
- senha: `TaxMan-local-2026!`

No primeiro login, conclua o onboarding com CPF, empresa, CNPJ e segmento. As credenciais padrão são apenas para ambiente local e podem ser substituídas pelas variáveis descritas em [.env.example](.env.example).

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
