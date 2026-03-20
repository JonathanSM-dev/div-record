# DIV Record

Extensao de navegador para Chrome/Edge que permite selecionar elementos diretamente na pagina e salvar um print ja recortado, sem precisar editar a imagem depois.

## Versao atual

- `1.2.0`

## Como usar

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactacao** e selecione esta pasta:
   - `C:\Users\jonat\Documents\div-record`
4. Abra a pagina que deseja capturar.
5. Clique no icone da extensao e depois em **Selecionar elemento**.
6. Passe o mouse pela pagina para destacar o elemento.
7. Use a roda do mouse ou as setas para subir e descer na hierarquia do container.
8. Clique no elemento desejado para gerar e baixar o print.

## Atalho

- `Alt+Shift+D` inicia a selecao diretamente na aba ativa.

## O que a extensao faz

- Destaca o elemento sob o cursor.
- Permite navegar na hierarquia do container antes de capturar.
- Suporta `div`, `section`, `article`, `main`, `button`, `canvas`, `svg`, `img` e outros elementos comuns.
- Adiciona margem configuravel ao redor da captura.
- Esconde o destaque visual antes de salvar a imagem.
- Captura elementos maiores que a viewport em varias partes e costura o resultado.
- Mostra progresso quando a captura precisa montar mosaico.
- Pode copiar a imagem para a area de transferencia.
- Faz o recorte automaticamente e baixa um `.png`.

## Versionamento e backups

- Fluxo de release: `RELEASE.md`
- Backup geral inicial: `backups/div-record-backup-20260320-140057.zip`
- Snapshot versionado da `1.1.0`: `backups/div-record-v1.1.0.zip`

## Limitacao importante

A API padrao de extensoes captura a area visivel da aba, entao a extensao percorre a pagina em multiplos screenshots quando o elemento e maior que a janela. Ainda podem existir diferencas em sites com cabecalhos fixos, animacoes ou conteudo que muda durante a rolagem.

