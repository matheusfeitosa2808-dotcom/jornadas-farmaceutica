# Plano 002 — ícones da marca

**Base auditada:** `1b5f825`

## Problema

Os atalhos e indicadores usam pictogramas genéricos em círculos simples, enquanto o sistema visual da Jornada é construído por carimbos, medalhões e filetes clássicos.

## Implementação

- Criar o componente reutilizável `BrandIcon`.
- Usar borda facetada, aro interno e núcleo em papel, sem imagem raster e sem distorção.
- Oferecer tons teal, ouro, sálvia e vinho, mantendo contraste acessível.
- Aplicar em atalhos da home, métricas e links do perfil, ranking, notificações e estados vazios.

## Aceite

- Os ícones preservam a leitura do pictograma e parecem parte da família de carimbos.
- O componente funciona em 32, 44 e 52 px sem cortar o conteúdo.
- Ícones informativos continuam com `aria-hidden`; rótulos continuam em texto.
