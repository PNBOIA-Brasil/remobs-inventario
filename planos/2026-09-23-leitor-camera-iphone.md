# Leitura pela câmera no iPhone

## Contexto

No Chrome do iPhone, a tela Escanear exibia "Leitura pela câmera indisponível neste navegador". No iOS, todos os navegadores usam o WebKit, que não implementa a API `BarcodeDetector`; a tela só habilitava a câmera quando essa API existia. O mesmo ocorria no Chrome desktop do Windows.

## Objetivo

Permitir a leitura de QR Code e códigos de barras pela câmera no iPhone (Safari e Chrome) e em navegadores sem `BarcodeDetector`.

## Escopo

- Somente frontend (`ScanPage`). Sem alteração de backend.
- A câmera fica disponível sempre que o navegador oferece `getUserMedia`.
- Com `BarcodeDetector` nativo, nada muda. Sem ele, carrega sob demanda o ponyfill `barcode-detector` (zxing-wasm), com o `.wasm` servido pelo próprio app, sem CDN externa. O service worker o mantém em cache para uso em campo.
- Nova dependência: `barcode-detector` 3.2.2 (depende de `zxing-wasm`). O bundle principal praticamente não cresce; o leitor (~1,1 MB, 461 KB gzip) só é baixado ao abrir a câmera em navegador sem a API nativa.
- Correções junto: o fluxo da câmera é encerrado quando a tela fecha antes da permissão ser concedida, e leituras sobrepostas são evitadas.
- Cache PWA `remobs-inventario-v19`.

## Validações

- `tsc -b` sem erros e `npm run build` concluído (`zxing_reader-*.wasm` e `ponyfill-*.js` em chunks separados).
- Suíte do frontend: 24 arquivos, 58 testes aprovados com `--maxWorkers=2`. Na execução paralela padrão, 2 a 3 testes de outras telas estouraram o limite de 5 s por carga da máquina e passaram isoladamente.
- Pendente: teste real no iPhone após o deploy.

## Resultado

Commit `c94bcea`. Deploy autorizado pelo usuário em 2026-09-23 (profile `aws-remobs`, `sa-east-1`).

| Etapa | Resultado |
| :--- | :--- |
| Job `42` | `SUCCEED`, mas o `.wasm` voltava como `index.html` (200, `text/html`) |
| Causa | A regra SPA do Amplify reescrevia para `/index.html` toda extensão fora da lista, e `wasm` não constava nela |
| Regra | `update-app` com `wasm` incluído na lista, autorizado pelo usuário; o restante da regra ficou igual |
| Job `43` | Mesmo pacote republicado para limpar o cache da CDN; `SUCCEED` |
| Verificação | `.wasm` servido como `application/wasm` (1.093.289 bytes); QR Code da retirada decodificado em produção pelo leitor zxing-wasm, em navegador sem `BarcodeDetector` |

Rollback: republicação do job 41 no Amplify. Pendente: teste com a câmera de um iPhone.
