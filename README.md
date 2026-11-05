# Kinkel 🐧

Juego educativo de escritorio para que niños de **5 a 7 años** aprendan a escribir
tocando el teclado. La app muestra un teclado grande en pantalla: al pulsar una
tecla física, la letra **sale volando de la tecla** y aterriza en el texto que el
niño va componiendo, línea a línea (Enter = nueva línea).

Contenido en **español (Latinoamérica)**, teclado **LATAM** con Ñ y acentos.

## Estado

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 | Setup del proyecto y limpieza del template | ✅ |
| 1 | MVP: teclado en pantalla, letras voladoras, texto línea a línea | 🚧 |
| 2 | Config de modos (libre/lecciones), pingüino mascota, estrellas, confetti | Pendiente |
| 3 | Empaquetado desktop con Tauri (Windows/Linux/macOS) | Pendiente |

## Requisitos

- Node.js + pnpm
- (Fase 3) [Rust](https://rustup.rs/) para compilar la ventana desktop con Tauri

## Desarrollo

```bash
pnpm install
pnpm dev        # abre la app en http://localhost:1420
pnpm build      # typecheck (tsc) + build de producción
```

### Desktop (fase 3)

```bash
pnpm tauri dev    # requiere Rust instalado
pnpm tauri build  # genera los paquetes de la app
```

## Estructura

```
src/
  keyboard/layout.ts      # definición del teclado LATAM (teclas, dedos, colores)
  audio/sounds.ts         # sonidos sintetizados con Web Audio API (sin assets)
  components/             # Keyboard, Key, TextStage, FlyingLetter…
  App.tsx                 # composición principal y manejo de entrada
src-tauri/                # shell desktop (Tauri 2)
```

## Versionado y releases

- `main` es la rama principal; cada tarea terminada se commitea y pushea.
- Las versiones se publican como **releases completos** en GitHub
  (tag `vX.Y.Z` + título + descripción), usando `gh`:

```bash
git tag -a v0.1.0 -m "Kinkel v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 --title "Kinkel v0.1.0" --notes "…"
```
