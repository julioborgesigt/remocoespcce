# Relatório de Auditoria Completa do Projeto

## Sistema de Remoção de Servidores — PCCE

**Data da Auditoria:** 2026-02-12
**Auditor:** Revisão automatizada (Senior Dev)
**Versão do Projeto:** 1.0.0
**Repositório:** remocoespcce

---

## 1. VISÃO GERAL DO PROJETO

### 1.1 Descrição
Sistema web para gerenciamento de remoção (transferência) de servidores públicos entre cidades, baseado em critérios de antiguidade e permutas circulares. O sistema permite que servidores solicitem transferência indicando até 3 cidades de preferência, e um algoritmo processa essas solicitações respeitando prioridade por antiguidade e detectando permutas possíveis.

### 1.2 Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Runtime | Node.js | >=18.0.0 |
| Backend | Express.js | 4.21.2 |
| ORM | Sequelize | 6.37.5 |
| Banco de Dados | MySQL | via mysql2 3.12.0 |
| Frontend | Vue 3 (CDN) | 3.5.13 |
| UI Framework | Vuetify | 3.7.6 |
| State Management | Pinia | 2.3.1 |
| Roteamento Frontend | Vue Router | 4.5.0 |
| Autenticação | JWT | jsonwebtoken 9.0.2 |
| Hash de Senhas | bcryptjs | 2.4.3 |
| Segurança HTTP | Helmet | 8.0.0 |
| Deploy | Render.com | via render.yaml |

### 1.3 Estatísticas do Repositório

| Métrica | Valor |
|---------|-------|
| Total de commits | 11 |
| Contribuidores | 2 (julioborgesigt: 7, Claude: 4) |
| Idade do projeto | ~2 dias |
| Branches | master (local), main (remote) |
| Arquivos JS backend | ~12 |
| Arquivos JS frontend | ~14 |
| Linhas de código estimadas | ~2.500 |

---

## 2. ARQUITETURA

### 2.1 Diagrama Estrutural

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                       │
│  Vue 3 + Vuetify 3 + Pinia + Vue Router (via CDN)       │
│  Sem build step - Scripts carregados diretamente         │
├─────────────────────────────────────────────────────────┤
│                          │ HTTP/JSON                     │
├─────────────────────────────────────────────────────────┤
│                   BACKEND (Express.js)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐      │
│  │Middleware │  │  Routes   │  │    Services       │      │
│  │  (Auth)   │  │(Controllers│  │(algoritmoRemocao)│      │
│  └──────────┘  └──────────┘  └───────────────────┘      │
├─────────────────────────────────────────────────────────┤
│               Sequelize ORM (Models)                     │
├─────────────────────────────────────────────────────────┤
│                    MySQL Database                        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Avaliação da Arquitetura

**Pontos positivos:**
- Separação clara entre backend e frontend (SPA + API REST)
- Padrão MVC aplicado no backend (Models, Routes/Controllers, Services)
- Camada de serviço isolada para o algoritmo de negócio
- Middleware de autenticação reutilizável
- State management centralizado no frontend com Pinia

**Pontos de atenção:**
- Sem camada de repositório — as queries são feitas diretamente nas rotas
- O frontend não possui build step (bundling/minification), o que prejudica performance em produção
- Dependências do frontend carregadas inteiramente via CDN — risco de indisponibilidade
- Falta uma camada de DTOs (Data Transfer Objects) — os modelos são expostos diretamente na API

---

## 3. ANÁLISE DE SEGURANÇA

### 3.1 Pontos Fortes

| Aspecto | Implementação | Arquivo |
|---------|--------------|---------|
| Hashing de senhas | bcrypt com salt rounds 12 | `src/routes/auth.js:86` |
| JWT Authentication | Token com expiração (8h padrão) | `src/middleware/auth.js` |
| Helmet | Headers de segurança + CSP configurado | `server.js:13-42` |
| Rate Limiting | 300 req/15min global, 15 tentativas login | `server.js:49-64` |
| Input Validation | express-validator em todas as rotas | Todas as rotas |
| CORS | Habilitado | `server.js:44` |
| Error hiding | Mensagens genéricas em produção | `server.js:84-88` |
| Exclusão de senha_hash | Não retornada em queries de listagem | `src/routes/servidores.js:10` |

### 3.2 Vulnerabilidades e Riscos Identificados

#### CRÍTICO

| # | Vulnerabilidade | Localização | Descrição |
|---|----------------|-------------|-----------|
| S1 | **JWT Secret hardcoded como fallback** | `src/middleware/auth.js:4` | O valor `'dev-secret-troque-em-producao'` é usado como fallback se `JWT_SECRET` não estiver definido. Em produção, se a env var não for configurada, qualquer pessoa poderia forjar tokens. |
| S2 | **Credenciais default do admin** | `src/seeders/mock.js:26-27` | Admin padrão `ADMIN001/admin123` é previsível. Se o seed for executado em produção sem alterar as credenciais, o sistema ficará comprometido. |
| S3 | **`'unsafe-eval'` no CSP** | `server.js:20` | Permitir `unsafe-eval` na Content Security Policy abre brecha para ataques XSS via eval(). Isso é necessário para Vue 3 com templates em runtime, mas é um risco. |
| S4 | **`'unsafe-inline'` para scripts e estilos** | `server.js:19,26` | Permite execução de scripts inline, reduzindo a proteção do CSP. |

#### ALTO

| # | Vulnerabilidade | Localização | Descrição |
|---|----------------|-------------|-----------|
| S5 | **CORS sem restrição de origem** | `server.js:44` | `app.use(cors())` sem configuração permite requisições de qualquer domínio. Em produção, deveria restringir para o domínio da aplicação. |
| S6 | **Registro aberto sem validação** | `src/routes/auth.js:56-114` | Qualquer pessoa pode se registrar como servidor sem verificação de identidade. Não há validação se a matrícula é real, nem aprovação administrativa. |
| S7 | **Sem proteção CSRF** | Global | Não há token CSRF implementado. Embora JWT via header mitigue parcialmente, formulários podem ser vulneráveis. |
| S8 | **Token armazenado em localStorage** | `public/js/stores/auth.js:34,63` | localStorage é vulnerável a XSS. Se um script malicioso for injetado, pode roubar o token JWT. sessionStorage ou cookies httpOnly seriam mais seguros. |

#### MÉDIO

| # | Vulnerabilidade | Localização | Descrição |
|---|----------------|-------------|-----------|
| S9 | **Sem log de auditoria** | Global | Não há registro de ações sensíveis (login, processamento do algoritmo, reset de pedidos, criação/exclusão de cidades). |
| S10 | **Sequelize sync com alter em dev** | `server.js:100` | `{ alter: true }` pode causar perda de dados. Deveria usar migrations. |
| S11 | **Falta de rate limit por IP no registro** | `src/routes/auth.js` | Um atacante poderia criar milhares de contas falsas. |

---

## 4. QUALIDADE DO CÓDIGO

### 4.1 Métricas Gerais

| Aspecto | Nota (1-10) | Observação |
|---------|:-----------:|-----------|
| Organização de arquivos | 8 | Estrutura clara e previsível |
| Nomenclatura | 9 | Variáveis e funções em português, consistente |
| Tratamento de erros | 6 | try/catch presente, mas sem categorização de erros |
| Documentação inline | 5 | Comentários presentes no algoritmo, ausentes nas rotas |
| Reutilização de código | 6 | Alguma duplicação na lógica de alocação |
| Complexidade ciclomática | 7 | Algoritmo é complexo por natureza, mas bem estruturado |
| Consistência de estilo | 7 | Mistura de indentação (2 e 4 espaços) entre arquivos |

### 4.2 Problemas de Código Identificados

#### Duplicação de Código
- A lógica de alocação direta aparece **duas vezes** no algoritmo: na Fase 1 (`algoritmoRemocao.js:85-124`) e na re-iteração pós-permuta (`algoritmoRemocao.js:218-250`). Deveria ser extraída para uma função reutilizável.

#### Imports Dinâmicos Dentro de Funções
- Em `src/routes/servidores.js:67` e `src/routes/servidores.js:163`, o modelo `Configuracao` é importado com `require()` dentro do handler da rota em vez de no topo do arquivo. O mesmo ocorre em `src/routes/processamento.js:12,79`.

#### Falta de Tipagem
- O projeto utiliza JavaScript puro sem JSDoc ou TypeScript, dificultando a manutenção e detecção de bugs em tempo de desenvolvimento.

#### Inconsistência de Indentação
- `src/routes/config.js` usa **4 espaços** de indentação, enquanto todos os outros arquivos usam **2 espaços**.
- `src/models/Configuracao.js` também usa 4 espaços.

#### Validação de Data com Bug Potencial
- Em `src/models/Servidor.js:36-38`, a validação `isBefore` usa `new Date(Date.now() + 86400000)` que é calculada **no momento do carregamento do módulo**, não no momento da validação. Após o servidor rodar por dias, a validação ficará defasada.

---

## 5. BANCO DE DADOS

### 5.1 Schema

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   cidades    │     │    servidores      │     │ pedidos_remocao  │
├──────────────┤     ├───────────────────┤     ├──────────────────┤
│ id (PK)      │◄────│ cidade_lotacao_id  │     │ id (PK)          │
│ nome (UQ)    │     │ id (PK)           │◄────│ servidor_id (UQ) │
│ vagas_iniciais│     │ matricula (UQ)    │     │ opcao1_cidade_id │─►┐
└──────────────┘     │ nome              │     │ opcao2_cidade_id │─►│cidades
       ▲             │ senha_hash        │     │ opcao3_cidade_id │─►│
       │             │ data_ingresso     │     │ status (ENUM)    │  │
       │             │ perfil (ENUM)     │     │ cidade_destino_  │─►┘
       │             └───────────────────┘     │   final_id       │
       │                                       │ observacao       │
       └───────────────────────────────────────┤                  │
                                               └──────────────────┘

┌──────────────────┐
│  configuracoes   │
├──────────────────┤
│ id (PK)          │
│ chave (UQ)       │
│ valor_texto      │
│ valor_data       │
│ descricao        │
└──────────────────┘
```

### 5.2 Avaliação do Banco de Dados

**Pontos Positivos:**
- Constraints de unicidade (matrícula, servidor_id em pedidos)
- Índices criados nos campos de busca frequente
- Foreign keys definidas nos models
- Charset utf8mb4 para suporte a acentos e emojis
- Timezone configurado para horário de Brasília

**Problemas Identificados:**

| # | Problema | Severidade | Descrição |
|---|---------|-----------|-----------|
| D1 | **Sem migrations** | Alto | O projeto usa `sequelize.sync()` em vez de migrations. Isso é inaceitável para produção pois pode causar perda de dados e não permite controle de versão do schema. |
| D2 | **Sem soft-delete** | Médio | Cidades e pedidos são deletados fisicamente. Em um sistema governamental, deveria haver auditoria com soft-delete (paranoid: true). |
| D3 | **Modelo Configuracao genérico** | Baixo | Usa padrão key-value para configurações. Funcional, mas sem validação de tipos no nível do banco. |
| D4 | **Falta ON DELETE/ON UPDATE** | Médio | As foreign keys não definem comportamento em cascata (`onDelete`, `onUpdate`). Se uma cidade for removida incorretamente, registros órfãos podem surgir. |
| D5 | **Pool min:2 pode ser excessivo** | Baixo | Pool mínimo de 2 conexões pode consumir recursos desnecessariamente em ambientes com pouco tráfego. |

---

## 6. API REST

### 6.1 Endpoints

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| POST | `/api/auth/login` | Não | Login |
| POST | `/api/auth/registrar` | Não | Registro |
| GET | `/api/auth/me` | Sim | Dados do usuário |
| GET | `/api/cidades` | Não | Listar cidades |
| POST | `/api/cidades` | Admin | Criar cidade |
| PUT | `/api/cidades/:id` | Admin | Atualizar cidade |
| DELETE | `/api/cidades/:id` | Admin | Remover cidade |
| GET | `/api/servidores` | Admin | Listar servidores |
| GET | `/api/servidores/meu-pedido` | Sim | Meu pedido |
| POST | `/api/servidores/pedido` | Sim | Criar/editar pedido |
| DELETE | `/api/servidores/pedido` | Sim | Cancelar pedido |
| POST | `/api/processamento/executar` | Admin | Executar algoritmo |
| GET | `/api/processamento/dashboard` | Admin | Dashboard |
| POST | `/api/processamento/resetar` | Admin | Resetar pedidos |
| GET | `/api/config` | Não | Obter configurações |
| POST | `/api/config` | Admin | Definir data limite |

### 6.2 Avaliação da API

**Pontos Positivos:**
- Validação de input com express-validator
- Proteção de rotas admin com middleware duplo (autenticar + apenasAdmin)
- Mensagens de erro em português, adequadas ao contexto
- Verificação de integridade referencial antes de deletar cidades

**Problemas Identificados:**

| # | Problema | Severidade | Descrição |
|---|---------|-----------|-----------|
| A1 | **Sem paginação** | Alto | `GET /api/servidores` e `GET /api/cidades` retornam todos os registros. Com milhares de servidores, isso causará problemas de performance. |
| A2 | **Sem versionamento** | Médio | A API não possui versionamento (`/api/v1/...`). Dificulta futuras evoluções sem quebrar compatibilidade. |
| A3 | **Endpoint de listagem de cidades é público** | Baixo | `GET /api/cidades` não requer autenticação e inclui contagem de servidores, expondo dados internos. |
| A4 | **POST retorna 201 ao atualizar** | Baixo | `POST /api/servidores/pedido` retorna 201 tanto na criação quanto na atualização do pedido (`src/routes/servidores.js:144`). Na atualização, deveria retornar 200. |
| A5 | **Sem idempotência no processamento** | Médio | Executar o algoritmo múltiplas vezes pode gerar resultados diferentes se não resetar antes. Falta uma trava de execução ou confirmação. |
| A6 | **Erro exposto no processamento** | Baixo | `src/routes/processamento.js:28` expõe `err.message` ao cliente independente do ambiente. |

---

## 7. ALGORITMO DE REMOÇÃO

### 7.1 Funcionamento

O algoritmo opera em 3 fases:

1. **Fase 1 — Alocação Direta Iterativa:** Percorre pedidos por ordem de antiguidade e aloca servidores em cidades com vagas disponíveis. Quando alguém é alocado, a vaga de sua cidade de origem é liberada e o processo reinicia do topo da lista (garante prioridade por antiguidade).

2. **Fase 2 — Detecção de Ciclos (Permutas):** Para pedidos que não foram alocados por falta de vagas, constrói um grafo dirigido e detecta ciclos usando DFS. Ciclos válidos representam permutas onde todos trocam de lugar simultaneamente.

3. **Fase 3 — Re-iteração:** Após resolver permutas, novas vagas podem ter surgido. O processo de alocação direta é re-executado.

### 7.2 Avaliação do Algoritmo

**Pontos Positivos:**
- Uso de transação de banco de dados para atomicidade
- Safety guard com MAX_ITERACOES (100) para evitar loops infinitos
- Lógica de desempate por matrícula quando datas são iguais
- Separação correta entre "simulação" e "efetivação" (o algoritmo só marca o status, não muda a lotação do servidor)
- Observações detalhadas em cada movimentação

**Problemas Identificados:**

| # | Problema | Severidade | Descrição |
|---|---------|-----------|-----------|
| G1 | **Detecção de ciclos limitada** | Médio | Na Fase 2, apenas o servidor mais antigo de cada cidade entra no grafo (`algoritmoRemocao.js:146`). Se esse servidor não formar ciclo mas um mais novo formaria, o ciclo não é detectado. |
| G2 | **Tentativa de alternativas limitada** | Médio | `tentarCiclosComAlternativas` só tenta mudar um nó por vez. Combinações de múltiplas preferências alternativas não são exploradas. |
| G3 | **Duplicação de lógica** | Baixo | A lógica de alocação direta (linhas 85-124) é duplicada nas linhas 218-250. Deveria ser uma função reutilizável. |
| G4 | **Sem registro de tempo de execução** | Baixo | O algoritmo não registra quanto tempo levou para processar, informação útil para monitoramento. |

---

## 8. FRONTEND

### 8.1 Avaliação Geral

**Pontos Positivos:**
- SPA funcional com roteamento client-side
- Componentes bem organizados por domínio (admin vs usuario)
- State management centralizado
- UI moderna com Vuetify (Material Design)
- Navigation guards para controle de acesso
- Responsividade nativa via Vuetify

**Problemas Identificados:**

| # | Problema | Severidade | Descrição |
|---|---------|-----------|-----------|
| F1 | **Sem build step** | Alto | Todo o frontend é servido como scripts individuais sem bundling, tree-shaking, ou minificação. Em produção, são **17 requisições HTTP** separadas só para JS. |
| F2 | **Dependência total de CDNs** | Alto | Vue, Vuetify, Pinia e Vue Router são carregados de cdn.jsdelivr.net e unpkg.com. Se o CDN cair, a aplicação inteira fica indisponível. |
| F3 | **window.location.reload() no login** | Médio | `Login.js:171,179` usa `window.location.reload()` ao invés de navegação via router. Isso causa um full page reload desnecessário e piora a experiência do usuário. |
| F4 | **Sem tratamento offline** | Médio | Não há service worker, cache manifest ou tratamento para quando o usuário perde conexão. |
| F5 | **JSON.parse sem try/catch** | Médio | `router.js:29` faz `JSON.parse(localStorage.getItem('usuario'))` sem try/catch. Se o valor for corrompido, o aplicativo crashará. |
| F6 | **Sem lazy loading de rotas** | Baixo | Todos os componentes de view são carregados no início, mesmo os que o usuário não acessará (ex: admin views para usuário comum). |
| F7 | **Sem feedback de loading em ações** | Baixo | Algumas ações como deletar cidades ou cancelar pedidos não exibem indicador de carregamento. |

---

## 9. TESTES

### 9.1 Situação Atual

| Aspecto | Status |
|---------|--------|
| Testes unitários | **Inexistentes** |
| Testes de integração | **Inexistentes** |
| Testes E2E | **Inexistentes** |
| Testes manuais | Via seeders com cenários pré-definidos |
| Framework de testes | **Nenhum instalado** |
| Cobertura de código | **0%** |

### 9.2 Análise

O projeto **não possui nenhum teste automatizado**. A validação é feita exclusivamente via seeders que criam cenários pré-definidos e verificação manual dos resultados.

**Cenários de teste existentes (manual via seeders):**
1. Permuta simples entre 2 servidores
2. Alocação direta com vagas disponíveis
3. Cadeia circular de 3 servidores
4. Servidor sem vaga disponível (não atendido)
5. Vaga cascata (abre após outra alocação)

**Resultado esperado:** 7 atendidos, 1 não atendido.

**Recomendação prioritária:** Implementar pelo menos testes unitários para o `algoritmoRemocao.js`, que é o componente mais crítico e complexo do sistema.

---

## 10. DEPLOY E DEVOPS

### 10.1 Situação Atual

| Aspecto | Status |
|---------|--------|
| Configuração de deploy | render.yaml presente |
| CI/CD pipeline | **Inexistente** |
| Docker | **Não configurado** |
| Variáveis de ambiente | .env (não commitado) |
| Monitoramento | **Nenhum** |
| Logging estruturado | **Apenas console.log/error** |
| Health check | **Inexistente** |
| Backup de BD | **Não configurado** |

### 10.2 Problemas

| # | Problema | Severidade | Descrição |
|---|---------|-----------|-----------|
| O1 | **Sem CI/CD** | Alto | Não há pipeline de integração contínua. Push direto para produção sem validação automatizada. |
| O2 | **Sem Docker** | Médio | Falta containerização para garantir consistência entre ambientes. |
| O3 | **Sem health check** | Médio | Não há endpoint `/health` ou `/ready` para monitoramento de disponibilidade. |
| O4 | **Logging primitivo** | Médio | Usa apenas `console.log/error`. Sem estruturação, rotação, ou envio para serviço de log. |
| O5 | **Sem backup automatizado** | Alto | Sem estratégia de backup do banco MySQL. |
| O6 | **Branches desalinhados** | Baixo | Branch local é `master`, remote é `main`. Pode causar confusão. |

---

## 11. DEPENDÊNCIAS

### 11.1 Análise de Dependências

| Pacote | Versão | Última Estável | Status |
|--------|--------|---------------|--------|
| express | ^4.21.2 | 4.x | Atualizado |
| sequelize | ^6.37.5 | 6.x | Atualizado |
| mysql2 | ^3.12.0 | 3.x | Atualizado |
| bcryptjs | ^2.4.3 | 2.x | Atualizado |
| jsonwebtoken | ^9.0.2 | 9.x | Atualizado |
| helmet | ^8.0.0 | 8.x | Atualizado |
| cors | ^2.8.5 | 2.x | Atualizado |
| express-rate-limit | ^7.5.0 | 7.x | Atualizado |
| express-validator | ^7.2.1 | 7.x | Atualizado |
| dotenv | ^16.4.7 | 16.x | Atualizado |
| sqlite3 | ^5.1.7 | 5.x | Atualizado |
| nodemon (dev) | ^3.1.9 | 3.x | Atualizado |

### 11.2 Observações

- **sqlite3 está instalado mas não é utilizado.** O banco é configurado exclusivamente para MySQL. Deveria ser removido para reduzir o tamanho do build.
- Todas as dependências estão em versões recentes.
- Não há `npm audit` configurado como parte do workflow.
- Não há `package-lock.json` mencionado no .gitignore (correto — está commitado).

---

## 12. RESUMO EXECUTIVO

### 12.1 Scorecard Geral

| Categoria | Nota (1-10) | Status |
|-----------|:-----------:|--------|
| Arquitetura | 7 | Boa separação, mas faltam camadas |
| Segurança | 5 | Fundamentos presentes, mas com falhas críticas |
| Qualidade de Código | 7 | Código limpo, com duplicações pontuais |
| Banco de Dados | 6 | Schema adequado, mas sem migrations |
| API REST | 7 | Bem estruturada, falta paginação |
| Algoritmo de Negócio | 8 | Implementação sólida do algoritmo |
| Frontend | 6 | Funcional, mas sem otimizações |
| Testes | 1 | Ausência total de testes automatizados |
| DevOps | 3 | Apenas config de deploy, sem CI/CD |
| Documentação | 4 | Comentários no código, sem docs externas |
| **MÉDIA GERAL** | **5.4** | **Precisa de melhorias** |

### 12.2 Top 10 Ações Prioritárias

| Prioridade | Ação | Categoria | Severidade |
|:----------:|------|-----------|:----------:|
| 1 | Remover fallback hardcoded do JWT_SECRET | Segurança | Crítico |
| 2 | Implementar testes automatizados (mínimo: algoritmo) | Testes | Crítico |
| 3 | Configurar migrations do Sequelize em vez de sync | Banco de Dados | Alto |
| 4 | Restringir CORS para domínios específicos | Segurança | Alto |
| 5 | Adicionar paginação na listagem de servidores | API | Alto |
| 6 | Implementar CI/CD pipeline | DevOps | Alto |
| 7 | Validar registro de servidores (aprovação admin) | Segurança | Alto |
| 8 | Adicionar health check endpoint | DevOps | Médio |
| 9 | Configurar logging estruturado | DevOps | Médio |
| 10 | Implementar audit trail para ações sensíveis | Segurança | Médio |

### 12.3 Pontos Fortes do Projeto

1. **Algoritmo bem implementado** — A lógica de remoção com permutas circulares e alocação por antiguidade é sofisticada e funciona corretamente para os cenários testados.
2. **Stack moderna e coerente** — Uso de tecnologias atualizadas e compatíveis entre si.
3. **Segurança básica presente** — Helmet, rate limiting, bcrypt, JWT e input validation demonstram preocupação com segurança.
4. **Código legível** — Nomenclatura em português consistente facilita manutenção pela equipe.
5. **Validações de negócio sólidas** — Verificação de data limite, impedimento de duplicatas, verificação de existência de cidades.

### 12.4 Conclusão

O projeto possui uma base sólida e um algoritmo de negócio bem implementado, mas precisa de amadurecimento em áreas de infraestrutura (testes, CI/CD, migrations) e segurança (JWT secret, CORS, registro aberto) antes de ser considerado pronto para produção em um ambiente governamental. As 10 ações prioritárias listadas acima, se implementadas, elevariam significativamente a confiabilidade e segurança do sistema.

---

*Relatório gerado em 2026-02-12 — Auditoria técnica completa do projeto remocoespcce.*
