# Changelog

Este arquivo registra apenas versoes relevantes do projeto e deve permanecer em ordem decrescente.

## 1.11.0

- Adicionada opcao para exportar capturas do modo lote em um unico arquivo `.zip`.
- O popup agora so permite ativar exportacao em ZIP quando o modo lote estiver ligado.

## 1.10.0

- Adicionada previa opcional antes do download para capturas individuais.
- A previa abre em uma pagina da extensao e permite baixar, copiar ou fechar.

## 1.8.0

- Adicionado formato configuravel para nomes de arquivo: humano, curto ou detalhado.
- Melhorada a heuristica para ocultar anuncios, banners, chats, modais e overlays flutuantes durante a captura.

## 1.7.3

- Adicionado `Ctrl+Z` para desfazer o ultimo item marcado no lote.
- O atalho de desfazer agora aparece visivelmente no popup da extensao.

## 1.7.2

- Adicionado contador fixo na tela com a quantidade de itens marcados no lote.
- O contorno visual dos itens marcados no lote agora e escondido antes da captura para nao sair no print final.

## 1.7.1

- Os atalhos principais agora aparecem visivelmente no popup da extensao.
- Adicionado `Enter` para processar o lote marcado.
- Adicionado `Backspace/Delete` para limpar rapidamente o lote marcado.

## 1.7.0

- O modo lote agora permite marcar varios elementos primeiro e processar tudo apenas ao pressionar `Esc`.
- Itens marcados ficam destacados visualmente ate o inicio do processamento do lote.
- O fluxo foi ajustado para facilitar selecao rapida sem salvar arquivo a cada clique.

## 1.6.0

- Adicionado ajuste rapido de margem pelo teclado durante a selecao com `+` e `-`.
- O overlay agora mostra dimensoes do elemento e margem atual para facilitar o ajuste fino.

## 1.5.1

- Adicionado contador visual para a sessao de capturas em modo lote.
- Arquivos de uma mesma sessao em lote agora recebem numeracao automatica.

## 1.5.0

- Adicionado modo lote para capturar varios elementos em sequencia.
- A selecao pode continuar ativa apos cada captura ate o usuario pressionar `Esc`.
- Melhorado o fluxo para evitar novos cliques enquanto uma captura ainda esta em andamento.

## 1.4.0

- Adicionada opcao para ocultar elementos `fixed` e `sticky` durante a captura.
- Elementos flutuantes escondidos sao restaurados automaticamente ao final do processo.
- Melhorada a robustez em paginas com headers, chats e barras persistentes.

## 1.3.0

- Adicionado prefixo configuravel para o nome do arquivo.
- O nome salvo agora inclui prefixo, hostname, titulo da pagina e elemento capturado.
- Adicionada opcao para baixar direto sem abrir a janela de salvar.

## 1.2.0

- Adicionado atalho `Alt+Shift+D` para iniciar a selecao sem abrir o popup.
- Formalizado o versionamento no projeto.
- Documentacao atualizada com versao atual e backups disponiveis.

## 1.1.0

- Adicionada selecao hierarquica do elemento.
- Adicionada margem configuravel no popup.
- Expandido o suporte para mais tipos de elemento alem de `div`.
- Adicionada copia opcional para a area de transferencia.
- Melhorada a captura em mosaico para elementos maiores que a viewport.
- Adicionado controle de taxa e retry para evitar erro de quota do `captureVisibleTab`.

## 1.0.0

- Criada a extensao base com selecao visual e captura recortada.
