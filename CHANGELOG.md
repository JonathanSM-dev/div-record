# Changelog

Este arquivo registra apenas versoes relevantes do projeto e deve permanecer em ordem decrescente.

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
