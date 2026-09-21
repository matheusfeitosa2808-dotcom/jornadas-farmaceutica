# Plano 001 — movimento e resposta

**Base auditada:** `1b5f825`

## Problema

A troca de abas da navegação anima `filter`, que exige nova pintura. Os cards navegáveis não têm um feedback de pressão unificado e as barras de progresso saltam pela propriedade `width`.

## Implementação

- Remover a transição de `filter` dos selos da navegação e manter o estado ativo por opacidade, escala e fundo.
- Dar pressão de `scale(.975)` por 120 ms aos cards acionáveis.
- Renderizar o progresso por `transform: scaleX()` com origem à esquerda e easing `cubic-bezier(.23,1,.32,1)`.
- Preservar as animações raras de conquista e da Farma Arena.
- Em movimento reduzido, remover deslocamentos e manter apenas mudanças instantâneas de estado.

## Aceite

- Nenhum controle frequente anima `filter`, `width`, `height`, `top` ou `left`.
- Todo card clicável responde no toque inicial.
- Progressos informam o valor correto via ARIA.
