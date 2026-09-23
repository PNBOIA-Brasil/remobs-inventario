# Reescrita SPA no Amplify para rotas com id

## Contexto

Acesso direto a rotas com id, como `/app/withdrawals/<id>` e `/app/inventory/<id>`, respondia 404 sem corpo. O build só gera fallback para rotas fixas, e a regra do Amplify (`</*>` → `/index.html`, status `404-200`) não entregava o `index.html`. O usuário encontrou o erro ao abrir um pedido pelo link.

## Alteração

Autorizada pelo usuário em 2026-09-23. App Amplify `d1oidnxd2f4saq`, profile `aws-remobs`.

- Regra anterior: `</*>` → `/index.html`, `404-200`.
- Regra nova: todo caminho sem extensão de arquivo estático → `/index.html`, status `200`:
  `</^[^.]+$|[.](?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|webp|pdf)$)([^.]+$)/>`

Sem mudança de código e sem novo deploy.

## Validações

- `/app/withdrawals/<id>` (com e sem barra final), `/app/inventory/<id>`, `/app/home`, `/login` e `/` respondem 200 com o bundle `index-BLLHr6c1.js`.
- `sw.js`, `manifest.webmanifest` e `assets/index-BLLHr6c1.js` continuam 200 com o tipo correto.

## Rollback

`aws amplify update-app --app-id d1oidnxd2f4saq --custom-rules '[{"source":"</*>","target":"/index.html","status":"404-200"}]' --profile aws-remobs --region sa-east-1`
