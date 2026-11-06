import { useEffect, useRef, useState } from "react";
import {
  AppleIcon,
  CloseIcon,
  DownloadIcon,
  LinuxIcon,
  WindowsIcon,
} from "./Icons";

const RELEASE_API =
  "https://api.github.com/repos/xenoxf/Kinkel/releases/latest";
const RELEASES_URL = "https://github.com/xenoxf/Kinkel/releases/latest";

type PlatformId = "macos" | "windows" | "linux";

interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface ReleaseInfo {
  tag_name: string;
  html_url: string;
  assets: ReleaseAsset[];
}

type ReleaseState =
  | { status: "loading" }
  | { status: "ready"; release: ReleaseInfo }
  | { status: "error" };

interface Platform {
  id: PlatformId;
  name: string;
  detail: string;
  extensions: string[];
}

const PLATFORMS: Platform[] = [
  {
    id: "macos",
    name: "macOS",
    detail: "Apple Silicon e Intel · instalador .dmg",
    extensions: [".dmg"],
  },
  {
    id: "windows",
    name: "Windows",
    detail: "Windows 10 u 11 de 64 bits · .exe o .msi",
    extensions: [".exe", ".msi"],
  },
  {
    id: "linux",
    name: "Linux",
    detail: "64 bits · AppImage o paquete .deb",
    extensions: [".appimage", ".deb"],
  },
];

function platformIcon(id: PlatformId) {
  if (id === "macos") return <AppleIcon size={26} />;
  if (id === "windows") return <WindowsIcon size={24} />;
  return <LinuxIcon size={26} />;
}

function pickAsset(
  release: ReleaseInfo | null,
  extensions: string[],
): ReleaseAsset | undefined {
  if (!release) return undefined;

  for (const extension of extensions) {
    const match = release.assets.find((asset) =>
      asset.name.toLowerCase().endsWith(extension),
    );
    if (match) return match;
  }

  return undefined;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

interface DownloadModalProps {
  onClose: () => void;
}

export function DownloadModal({ onClose }: DownloadModalProps) {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`GitHub respondió ${response.status}`);
        return response.json() as Promise<ReleaseInfo>;
      })
      .then((release) => {
        if (active) setState({ status: "ready", release });
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          setState({ status: "error" });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const release = state.status === "ready" ? state.release : null;
  const releasesUrl = release?.html_url ?? RELEASES_URL;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onPointerDown={onClose}
    >
      <div
        className="modal download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="icon-btn modal-close"
          onClick={onClose}
          title="Cerrar"
          aria-label="Cerrar"
        >
          <CloseIcon size={20} />
        </button>

        <div className="download-head">
          <span className="download-badge" aria-hidden="true">
            <DownloadIcon size={24} />
          </span>
          <div>
            <h2 id="download-title">Descargar Kinkel</h2>
            <p>
              Elige tu sistema. Los instaladores se compilan y publican
              automáticamente en GitHub Releases.
            </p>
          </div>
        </div>

        <div className="download-options">
          {PLATFORMS.map((platform) => {
            const asset = pickAsset(release, platform.extensions);
            const href = asset?.browser_download_url ?? releasesUrl;

            return (
              <a
                key={platform.id}
                className="download-card"
                href={href}
                target="_blank"
                rel="noreferrer"
                title={asset?.name ?? "Abrir GitHub Releases"}
              >
                <span className={`download-os download-os--${platform.id}`}>
                  {platformIcon(platform.id)}
                </span>
                <span className="download-copy">
                  <strong>{platform.name}</strong>
                  <small>{platform.detail}</small>
                </span>
                <span className="download-meta">
                  <DownloadIcon size={17} />
                  {asset
                    ? formatSize(asset.size) || "Descargar"
                    : state.status === "loading"
                      ? "Buscando…"
                      : "Ver releases"}
                </span>
              </a>
            );
          })}
        </div>

        <div className="download-footer">
          <span aria-live="polite">
            {state.status === "loading"
              ? "Buscando la última versión…"
              : state.status === "ready"
                ? `Última versión: ${state.release.tag_name}`
                : "No se pudo consultar GitHub."}
          </span>
          <a href={releasesUrl} target="_blank" rel="noreferrer">
            Ver todas las versiones
          </a>
        </div>

        <p className="download-note">
          Las apps no están firmadas: macOS puede pedir abrirlas desde Ajustes
          y Windows puede mostrar SmartScreen. Descárgalas solo desde este
          repositorio oficial.
        </p>
      </div>
    </div>
  );
}
