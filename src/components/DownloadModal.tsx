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
  published_at: string;
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
  primaryExtensions: string[];
  alternateExtensions: string[];
}

const PLATFORMS: Platform[] = [
  {
    id: "macos",
    name: "macOS",
    detail: "Apple Silicon e Intel",
    primaryExtensions: [".dmg"],
    alternateExtensions: [],
  },
  {
    id: "windows",
    name: "Windows",
    detail: "Windows 10 y 11 · 64 bits",
    primaryExtensions: [".exe"],
    alternateExtensions: [".msi"],
  },
  {
    id: "linux",
    name: "Linux",
    detail: "AppImage o deb",
    primaryExtensions: [".appimage"],
    alternateExtensions: [".deb"],
  },
];

function platformIcon(id: PlatformId) {
  if (id === "macos") return <AppleIcon size={25} />;
  if (id === "windows") return <WindowsIcon size={23} />;
  return <LinuxIcon size={25} />;
}

function detectSystem(): { os: string; arch: string; id: string } {
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  let os = "tu sistema";
  let id = "";
  let arch = "";

  if (/windows/i.test(ua)) {
    os = "Windows";
    id = "windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
    id = "macos";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
    id = "linux";
  }

  if (/arm64|aarch64/i.test(ua) || /arm/i.test(platform)) {
    arch = "ARM";
  } else if (/x86_64|wow64|win64|amd64/i.test(ua)) {
    arch = "x86_64";
  } else if (id && /64/i.test(platform)) {
    arch = "64 bits";
  }

  return { os, arch, id };
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

function formatLabel(asset: ReleaseAsset): string {
  const name = asset.name.toLowerCase();
  if (name.endsWith(".dmg")) return "DMG";
  if (name.endsWith(".msi")) return "MSI";
  if (name.endsWith(".exe")) return "EXE";
  if (name.endsWith(".appimage")) return "AppImage";
  if (name.endsWith(".deb")) return "deb";
  if (name.endsWith(".rpm")) return "rpm";
  return "";
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

interface DownloadModalProps {
  onClose: () => void;
}

export function DownloadModal({ onClose }: DownloadModalProps) {
  const [state, setState] = useState<ReleaseState>({ status: "loading" });
  const closeRef = useRef<HTMLButtonElement>(null);
  const system = detectSystem();

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
  const where = system.arch ? `${system.os} · ${system.arch}` : system.os;
  const statusLine = release
    ? `${release.tag_name} · Estás en ${where} · ${formatDate(release.published_at)}`
    : state.status === "loading"
      ? "Buscando la última versión…"
      : "Sin conexión con GitHub";

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
          <h2 id="download-title">Descargar Kinkel</h2>
        </div>

        <p className="download-status" aria-live="polite">
          {statusLine}
        </p>

        <div className="download-options">
          {PLATFORMS.map((platform) => {
            const primary = pickAsset(release, platform.primaryExtensions);
            const alternates = platform.alternateExtensions
              .map((extension) => pickAsset(release, [extension]))
              .filter((asset): asset is ReleaseAsset => Boolean(asset));
            const active = platform.id === system.id;

            return (
              <div
                key={platform.id}
                className={`download-option${active ? " download-option--active" : ""}`}
              >
                <span className={`download-os download-os--${platform.id}`}>
                  {platformIcon(platform.id)}
                </span>
                <strong className="download-name">{platform.name}</strong>
                <small className="download-detail">{platform.detail}</small>

                <a
                  className="download-cta"
                  href={primary?.browser_download_url ?? releasesUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={primary?.name ?? "Abrir GitHub Releases"}
                >
                  {primary
                    ? `Descargar ${formatLabel(primary)}${formatSize(primary.size) ? ` · ${formatSize(primary.size)}` : ""}`
                    : state.status === "loading"
                      ? "Buscando…"
                      : "Descargar desde GitHub"}
                  <DownloadIcon size={16} />
                </a>

                {alternates.length > 0 ? (
                  <div className="download-alts">
                    <span>También en</span>
                    {alternates.map((asset) => (
                      <a
                        key={asset.name}
                        href={asset.browser_download_url}
                        target="_blank"
                        rel="noreferrer"
                        title={asset.name}
                      >
                        {formatLabel(asset)}
                        {formatSize(asset.size)
                          ? ` · ${formatSize(asset.size)}`
                          : ""}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="download-footer">
          ¿No ves tu sistema?{" "}
          <a href={releasesUrl} target="_blank" rel="noreferrer">
            Mira todas las versiones en GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
