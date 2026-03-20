# Release Flow

Este projeto usa versionamento semantico:

- `patch`: `1.2.0 -> 1.2.1`
  - correcao de bug, ajuste de estabilidade, refinamento sem mudar fluxo principal
- `minor`: `1.2.0 -> 1.3.0`
  - nova funcionalidade compativel com o que ja existia
- `major`: `1.2.0 -> 2.0.0`
  - mudanca que quebra comportamento anterior ou exige migracao relevante

## Processo padrao

1. Trabalhar em uma branch de feature.
2. Validar o comportamento manualmente.
3. Atualizar a versao:
   - `.\scripts\release.ps1 -Version 1.2.1`
4. Revisar `manifest.json`, `README.md` e `CHANGELOG.md`.
5. Fazer commit:
   - `git add .`
   - `git commit -m "Release v1.2.1"`
6. Subir a branch e mergear em `master`.
7. Criar a tag:
   - `git tag -a v1.2.1 -m "Release v1.2.1"`
8. Enviar branch e tag:
   - `git push origin master`
   - `git push origin v1.2.1`

## Regras do changelog

- Colocar a versao mais recente no topo.
- Descrever so mudancas que importam para uso, manutencao ou release.
- Usar bullets curtos e objetivos.
- Nao criar tag Git para versoes que nunca existiram como commit real.

## Convencao recomendada de commit

- `fix: corrige corte em capturas grandes`
- `feat: adiciona copia para area de transferencia`
- `docs: atualiza fluxo de release`
- `release: v1.2.1`

## Checklist rapida

- `manifest.json` com a nova versao
- `README.md` com a versao atual
- `CHANGELOG.md` atualizado
- extensao recarregada e testada manualmente
- commit criado
- tag criada
- push da branch e da tag concluido
