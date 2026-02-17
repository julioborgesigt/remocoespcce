# Relatório de Auditoria e Análise de Projeto (v2)

**Data:** 14/02/2026
**Projeto:** Sistema de Remoção de Servidores - PCCE
**Versão Analisada:** Estado atual dos arquivos

---

## 1. Resumo Executivo
O sistema apresenta uma arquitetura funcional de **Single Page Application (SPA)** sem build step, conectada a uma API **Node.js/Express**. A lógica de negócio principal (algoritmo de remoção) é sofisticada e transacional, garantindo integridade de dados.

Entretanto, o projeto encontra-se em um estágio **intermediário entre protótipo e produção**. Foram corrigidas falhas críticas de segurança anteriores (como o segredo JWT), mas persistem decisões arquiteturais que comprometem a escalabilidade, manutenção e segurança em ambiente corporativo/governamental.

**Nota Geral:** 7.0/10

---

## 2. Análise Detalhada

### 2.1 Confiabilidade do Algoritmo (`algoritmoRemocao.js`)
O coração do sistema é o algoritmo de alocação e permuta.

*   **Pontos Fortes:**
    *   **Atomicidade:** Uso correto de transações (`sequelize.transaction()`), garantindo que ou todas as mudanças ocorrem, ou nenhuma.
    *   **Segurança contra Loops:** Implementação de `MAX_ITERACOES` previne travamentos.
    *   **Lógica de Fases:** A separação em fases (Alocação Direta -> Permutas -> Realocação) é correta para maximizar o atendimento.

*   **Identificação de Riscos (Crítico):**
    *   **Detecção de Ciclos Limitada:** O algoritmo considera *apenas* o servidor mais antigo de cada cidade para formar ciclos de permuta.
        *   *Cenário de Falha:* Se o Servidor A (antigo) quer ir para X, e o Servidor B (novo, mesma origem) quer ir para Y. Se X não fecha ciclo, mas Y fecharia (com alguém querendo a origem), o algoritmo ignora o Servidor B. Isso pode gerar uma ineficiência na alocação, prejudicando servidores que poderiam ser atendidos.
    *   **Complexidade de Manutenção:** A lógica de alocação direta está duplicada no código (início e fim do processo).

### 2.2 Segurança do Código
*   **Autenticação (Melhoria Identificada):** O problema de "Hardcoded JWT Secret" foi **resolvido**. O sistema agora exige a variável de ambiente `JWT_SECRET` para iniciar, o que é excelente.
*   **Vulnerabilidade de Registro (Aberto):** A rota `/api/auth/registrar` permite que *qualquer pessoa* crie uma conta se souber uma matrícula válida.
    *   *Risco:* Um atacante pode registrar matrículas de terceiros antes que os legítimos donos o façam.
    *   *Recomendação:* Implementar fluxo de aprovação por Admin ou validação via email corporativo/token prévio.
*   **CSP (Content Security Policy):** O uso de `'unsafe-eval'` e `'unsafe-inline'` enfraquece a proteção contra XSS (Cross-Site Scripting). Isso é uma consequência da arquitetura frontend escolhida (Vue via CDN).

### 2.3 Arquitetura e Usabilidade (Frontend)
*   **Arquitetura "No-Build":** O projeto carrega bibliotecas (Vue, Vuetify, Pinia) diretamente de CDNs (jsdelivr/unpkg).
    *   *Prós:* Desenvolvimento rápido, sem necessidade de configuração de Webpack/Vite.
    *   *Contras:*
        *   **Performance:** Múltiplas requisições HTTP bloqueantes no carregamento inicial.
        *   **Disponibilidade:** Se o CDN sair do ar ou for bloqueado na rede corporativa, o sistema para.
        *   **Segurança:** Não há garantia de integridade (Subresource Integrity - SRI) nos scripts externos.
*   **Usabilidade:**
    *   A interface utiliza **Vuetify**, garantindo um padrão visual consistente e responsivo (Mobile-first).
    *   Feedback visual (Loaders) e tratamento de erros no frontend parecem básicos.

### 2.4 Infraestrutura e Banco de Dados
*   **Migrations Ausentes:** O uso de `sequelize.sync({ alter: true })` é arriscado para produção. Alterações de colunas podem causar perda de dados ou travamento de tabelas.
*   ** Logs:** Ausência de uma estratégia de logs estruturados. `console.log` e `console.error` não são suficientes para auditoria ou debug em produção.

---

## 3. Sugestões e Plano de Ação

Com base na análise, sugiro as seguintes melhorias, ordenadas por prioridade:

### Prioridade 1: Segurança e Integridade (Imediato)
1.  **Bloquear Registro Público:** Alterar o fluxo de cadastro. Somente Admins devem criar usuários, ou o cadastro deve ficar "pendente de aprovação".
2.  **Refinar Algoritmo de Permuta:** Reimplementar a detecção de ciclos para considerar *todos* os candidatos de uma cidade, não apenas o mais antigo, garantindo que o ciclo ótimo seja encontrado.
3.  **Sanitização de Entradas:** Garantir que todos os campos de texto (observações, nomes) passem por sanitização para evitar injeção de HTML/Scripts.

### Prioridade 2: Infraestrutura (Curto Prazo)
4.  **Adicionar Migrations:** Criar scripts de migração do Sequelize para controlar alterações no banco de dados com segurança.
5.  **Build System:** Migrar o frontend para **Vite**. Isso permitirá:
    *   Bundling (arquivo único de script).
    *   Remoção de dependência de CDNs externos.
    *   Melhor performance e segurança (CSP mais estrito).

### Prioridade 3: Qualidade e Manutenção (Médio Prazo)
6.  **Testes Automatizados:** O algoritmo de remoção é complexo e crítico. É **indispensável** criar testes unitários (ex: Jest) cobrindo cenários de:
    *   Permuta simples (2 pontas).
    *   Permuta triangular (3 pontas).
    *   Ciclos concorrentes.
7.  **Logs de Auditoria:** Criar uma tabela `Logs` para registrar quem fez o quê e quando (ex: "Servidor X alterou intenção", "Admin Y rodou processamento").

---

### Resumo das Vulnerabilidades Encontradas

| Severidade | Descrição | Status |
| :--- | :--- | :--- |
| 🟢 Baixa | JWT Secret Hardcoded | **Corrigido** |
| 🔴 Alta | Registro de Usuário sem validação | **Aberto** |
| 🟠 Média | Detecção de Ciclos Incompleta | **Aberto** |
| 🟠 Média | Dependência de CDN Externo | **Aberto** |
| 🟠 Média | Ausência de Migrations de Banco | **Aberto** |

