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
senha própria em `TAXMAN_ADMIN_PASSWORD` e uma senha local para o Silo em
`SILO_ROOT_PASSWORD`.

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
- Silo (API S3): `http://localhost:9000`
- Silo (console local): `http://localhost:9001`

Além dos processos web e API, o Compose inicia:

- PostgreSQL para dados transacionais e auditoria;
- Redis com AOF e política `noeviction`, usado pelo BullMQ;
- um worker separado da API para execução assíncrona; cada tipo de job define
  sua política explícita de tentativas e backoff;
- Silo, storage local compatível com S3, e a criação idempotente do bucket.

O worker é o responsável pelos gatilhos agendados, incluindo a ativação de
regras aprovadas quando a vigência chega. API e worker usam as mesmas portas de
aplicação, sem depender de um provedor de nuvem.

## Decisões importantes

- Better Auth `Organization` é o tenant canônico; um usuário possui no máximo um `Member` por constraint de banco.
- O cliente nunca envia `tenantId`; a API o deriva da organização ativa da sessão.
- CPF reside em `UserProfile`, protegido por AES-256-GCM e índice cego HMAC-SHA256. A API não devolve CPF.
- Cálculos e logs de auditoria são append-only; um recálculo cria novo registro relacionado e só pode apontar para um cálculo do mesmo tenant.
- O ledger de cálculos usa cursor estável, filtros validados e escopo obrigatório por organização.
- Papéis organizacionais são `owner`, `admin`, `operator` e `reviewer`; permissões são verificadas no servidor, não apenas escondidas na interface.
- Somente `super_admin` administra regras globais. Tenants não alteram fórmulas.
- A vigência é escolhida por `operation.occurredOn`, não pela data atual nem por uma data livre de consulta.
- O MVP suporta somente crédito PJ com principal/prazo definidos e VGBL. Outras modalidades são rejeitadas em vez de aproximadas.
- Jobs, tentativas e notificações possuem escopo por organização. O sino do dashboard consulta somente notificações do usuário autenticado.
- Arquivos de importação e exportação usam uma porta S3; localmente ela aponta para o Silo e pode ser trocada por outro storage compatível sem alterar o domínio.
- A importação CSV usa um assistente de quatro etapas: upload, mapeamento de colunas, validação e cálculo em chunks. Arquivos idênticos são deduplicados por tenant e hash.
- Cada linha válida reutiliza o mesmo caso de uso do cálculo individual. O vínculo linha↔cálculo é atômico, permitindo retomada sem duplicar registros.
- Um lote processado termina em revisão: linhas inválidas e falhas são paginadas para o revisor, falhas podem ser reprocessadas e o encerramento exige reconhecimento explícito das pendências e uma nota auditável.
- Lotes não podem ser cancelados enquanto validação ou cálculo ainda escrevem resultados. Fora desses estados, o cancelamento preserva o arquivo e a justificativa na trilha de auditoria.
- Jobs com falha têm tentativas automáticas e retry manual autorizado; progresso, tentativas e erros permanecem consultáveis no dashboard.
- O histórico pode ser exportado em CSV compatível com Excel, com colunas e separador configuráveis, ou em JSON de evidência versionado. Os filtros e o instante de corte ficam registrados para que o resultado seja reproduzível.
- Exportações são geradas pelo worker, armazenadas no Silo e baixadas somente por rota autenticada e escopada pelo tenant. Células CSV potencialmente interpretadas como fórmulas são neutralizadas.
- O dashboard resume IOF apurado nos últimos 30 dias, resultados que exigem atenção e a atividade diária de 14 dias. A série usa a data de processamento no fuso de São Paulo e sempre filtra a organização autenticada.

Veja [o mapa do domínio](apps/api/src/domain/README.md) para localizar rapidamente cada regra de negócio.

## Aviso

Este MVP não substitui parecer tributário. As versões iniciais foram organizadas a partir de fontes oficiais, mas precisam de revisão e aprovação por profissional qualificado antes de uso produtivo.
