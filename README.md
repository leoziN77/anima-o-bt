# Bola 3D → QR Code do Bolão da Tropa

Projeto de teste independente. Não altera nem se conecta ao código do Bolão da Tropa.

## Rodar

1. Instale Node.js 20+.
2. Abra esta pasta no VS Code.
3. No terminal:

```bash
npm install
npm run dev
```

4. Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.
5. Clique na bola.
6. O QR Code gerado aponta por padrão para:

`https://bolaodatropa.com.br/`

Use a câmera do celular para escanear.

## Alterar o destino

Edite o campo na parte inferior da tela e clique em **Atualizar QR**.

## Observação

Esta é uma implementação web independente inspirada no conceito da demo de QR 3D, feita com Three.js + geração real de matriz QR.
