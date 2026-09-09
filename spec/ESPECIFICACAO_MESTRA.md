# ESPECIFICAÇÃO MESTRA — SISTEMA **JORNADAS**

### Documento funcional e técnico consolidado para implementação pelo Codex

Este documento deve ser tratado como a **fonte principal de requisitos do sistema Jornadas**. A proposta inicial da Jornada já separava corretamente participação acadêmica de premiação, previa controle de inscrições, presença, passaporte, estoque, sorteios, retirada e relatório final. A especificação abaixo incorpora essa proposta e todas as decisões tomadas posteriormente.

---

# 1. VISÃO DO PRODUTO

O **Jornadas** será uma plataforma web responsiva e instalável como PWA para organização completa da Jornada Farmacêutica.

Não é um sistema exclusivo de 2026.

A arquitetura precisa suportar:

- Jornada Farmacêutica 2026;
- Jornada Farmacêutica 2027;
- Jornada Farmacêutica 2028;
- futuras edições com configurações diferentes.

Cada edição precisa funcionar como uma unidade isolada de dados.

Isso significa que praticamente nada relacionado à edição poderá ser fixado diretamente no código.

O sistema deverá administrar:

- identidade visual;
- edição;
- cronograma;
- categorias;
- palestras;
- painéis;
- cursos;
- outras atividades;
- participantes;
- inscrições;
- lista de espera;
- presença;
- check-in;
- check-out;
- passaporte;
- carimbos;
- certificados;
- patrocinadores;
- brindes;
- estoque;
- elegibilidade;
- sorteios;
- confirmação de brindes;
- retiradas;
- notificações;
- relatórios;
- planilhas Excel;
- usuários administrativos;
- auditoria.

---

# 2. PRINCÍPIO CENTRAL

A regra conceitual original deve permanecer:

> **participação acadêmica e premiação são sistemas relacionados, mas independentes.**

O participante deve poder frequentar as atividades independentemente da quantidade de brindes existente.

A proposta original já estabelecia que o check-in define participação/elegibilidade, mas o estoque não deve limitar a atividade acadêmica.

Nunca bloquear uma inscrição simplesmente porque um determinado brinde acabou.

---

# 3. ARQUITETURA MULTIEDIÇÃO

Criar entidade central:

```text
Edition
```

Cada edição deve conter, no mínimo:

```text
id
nome
slug
ano
slogan
descricao
data_inicio
data_fim
timezone
status
max_atividades_participante
max_checkins
logo
icone_pwa
cor_primaria
cor_secundaria
cor_fundo
data_criacao
data_atualizacao
```

Status sugeridos:

```text
DRAFT
PUBLISHED
ACTIVE
FINISHED
ARCHIVED
```

Exemplo da edição inicial:

```text
Nome:
Jornada Farmacêutica 2026

Slogan:
farmácia em movimento

Máximo de check-ins:
5
```

O máximo de 5 é uma configuração **desta edição**, não regra permanente do sistema.

---

# 4. DUPLICAÇÃO DE EDIÇÃO

A administração terá:

### Duplicar edição

Exemplo:

```text
Jornada Farmacêutica 2026
↓
Duplicar
↓
Jornada Farmacêutica 2027
```

A duplicação poderá copiar:

- identidade;
- configurações;
- categorias;
- estrutura básica da programação;
- configurações de certificados;
- configurações da loja;
- regras de brindes;
- patrocinadores, opcionalmente.

Não copiar:

- participantes;
- inscrições;
- lista de espera;
- check-ins;
- check-outs;
- carimbos;
- certificados emitidos;
- sorteios;
- reservas;
- retiradas;
- logs operacionais.

---

# 5. IDENTIDADE VISUAL

A **logo oficial enviada pelo usuário é a fonte visual principal**.

Não redesenhar a identidade dentro do código.

A interface deve seguir a linguagem mais recente aprovada:

- minimalista;
- limpa;
- bastante espaço em branco;
- fundo off-white/creme;
- azul/verde petróleo;
- dourado;
- elementos gráficos simples;
- sem excesso de folhagens;
- sem decoração vintage pesada;
- sem efeitos 3D desnecessários;
- sem cards excessivamente ornamentados.

A marca deve ser o elemento decorativo mais forte.

## Direção visual

Base:

```text
fundo:
off-white / creme muito claro

primária:
azul/verde petróleo

destaque:
dourado

texto:
azul petróleo muito escuro

sucesso:
verde

erro:
vermelho

alerta:
âmbar/dourado
```

Não codificar cores da categoria como constantes universais.

Elas pertencem à edição.

---

# 6. ASSETS

O sistema deve aceitar upload e gerenciamento de:

- logo da edição;
- ícone PWA;
- foto do participante;
- avatar padrão;
- fotos de palestrantes;
- imagens de brindes;
- logos de patrocinadores;
- ícones de categorias;
- modelos de certificado.

Os textos da interface não devem ser transformados em imagem.

Exceção:

- logo oficial.

Ícones normais devem preferencialmente ser SVG/componentes.

---

# 7. EXPERIÊNCIA RESPONSIVA

O sistema terá duas experiências prioritárias.

## Participante

Prioridade:

```text
mobile-first
```

Deve parecer um aplicativo no celular.

## Administração

Prioridade:

```text
desktop-first
```

Mas precisa continuar responsiva para:

- celular;
- tablet;
- notebook.

O modo operacional de check-in precisa ser especialmente bom no celular.

---

# 8. PWA

O Jornadas deverá funcionar como **Progressive Web App**.

Implementar:

```text
manifest.json
service worker
ícones
instalação na tela inicial
modo standalone
cache dos assets básicos
push notifications quando suportado
```

O PWA não deve permitir operações críticas offline sem validação do servidor.

Check-ins, sorteios, retiradas e mudanças de estoque precisam de confirmação online.

---

# 9. TELA PÚBLICA INICIAL

Estrutura:

```text
LOGO JORNADA FARMACÊUTICA

farmácia em movimento

[ Participante ]

[ Administração ]

PATROCINADORES

logos

rodapé
```

Sem mapa.

Sem cronograma inteiro.

Sem excesso de texto.

---

# 10. RODAPÉ

O rodapé deverá mostrar:

```text
Patrocinadores
```

Cada patrocinador poderá ter:

```text
nome
logo
link
ordem
ativo
```

Todos aparecem juntos, sem níveis hierárquicos obrigatórios.

Também exibir discretamente:

```text
Site por Matheus Feitosa

Auxílio financeiro:
Candido e Heloisa
```

Esses textos poderão futuramente ser configuráveis.

---

# 11. AUTENTICAÇÃO DO PARTICIPANTE

Não haverá cadastro público.

Todos os participantes já existirão no banco.

Login:

```text
Primeiro nome
RA
```

O RA funciona como senha simplificada.

Exemplo:

```text
Primeiro nome:
Lívia

RA:
48884
```

O sistema autentica pelo conjunto:

```text
first_name_normalized + RA
```

Dois participantes podem ter o mesmo primeiro nome.

O RA diferencia.

---

# 12. NORMALIZAÇÃO DO LOGIN

Recomendação técnica:

```text
trim
lowercase
normalização Unicode
```

Exemplo:

```text
Lívia
lívia
LÍVIA
```

podem ser tratados como o mesmo primeiro nome.

O RA deve permanecer exato após remoção de espaços.

Não permitir login apenas pelo nome.

---

# 13. PARTICIPANTES

Campos obrigatórios:

```text
id
edition_id
nome_completo
primeiro_nome
ra
semestre
foto_url
ativo
created_at
updated_at
```

Restrição:

```text
UNIQUE(edition_id, ra)
```

---

# 14. PERFIL DO PARTICIPANTE

O participante pode visualizar:

```text
foto
nome completo
RA
semestre
```

Pode editar:

```text
foto
```

Não pode editar:

```text
nome
RA
semestre
```

Esses dados são controlados pela administração.

---

# 15. AVATAR PADRÃO

Caso não exista foto:

mostrar avatar padrão.

Visual:

- fundo claro;
- ícone humano simples;
- azul petróleo;
- detalhe dourado.

Evitar fotografia gerada de pessoa.

---

# 16. IMPORTAÇÃO DE PARTICIPANTES

Administração terá:

### Importar participantes

Aceitar inicialmente:

```text
.xlsx
.csv
```

Colunas:

```text
Nome completo
RA
Semestre
```

Fluxo:

```text
Upload
↓
Leitura
↓
Validação
↓
Pré-visualização
↓
Confirmar
↓
Importação
```

Antes de importar mostrar:

```text
217 válidos
3 com erro
2 duplicados
```

---

# 17. ERROS DE IMPORTAÇÃO

Detectar:

- RA vazio;
- nome vazio;
- semestre vazio;
- RA duplicado;
- participante já existente;
- arquivo inválido;
- coluna desconhecida.

Nunca importar silenciosamente linhas inválidas.

---

# 18. CADASTRO MANUAL

Admin pode cadastrar individualmente:

```text
Nome completo
RA
Semestre
Foto opcional
```

Pode editar posteriormente.

---

# 19. CATEGORIAS

Nenhuma categoria deve ficar hardcoded.

Criar tabela:

```text
ActivityCategory
```

Campos:

```text
id
edition_id
nome
slug
cor
icone
ordem
exige_inscricao
exige_checkin
exige_checkout
gera_carimbo
gera_certificado
ativo
```

---

# 20. CATEGORIAS INICIAIS DE 2026

Seed inicial:

```text
Palestra
cor: azul

FarmaArena
cor: vermelho

Cursos
cor: verde

Outros
cor: amarelo/dourado
```

Essas categorias poderão ser:

- alteradas;
- removidas;
- renomeadas;
- criadas novamente.

---

# 21. PALESTRANTES

Criar entidade:

```text
Speaker
```

Campos:

```text
id
edition_id
nome
bio
foto_url
curriculo_url
instituicao
```

A atividade poderá ter um ou mais palestrantes.

---

# 22. ATIVIDADES

Não existirão apenas cinco painéis.

O cadastro é ilimitado.

Entidade:

```text
Activity
```

Campos:

```text
id
edition_id
category_id
titulo
descricao
data
inicio
fim
bloco
sala
capacidade
inscricao_aberta
prazo_inscricao
prazo_troca
carga_horaria
status
allow_waitlist
created_at
updated_at
```

---

# 23. CAPACIDADE

Valor inicial recomendado para painéis:

```text
20 vagas
```

Mas deve ser editável.

Exemplo:

```text
Painel 1 — 20
Painel 2 — 20
Curso — 15
Palestra — 200
```

Nunca assumir `20` no código.

---

# 24. LOCALIZAÇÃO

Mapa da faculdade foi removido.

Exibir apenas:

```text
Bloco
Sala
```

Exemplo:

```text
Bloco B
Sala 03
```

---

# 25. PROGRAMAÇÃO DO PARTICIPANTE

Tela:

### Programação

Mostrar atividades agrupadas por:

```text
data
horário
categoria
```

Permitir filtros:

```text
Todas
Palestras
FarmaArena
Cursos
Outros
```

Filtros são gerados dinamicamente pelas categorias.

---

# 26. CARD DE ATIVIDADE

Mostrar:

```text
categoria
título
palestrante
foto
data
horário
bloco
sala
vagas
status
```

Ações possíveis:

```text
Inscrever-se
Cancelar
Trocar
Lista de espera
Ver detalhes
```

---

# 27. DETALHE DA ATIVIDADE

Mostrar:

```text
Título
Categoria
Descrição
Palestrante
Foto
Currículo
Data
Horário
Bloco
Sala
Carga horária
Vagas
Inscritos
Lista de espera
```

---

# 28. REGRA DE CONFLITO DE HORÁRIO

Um participante nunca pode possuir duas inscrições simultâneas.

Algoritmo:

```text
atividade A:
18:30–19:30

atividade B:
18:45–19:45

CONFLITO
```

Mas:

```text
A:
18:30–19:30

B:
19:30–20:30

PERMITIDO
```

Validar no servidor.

Nunca depender apenas do frontend.

---

# 29. LIMITE DE ATIVIDADES

Cada edição possui:

```text
max_checkins
```

2026:

```text
5
```

O sistema deve impedir que o participante ultrapasse o limite configurado, quando aplicável.

---

# 30. INSCRIÇÃO

Processo:

```text
Usuário escolhe atividade
↓
Sistema verifica edição ativa
↓
Verifica prazo
↓
Verifica conflito
↓
Verifica limite de atividades
↓
Verifica capacidade
↓
Cria inscrição
```

---

# 31. TROCA DE ATIVIDADE

Regra definida:

O participante só pode trocar se houver vaga na nova atividade.

A operação precisa ser **atômica**.

Nunca:

1. remover primeiro da atividade antiga;
2. depois tentar reservar a nova.

Correto:

```text
BEGIN TRANSACTION

reservar vaga nova
validar tudo
cancelar vaga antiga
confirmar nova inscrição

COMMIT
```

Se falhar:

```text
ROLLBACK
```

---

# 32. PRAZO DE ALTERAÇÃO

A edição/atividade pode configurar prazos.

Para a Jornada atual:

Nova inscrição/reinscrição pode ocorrer até:

```text
T + 25 minutos
```

onde T = horário de início.

---

# 33. LISTA DE ESPERA

Se atividade estiver cheia:

mostrar:

```text
Entrar na lista de espera
```

Criar:

```text
WaitlistEntry
```

Campos:

```text
participant_id
activity_id
position/timestamp
status
created_at
promoted_at
```

Sugestão:

fila FIFO.

---

# 34. PROMOÇÃO AUTOMÁTICA

Quando uma vaga for liberada:

```text
vaga disponível
↓
buscar primeiro elegível
↓
validar conflito
↓
validar prazo
↓
promover
↓
criar inscrição
↓
enviar notificação
```

Participante promovido **entra automaticamente**.

Não precisa clicar em aceitar.

---

# 35. LIBERAÇÃO POR AUSÊNCIA

Regras definidas para esta edição:

```text
Início da atividade = T0
```

### T0 até T+15

Check-in normal.

### T+15

encerra janela normal de check-in.

### T+15 até T+20

participante ainda mantém formalmente a vaga.

Esse intervalo funciona como tolerância operacional.

### T+20

se não houver check-in:

```text
NO_SHOW
```

vaga é liberada.

### T+20 até T+25

uma pessoa promovida/inscrita tardiamente poderá realizar check-in.

### T+25

encerra definitivamente nova inscrição/check-in tardio.

---

# 36. CHECK-IN TARDIO

Se inscrição foi criada depois de T+15:

o sistema deverá permitir check-in até T+25.

Registrar internamente que foi:

```text
late_enrollment = true
```

---

# 37. CHECK-IN SEM QR CODE

**Não implementar QR Code.**

O QR Code existente na proposta original foi descartado.

A proposta originalmente previa QR por sala.

A nova regra é:

```text
check-in administrativo por RA
```

---

# 38. MODO OPERAÇÃO

Administração terá:

### Modo Operação

Pensado para celular/tablet.

Fluxo:

```text
Selecionar atividade
↓
Digite RA
↓
Encontrar participante
↓
Validar inscrição
↓
Confirmar presença
```

---

# 39. QUEM PODE FAZER CHECK-IN

Não será necessário atribuir operador previamente a uma sala.

Qualquer usuário administrativo autorizado poderá selecionar qualquer atividade permitida por seu perfil.

---

# 40. TELA OPERACIONAL

Exemplo:

```text
Farmácia Clínica

Sala 03
18:30–19:30

17 / 20 presentes

[ Digite o RA ]

Participantes

✓ Maria
✓ João
○ Ana
○ Pedro
```

---

# 41. RESULTADO DA BUSCA POR RA

Exemplo:

```text
RA: 48884

Lívia Silva
8º semestre

✓ inscrita
```

Botão:

```text
CONFIRMAR CHECK-IN
```

Se não inscrito:

```text
Participante não está inscrito nesta atividade.
```

---

# 42. CHECK-IN = PRESENÇA = CARIMBO

Regra crucial:

```text
check-in confirmado
=
presença confirmada
=
carimbo digital emitido
```

Não criar dois processos independentes.

O carimbo é a representação do check-in no passaporte.

---

# 43. PASSAPORTE FARMACÊUTICO

A proposta original já previa acompanhamento digital da participação.

Tela:

```text
Meu Passaporte

3 de 5 atividades concluídas

[Palestra ✓]
[FarmaArena ✓]
[Curso ✓]
[...]
```

---

# 44. CARIMBOS

Entidade:

```text
PassportStamp
```

Campos:

```text
id
edition_id
participant_id
activity_id
category_id
attendance_id
issued_at
issued_by
status
```

---

# 45. PASSAPORTE FÍSICO

O passaporte físico permanece.

O participante poderá mostrar o passaporte digital para solicitar validação/carimbo físico.

O sistema digital é a referência principal para confirmar que houve presença.

---

# 46. PALESTRA — REGRA ESPECIAL

A categoria Palestra terá:

```text
check-in
+
check-out
```

---

# 47. CHECK-IN DA PALESTRA

Janela normal:

```text
T0 até T+15
```

Inscrição tardia:

```text
até T+25
```

---

# 48. CHECK-OUT

Check-out da palestra poderá começar:

```text
24 minutos antes do fim
```

Exemplo:

```text
Fim:
21:00

Check-out abre:
20:36
```

Até o encerramento programado.

Correções posteriores somente por administração.

---

# 49. CERTIFICAÇÃO DA PALESTRA

Não calcular percentual.

Regra:

```text
check-in válido
AND
check-out válido
=
elegível ao certificado
```

---

# 50. CERTIFICADOS

Certificados só ficam disponíveis:

```text
após o fim do evento
```

Criar:

```text
Certificate
```

Campos:

```text
id
edition_id
participant_id
activity_id
codigo_validacao
carga_horaria
status
pdf_url
issued_at
invalidated_at
```

---

# 51. STATUS DE CERTIFICADO

```text
PENDING
ELIGIBLE
GENERATED
RELEASED
INVALIDATED
```

---

# 52. MODELO DE CERTIFICADO

O modelo será enviado posteriormente.

A arquitetura precisa deixar preparado:

```text
template upload
```

e geração em PDF.

---

# 53. CORREÇÃO DE PRESENÇA

Administradores autorizados podem remover/corrigir check-in.

Obrigatoriamente pedir:

```text
motivo
```

Exemplo:

```text
Participante incorreto
Erro do operador
Correção administrativa
```

---

# 54. AUDITORIA

Nenhuma ação crítica pode desaparecer.

Criar:

```text
AuditLog
```

Campos:

```text
id
edition_id
actor_type
actor_id
action
entity_type
entity_id
old_value
new_value
reason
created_at
ip
```

---

# 55. AÇÕES AUDITADAS

No mínimo:

- check-in;
- cancelamento de check-in;
- check-out;
- edição de participante;
- alteração de atividade;
- mudança de sala;
- mudança de horário;
- alteração de estoque;
- execução de sorteio;
- cancelamento de sorteio;
- reserva;
- entrega;
- reversão de entrega;
- emissão;
- invalidação de certificado;
- alterações de administradores.

---

# 56. NOTIFICAÇÕES

Criar centro de notificações.

Entidade:

```text
Notification
```

---

# 57. TIPOS AUTOMÁTICOS

Suportar:

```text
atividade em breve
atividade acontecendo agora
alteração de sala
alteração de bloco
alteração de horário
atividade cancelada
inscrição confirmada
inscrição cancelada
troca confirmada
vaga liberada
promoção da lista de espera
check-in confirmado
check-out disponível
sorteio realizado
brinde ganho
prazo de confirmação
brinde reservado
brinde disponível para retirada
certificado disponível
comunicado da organização
```

---

# 58. HORÁRIOS DE LEMBRETE

Não hardcodar valores.

Configurar por edição.

Exemplo possível:

```text
30 min antes
10 min antes
agora
```

---

# 59. COMUNICADO ADMINISTRATIVO

Administração terá:

### Enviar comunicado

Públicos:

```text
Todos
Atividade específica
Categoria
Semestre
Participantes selecionados
```

---

# 60. DASHBOARD DO PARTICIPANTE

Seguir conceito visual aprovado.

Topo:

```text
Olá, Lívia 👋

Sua Jornada continua.
```

---

# 61. PRÓXIMA ATIVIDADE

Card principal:

```text
PRÓXIMA ATIVIDADE

Painel · Farmácia Clínica

23 OUT · 18h30

Bloco B · Sala 03
```

Botão:

```text
Ver detalhes
```

---

# 62. STATUS DE CHECK-IN NO DASHBOARD

Como o participante não faz o próprio check-in, não usar botão que sugira auto check-in.

Antes:

```text
CHECK-IN

Apresente seu RA ao responsável da atividade
```

Depois:

```text
✓ PRESENÇA CONFIRMADA

18h37
```

---

# 63. PROGRESSO

Exibir:

```text
Minha Jornada

● ● ● ○ ○

3 de 5 atividades concluídas
```

O total vem da configuração da edição.

---

# 64. NAVEGAÇÃO PARTICIPANTE

Barra inferior:

```text
Início
Programação
Passaporte
Brindes
Perfil
```

Não incluir FarmaArena fixamente.

---

# 65. ROTAS SUGERIDAS — PARTICIPANTE

```text
/
 /login/participante

/app
/app/programacao
/app/programacao/:activityId
/app/inscricoes
/app/passaporte
/app/brindes
/app/brindes/:rewardId
/app/perfil
/app/certificados
/app/notificacoes
```

---

# 66. LOJA / BRINDES

A proposta inicial prevê controle de estoque e retirada.

Criar entidade:

```text
RewardItem
```

Campos:

```text
id
edition_id
nome
descricao
imagem_url
estoque_total
estoque_disponivel
estoque_reservado
estoque_entregue
ativo
ordem
```

---

# 67. ESTOQUE INICIAL 2026

Seed:

| BrindeQuantidade |     |
| ---------------- | --- |
| Chaveiro         | 230 |
| Caneta           | 100 |
| Bloco            | 100 |
| Botton           | 60  |
| Ecobag           | 30  |
| Garrafa          | 20  |

Total:

```text
540
```

Estes números vêm da proposta atual.

Nunca hardcodar.

---

# 68. IMAGENS DOS BRINDES

Utilizar imagens fornecidas para:

- botton;
- garrafa;
- chaveiro;
- ecobag;
- bloco;
- caneta.

Administrador precisa poder substituí-las.

---

# 69. REGRA DE ELEGIBILIDADE

Criar sistema configurável:

```text
RewardRule
```

Pode usar:

```text
mínimo de check-ins
categoria concluída
atividade específica
Jornada completa
regra especial
```

Não fixar relação exata entre número de check-ins e objeto.

A proposta usa faixas progressivas de 1 a 5 check-ins.

---

# 70. CHAVEIRO

Nesta edição:

o chaveiro é o brinde básico/geral.

Todos que atingirem o requisito definido recebem.

---

# 71. REGRA AUTOMÁTICA DE DISTRIBUIÇÃO

Para qualquer categoria de brinde:

```text
elegíveis <= estoque
```

então:

```text
todos recebem
```

Se:

```text
elegíveis > estoque
```

então:

```text
sorteio necessário
```

Essa lógica já estava prevista na proposta.

---

# 72. SORTEIO

Administração visualiza:

```text
Garrafa

Elegíveis:
50

Estoque:
20

SORTEIO NECESSÁRIO
```

Botão:

```text
EXECUTAR SORTEIO
```

---

# 73. SORTEIO IMPARCIAL

Implementação precisa:

1. congelar lista de elegíveis;
2. salvar identificador do sorteio;
3. gerar seleção aleatória;
4. registrar resultado;
5. nunca sobrescrever sorteio anterior.

Criar:

```text
RewardDraw
RewardDrawEntry
```

---

# 74. HISTÓRICO DE SORTEIOS

Guardar:

```text
data
operador
brinde
estoque
número de elegíveis
lista de elegíveis
contemplados
rodada
```

---

# 75. CONFIRMAÇÃO DO BRINDE

Após ser contemplado:

participante recebe:

```text
🎉 Você foi contemplado
```

Botão:

```text
CONFIRMAR BRINDE
```

---

# 76. PRAZO DE CONFIRMAÇÃO

Configurável por item/sorteio.

Exemplo:

```text
30 minutos
60 minutos
até horário X
```

Não hardcodar.

---

# 77. EXPIRAÇÃO

Se não confirmar:

```text
reservation → expired
```

Unidade retorna para:

```text
estoque disponível
```

Admin recebe opção:

```text
SORTEAR ESTOQUE REMANESCENTE
```

---

# 78. GANHAR MAIS DE UM BRINDE

Não impor regra universal.

Criar configuração:

```text
allow_multiple_rewards
```

ou por item/regra:

```text
exclusive_group
```

Porque a decisão atual é:

- pode acontecer;
- categorias são diferentes;
- preferencialmente evitar concentração;
- comportamento pode variar.

---

# 79. STATUS DO BRINDE

Participante poderá ver:

```text
Não elegível
Em avaliação
Elegível
Garantido
Aguardando sorteio
Não contemplado
Contemplado
Aguardando confirmação
Reservado
Disponível para retirada
Entregue
Expirado
```

---

# 80. ESTOQUE VISÍVEL AO PARTICIPANTE

Exibir quantidade do estoque.

Exemplo:

```text
Ecobag
30 unidades
```

Mas sempre indicar que quantidade disponível pode variar.

---

# 81. TELA BRINDES

Topo:

```text
Brindes e Resgates

Check-ins:
3

Atividades concluídas:
3 de 5
```

Depois cards de produtos.

---

# 82. LOJINHA / RETIRADA

A proposta original define estados disponível, reservado e entregue.

Manter:

```text
AVAILABLE
RESERVED
DELIVERED
```

Adicionar:

```text
EXPIRED
CANCELLED
```

---

# 83. RETIRADA

Participante abre seu sistema.

Equipe confirma.

Admin pode localizar por:

```text
nome
RA
```

---

# 84. ENTREGA MÚLTIPLA

Permitir selecionar:

```text
✓ bloco
✓ caneta
✓ ecobag
```

e confirmar tudo em uma operação.

---

# 85. REGISTRO DA ENTREGA

Guardar:

```text
participante
brinde
quantidade
data
hora
operador
```

---

# 86. CARIMBO FÍSICO NA RETIRADA

O procedimento físico permanece.

O sistema registra entrega.

A equipe também realiza carimbo físico quando aplicável.

---

# 87. REVERSÃO DE ENTREGA

Admin autorizado poderá desfazer entrega incorreta.

Obrigatório:

```text
motivo
```

Estoque deve retornar corretamente.

Auditoria obrigatória.

---

# 88. ADMINISTRAÇÃO

Rotas sugeridas:

```text
/admin
/admin/edicoes
/admin/edicoes/:id
/admin/participantes
/admin/importacoes
/admin/categorias
/admin/palestrantes
/admin/atividades
/admin/inscricoes
/admin/lista-espera
/admin/operacao
/admin/checkins
/admin/passaportes
/admin/brindes
/admin/estoque
/admin/elegibilidade
/admin/sorteios
/admin/retiradas
/admin/certificados
/admin/notificacoes
/admin/relatorios
/admin/usuarios
/admin/auditoria
/admin/configuracoes
```

---

# 89. DASHBOARD ADMIN

Mostrar em tempo real:

```text
participantes cadastrados

inscrições

atividades acontecendo

vagas disponíveis

presentes

ausentes

check-ins

check-outs

participantes com 1/2/3/4/5 atividades

Jornada completa

estoque disponível

reservados

entregues

sorteios pendentes

certificados elegíveis
```

Isso amplia o painel administrativo originalmente previsto.

---

# 90. PERFIS ADMINISTRATIVOS

Três tipos iniciais:

```text
ADMIN_GENERAL
ORGANIZATION
OPERATOR
```

---

# 91. ADMINISTRADOR GERAL

Pode:

- tudo;
- editar edição;
- criar administradores;
- editar permissões;
- importar participantes;
- alterar programação;
- executar sorteios;
- exportar dados;
- consultar auditoria.

---

# 92. ORGANIZAÇÃO

Acesso amplo operacional.

Pode incluir:

- atividades;
- participantes;
- presença;
- loja;
- sorteios;
- relatórios.

Permissões devem ser configuráveis.

---

# 93. TÉCNICO / OPERADOR

Foco:

```text
Modo Operação
check-in
check-out
lista de inscritos
```

Acesso restante conforme permissão.

---

# 94. PERMISSÕES

Não depender apenas do cargo.

Criar RBAC.

Exemplo:

```text
participants.read
participants.write

activities.read
activities.write

attendance.register
attendance.correct

rewards.manage
draws.execute

reports.export
audit.read
```

---

# 95. LOGIN ADMINISTRATIVO

O login administrativo deve ser separado do login de participantes.

Recomendação:

```text
usuário/email
senha própria
```

Senha com hash forte.

Não usar RA como credencial administrativa.

---

# 96. EXPORTAÇÃO EXCEL

A proposta já previa exportação com nome, matrícula, semestre, atividades frequentadas, check-ins e brindes.

O novo módulo será mais amplo.

---

# 97. EXCEL — VISÃO CONSOLIDADA

Sheet:

### Participação

| NomeRASemestrePalestraAtividade 2Atividade 3Atividade 4Atividade 5Total |
| ----------------------------------------------------------------------- |

---

# 98. EXCEL — FORMATO LONGO

Sheet:

### Presenças

| NomeRAAtividadeCategoriaDataHorárioCheck-inCheck-outStatus |
| ---------------------------------------------------------- |

---

# 99. SHEETS RECOMENDADAS

Gerar workbook com:

```text
Participantes
Atividades
Inscrições
Lista de Espera
Presenças
Matriz de Presença
Passaportes
Certificados
Brindes
Elegibilidade
Sorteios
Reservas
Entregas
Estoque Final
```

Auditoria pode ser exportação separada.

---

# 100. FILTROS PARA EXPORTAÇÃO

Admin pode selecionar:

```text
edição
data
atividade
categoria
semestre
presença
certificado
```

---

# 101. TEMPO REAL

Algumas partes precisam refletir alterações imediatamente:

- vagas;
- lista de espera;
- presença;
- estoque;
- sorteios;
- notificações;
- dashboard administrativo.

Usar:

```text
WebSocket
ou
Server-Sent Events
```

conforme stack.

---

# 102. CONCORRÊNCIA

Tratar cuidadosamente:

### última vaga

Duas pessoas não podem obter a mesma vaga.

### última unidade

Dois operadores não podem entregar a mesma unidade.

### sorteio

Não permitir execução simultânea.

Usar transações/locking apropriado.

---

# 103. BANCO DE DADOS — ENTIDADES CENTRAIS

Modelo aproximado:

```text
Edition

Sponsor

Participant

AdminUser
Role
Permission

ActivityCategory

Speaker

Activity
ActivitySpeaker

Enrollment

WaitlistEntry

Attendance
AttendanceEvent

PassportStamp

RewardItem
RewardRule
RewardEligibility

RewardDraw
RewardDrawEntry

RewardReservation
RewardDelivery

Certificate

Notification
NotificationRecipient

AuditLog

ImportJob
ImportRow
```

---

# 104. ENROLLMENT

Campos:

```text
id
edition_id
participant_id
activity_id
status
created_at
cancelled_at
cancel_reason
late_enrollment
source
```

Status:

```text
ACTIVE
CANCELLED
NO_SHOW
COMPLETED
```

---

# 105. ATTENDANCE

Separar presença lógica de eventos.

```text
Attendance
```

pode resumir:

```text
participant_id
activity_id
checkin_at
checkout_at
status
```

e:

```text
AttendanceEvent
```

guardar histórico:

```text
CHECK_IN
CHECK_OUT
CANCEL_CHECK_IN
CANCEL_CHECK_OUT
CORRECTION
```

---

# 106. STATUS DE ATIVIDADE

```text
DRAFT
OPEN
FULL
WAITLIST
IN_PROGRESS
FINISHED
CANCELLED
```

---

# 107. ESTADOS DE INSCRIÇÃO NO FRONTEND

Exemplos:

```text
Disponível
Últimas vagas
Lotado
Lista de espera
Inscrito
Em andamento
Presença confirmada
Ausente
Encerrado
Cancelado
```

---

# 108. SEGURANÇA

Implementar:

- sessions/JWT seguros;
- cookies HTTP-only quando apropriado;
- CSRF;
- rate limit;
- validação server-side;
- RBAC;
- proteção de uploads;
- sanitização;
- logs;
- backups.

---

# 109. PRIVACIDADE

Não expor publicamente:

- RA;
- lista completa de participantes;
- resultado administrativo interno;
- logs.

RA só deve aparecer ao próprio participante e usuários autorizados.

---

# 110. UPLOADS

Validar:

```text
MIME type
tamanho máximo
extensão
```

Armazenar externamente ou object storage.

Nunca confiar no filename enviado.

---

# 111. ACESSIBILIDADE

Implementar:

```text
contraste WCAG
labels reais
teclado
focus visible
alt text
touch targets >= aproximadamente 44px
```

Textos não devem existir apenas dentro de imagens.

---

# 112. PERFORMANCE MOBILE

Priorizar:

- imagens otimizadas;
- lazy load;
- WebP/AVIF;
- bundles pequenos;
- cache;
- skeleton loaders.

---

# 113. DESIGN SYSTEM

Criar componentes reutilizáveis:

```text
Button
IconButton
Card
ActivityCard
RewardCard
StatusBadge
Avatar
Modal
Drawer
Tabs
FilterChip
Input
Select
Table
DataGrid
EmptyState
Toast
NotificationBanner
Progress
Stamp
BottomNavigation
AdminSidebar
```

---

# 114. RESPONSIVIDADE

Participant:

```text
mobile:
bottom navigation
cards

desktop:
max-width central
```

Admin:

```text
desktop:
sidebar + content

mobile:
drawer + simplified tables
```

---

# 115. TELA ADMIN DE PARTICIPANTES

Tabela:

```text
Nome
RA
Semestre
Atividades
Check-ins
Certificado
Status
```

Filtros:

```text
nome
RA
semestre
presença
```

---

# 116. PERFIL ADMIN DO PARTICIPANTE

Mostrar:

```text
Dados
Inscrições
Lista de espera
Presenças
Passaporte
Certificados
Brindes
Sorteios
Retiradas
Histórico
```

---

# 117. ATIVIDADE ADMIN

Dashboard por atividade:

```text
capacidade
inscritos
presentes
ausentes
lista de espera
vagas
check-ins
check-outs
```

---

# 118. CANCELAMENTO DE ATIVIDADE

Admin cancela.

Sistema:

1. cancela inscrições;
2. remove lista de espera;
3. envia notificações;
4. registra auditoria.

Não apagar a atividade.

---

# 119. ALTERAÇÃO DE SALA

Admin altera:

```text
Bloco B / Sala 03
→
Bloco C / Sala 01
```

Sistema envia notificação automática para inscritos.

---

# 120. ALTERAÇÃO DE HORÁRIO

Antes de salvar:

verificar conflitos provocados nas inscrições existentes.

Se alteração gerar conflito:

mostrar relatório antes da confirmação.

Não alterar silenciosamente.

---

# 121. ESTADO "ACONTECENDO AGORA"

Calcular por:

```text
now >= início
AND
now <= fim
```

Exibir destaque na programação.

---

# 122. NOTIFICAÇÃO "ACONTECENDO AGORA"

No início:

```text
Sua atividade está começando agora.
Bloco B · Sala 03
```

---

# 123. RELÓGIO DO SISTEMA

Todos os cálculos temporais devem usar timezone da edição.

Nunca usar horário do navegador como fonte absoluta.

Servidor é a referência.

---

# 124. TESTES ESSENCIAIS

Codex deve criar testes automáticos para:

```text
login participante
RA duplicado
importação
limite de vagas
conflito de horário
troca atômica
lista de espera
promoção automática
no-show +20
check-in +15
late check-in +25
checkout palestra
certificado
elegibilidade
sorteio
reserva
expiração
retirada
reversão de retirada
auditoria
permissões
Excel
```

---

# 125. CENÁRIO DE TESTE — VAGA

```text
Painel:
20 vagas

20 inscritos

Novo participante:
entra em espera

Participante A:
não faz check-in

T+20:
A = NO_SHOW

vaga aberta

primeiro da fila:
promovido automaticamente

novo participante:
check-in até T+25
```

Resultado esperado:

```text
capacidade nunca > 20
```

---

# 126. CENÁRIO — TROCA

Participante inscrito em:

```text
Painel A
```

Painel B tem uma vaga.

Participante toca:

```text
Trocar
```

Resultado:

```text
B reservado
A liberado
```

Nunca existir intervalo em que perde ambos por condição de corrida.

---

# 127. CENÁRIO — SORTEIO

```text
Garrafa:
20 unidades

Elegíveis:
50
```

Admin:

```text
Executar sorteio
```

Resultado:

```text
20 contemplados
30 não contemplados
```

Guardar snapshot de todos os 50.

---

# 128. CENÁRIO — EXPIRAÇÃO

20 ganhadores.

5 não confirmam.

Resultado:

```text
15 reservadas
5 disponíveis
```

Admin:

```text
Sortear estoque remanescente
```

Nova rodada com histórico separado.

---

# 129. CENÁRIO — CERTIFICADO

Palestra:

```text
check-in = sim
check-out = sim
```

Resultado:

```text
ELIGIBLE
```

Apenas check-in:

```text
NOT ELIGIBLE
```

---

# 130. O QUE NÃO IMPLEMENTAR

Codex deve **evitar explicitamente**:

```text
QR Code para presença

mapa da faculdade

cadastro público de participante

participante fazendo próprio check-in

painéis fixos no código

categorias fixas no código

230 alunos fixos

20 vagas fixas

5 check-ins fixos

estoque fixo

2026 como regra permanente

sorteio sobrescrevendo rodada anterior

alteração crítica sem log

retirada sem controle de estoque

certificado antes do fim do evento
```

---

# 131. STACK TÉCNICA

Antes de começar, Codex deve inspecionar o repositório.

Se já existir stack:

usar stack existente.

Se for projeto greenfield, recomendação:

```text
Frontend:
React / Next.js
TypeScript

UI:
Tailwind CSS
componentes acessíveis

Backend:
Next server / Node API

Banco:
PostgreSQL

ORM:
Prisma

Realtime:
SSE ou WebSocket

Storage:
S3-compatible

Excel:
ExcelJS ou equivalente

PDF:
engine server-side

PWA:
manifest + service worker

Testes:
Vitest/Jest
Playwright
```

A stack é recomendação, não regra funcional.

---

# 132. ESTRUTURA DE PROJETO SUGERIDA

```text
src/
  app/
    public/
    participant/
    admin/

  components/
    ui/
    activity/
    attendance/
    rewards/
    passport/
    admin/

  services/
    auth/
    enrollment/
    waitlist/
    attendance/
    rewards/
    certificates/
    notifications/
    exports/

  db/
    schema/
    migrations/
    seeds/

  lib/
    time/
    validation/
    permissions/
    audit/

  workers/
    notifications/
    waitlist/
    reward-expiration/

  tests/
```

---

# 133. JOBS PROGRAMADOS

Precisaremos de tarefas automáticas para:

```text
marcar NO_SHOW aos +20

promover lista de espera

expirar reservas

enviar lembretes

liberar certificados após evento

recalcular elegibilidade
```

Preferir queue/job scheduler confiável.

---

# 134. SEED 2026

Criar script de seed inicial com:

```text
Jornada Farmacêutica 2026

Slogan:
farmácia em movimento

max_checkins:
5
```

Categorias:

```text
Palestra
FarmaArena
Cursos
Outros
```

Brindes:

```text
230 chaveiros
100 canetas
100 blocos
60 bottons
30 ecobags
20 garrafas
```

Não inserir participantes fictícios no ambiente de produção.

---

# 135. FASES DE DESENVOLVIMENTO PARA CODEX

## Fase 1 — Fundação

Criar:

- projeto;
- banco;
- migrations;
- autenticação;
- layout;
- design system;
- edição;
- roles;
- auditoria.

## Fase 2 — Participantes

Criar:

- CRUD;
- importação;
- login;
- perfil;
- avatar.

## Fase 3 — Programação

Criar:

- categorias;
- palestrantes;
- atividades;
- programação;
- inscrições;
- conflito;
- capacidades.

## Fase 4 — Lista de espera

Criar:

- fila;
- promoção;
- troca;
- timeout;
- T+15/T+20/T+25.

## Fase 5 — Operação

Criar:

- modo sala;
- busca por RA;
- check-in;
- check-out;
- correções;
- realtime.

## Fase 6 — Passaporte

Criar:

- carimbos;
- progresso;
- dashboard participante.

## Fase 7 — Brindes

Criar:

- catálogo;
- estoque;
- regras;
- elegibilidade;
- sorteio;
- reservas;
- expiração;
- retirada.

## Fase 8 — Certificados

Criar:

- elegibilidade;
- modelo;
- geração;
- liberação;
- validação.

## Fase 9 — Notificações

Criar:

- PWA;
- push;
- centro de notificações;
- notificações automáticas;
- comunicados.

## Fase 10 — Relatórios

Criar:

- dashboard;
- Excel;
- filtros;
- relatórios finais.

## Fase 11 — QA

Testar:

- celular;
- tablet;
- desktop;
- concorrência;
- acesso;
- permissões;
- carga;
- horário;
- sorteio.

---

# 136. PRIMEIRA ORDEM PARA O CODEX

Antes de produzir centenas de arquivos, o Codex deve:

1. inspecionar o repositório;
2. informar stack existente;
3. mapear estrutura atual;
4. propor schema de banco;
5. criar migrations;
6. criar design system mínimo;
7. implementar edição + usuários;
8. implementar fluxo de participante;
9. avançar por módulos.

Não começar por telas estáticas desconectadas do banco.

---

# 137. CRITÉRIO DE PRONTO DA PRIMEIRA VERSÃO

Considerar MVP funcional somente quando for possível executar de ponta a ponta:

```text
Admin cria edição
↓
Admin cadastra/importa participante
↓
Admin cria categorias
↓
Admin cadastra atividade
↓
Participante entra
↓
Participante se inscreve
↓
Sistema impede conflito
↓
Admin registra check-in
↓
Passaporte atualiza
↓
Participação gera elegibilidade
↓
Admin executa sorteio se necessário
↓
Participante confirma brinde
↓
Equipe entrega
↓
Sistema atualiza estoque
↓
Admin exporta Excel
```

Esse é o fluxo mínimo completo.

---

# 138. PRINCÍPIO FINAL PARA O CODEX

O sistema deve ser construído pensando em:

**configuração em vez de hardcode.**

Sempre que surgir a pergunta:

> “Isso pode mudar no próximo ano?”

a resposta arquitetural provavelmente deve ser:

> **coloque como configuração da edição.**

Isso vale principalmente para:

- identidade;
- datas;
- horários;
- quantidade de atividades;
- limite de check-ins;
- categorias;
- cores;
- ícones;
- vagas;
- tolerâncias;
- carga horária;
- notificações;
- brindes;
- estoque;
- regras;
- sorteios;
- certificados;
- patrocinadores.

Esse é o ponto que transforma o Jornadas de um site de evento em uma **plataforma reutilizável para gestão das próximas Jornadas Farmacêuticas**.