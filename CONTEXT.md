# TaxMan

TaxMan apura tributos de operações financeiras B2B e preserva a memória de cada decisão para revisão e auditoria.

## Language

**Organização**:
A empresa cliente que constitui a fronteira de isolamento dos dados no TaxMan.
_Evitar_: Tenant, conta, usuário empresarial

**Usuário**:
A pessoa física autenticada que atua como membro de exatamente uma organização.
_Evitar_: Cliente, empresa, tenant

**Cálculo**:
O registro imutável de uma apuração tributária, incluindo entrada, resultado e a versão da regra aplicada.
_Evitar_: Simulação, quando o resultado foi efetivamente registrado

**Versão de regra**:
Uma interpretação tributária auditada com vigência definida; versões aprovadas não são editadas.
_Evitar_: Fórmula do cliente, configuração do tenant

**Resgate de renda fixa**:
O recebimento integral, por vencimento ou resgate, de um investimento CDB ou RDB dentro do recorte suportado.
_Evitar_: Venda, cupom, resgate parcial

**Liquidação tributária**:
A memória conjunta dos tributos que incidem sobre um mesmo resgate, calculados na ordem jurídica aplicável.
_Evitar_: Apenas IRRF, quando a apuração também depende de IOF
