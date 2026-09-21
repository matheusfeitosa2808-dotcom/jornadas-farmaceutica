# Plano 003 — cor, tipografia e alinhamento

**Base auditada:** `1b5f825`

## Problema

Alguns textos pequenos perdem contraste, a navegação móvel comprime os rótulos e títulos longos não equilibram bem a linha. A paleta clara tem áreas excessivamente lavadas.

## Implementação

- Refinar os tokens principais para azul Cathedral, ouro antigo, sálvia e papel quente.
- Usar a pilha tipográfica do sistema para textos funcionais e Georgia nos títulos editoriais.
- Aplicar `text-wrap: balance` em títulos e `text-wrap: pretty` em descrições.
- Ajustar tamanhos e espaçamentos da navegação para seis itens em telas estreitas.
- Reforçar contraste de texto secundário e criar divisores decorativos discretos nos cabeçalhos.

## Aceite

- Não existe rolagem horizontal entre 320 e 1440 px.
- Rótulos da navegação permanecem legíveis em 320 px.
- Títulos não colidem com ícones nem produzem palavras quebradas isoladamente.
