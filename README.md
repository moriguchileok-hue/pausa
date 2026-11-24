# PAUSA — Seu hobby começa com uma pausa

Site estático (HTML, CSS e JavaScript puro). Não precisa de instalação, build ou servidor.

## Publicar no GitHub Pages
Settings → Pages → Branch `main`, pasta `/ (root)`.

## Estrutura
- `index.html` — Home (desktop) · `Vitrine.dc.html` · `Loja.dc.html` · `Blog.dc.html`
- `Mobile-*.dc.html` — versões mobile (celulares são redirecionados automaticamente; use `?desktop=1` para forçar o desktop)
- `js/pausa.js` — renderizador próprio (produtos, sacola, checkout, menu)
- `assets/` — fotos, ilustrações e logos (caminhos relativos)
- `.nojekyll` — impede o Jekyll do GitHub Pages de ignorar arquivos
