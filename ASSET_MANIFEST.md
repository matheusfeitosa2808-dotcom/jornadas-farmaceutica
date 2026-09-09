# Asset Manifest — Jornadas

## Fonte de verdade visual

- `assets/brand/logo-jornada-2026.png` — logo oficial da Jornada Farmacêutica 2026. Não redesenhar.
- `assets/brand/cathedral-fachada.png` — fachada recortada/estilizada da Cathedral; usar como elemento de apoio, especialmente no passaporte e em momentos institucionais.
- `assets/reference/passaporte-fisico.pdf` — referência física oficial. A linguagem do passaporte digital deve dialogar com esse material.
- `assets/reference/passaporte-digital-reference.png` — referência conceitual de composição. IMPORTANTE: não copiar o QR code nem a navegação antiga; obedecer à especificação funcional.

## Selos / carimbos oficiais

Arquivos em `assets/stamps/`:

- `selo-1.png`
- `selo-2.png`
- `selo-3.png`
- `selo-4.png`
- `selo-5.png`
- `selo-6.png`
- `selo-8.png`
- `selo-9.png`
- `selo-10.png`
- `selo-11.png`

Uso recomendado:

- tratar como assets reais, não como inspiração para redesenho;
- preservar textura de carimbo/selo;
- permitir que o admin associe um selo a uma categoria/atividade;
- no passaporte, carimbo concluído usa imagem real com cor/original; não concluído usa placeholder de contorno com baixa opacidade;
- nunca distorcer proporções;
- gerar miniaturas WebP/AVIF em build, preservando PNG original.

## Regra visual

- shell do app: minimalista, claro, limpo;
- passaporte: área mais clássica/afetiva, com textura e selos;
- dashboard admin: sóbrio, utilitário, desktop-first;
- ícones funcionais comuns: SVG consistentes (Lucide/Phosphor ou equivalentes), não imagens raster;
- não transformar textos de interface em imagens.
