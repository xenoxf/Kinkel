import { useEffect, useRef } from "react";
import { version } from "../../package.json";
import {
  AppleIcon,
  CloseIcon,
  DownloadIcon,
  LinuxIcon,
  WindowsIcon,
} from "./Icons";

const DOWNLOAD_BASE = `https://github.com/xenoxf/Kinkel/releases/download/v${version}`;

type PlatformId = "macos" | "windows" | "linux";

interface AssetOption {
  label: string;
  file: string;
}

interface Platform {
  id: PlatformId;
  name: string;
  primary: AssetOption;
  alternates: AssetOption[];
}

const PLATFORMS: Platform[] = [
  {
    id: "macos",
    name: "macOS",
    primary: {
      label: "DMG",
      file: `Kinkel_${version}_darwin_universal.dmg`,
    },
    alternates: [],
  },
  {
    id: "windows",
    name: "Windows",
    primary: {
      label: "EXE",
      file: `Kinkel_${version}_windows_x64-setup.exe`,
    },
    alternates: [
      { label: "MSI", file: `Kinkel_${version}_windows_x64.msi` },
    ],
  },
  {
    id: "linux",
    name: "Linux",
    primary: {
      label: "AppImage",
      file: `Kinkel_${version}_linux_amd64.AppImage`,
    },
    alternates: [
      { label: "DEB", file: `Kinkel_${version}_linux_amd64.deb` },
      { label: "RPM", file: `Kinkel_${version}_linux_x86_64.rpm` },
    ],
  },
];

function currentSystem(): PlatformId | "" {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "";
}

const SYSTEM = currentSystem();

function assetUrl(option: AssetOption): string {
  return `${DOWNLOAD_BASE}/${option.file}`;
}

function platformIcon(id: PlatformId) {
  if (id === "macos") return <AppleIcon size={25} />;
  if (id === "windows") return <WindowsIcon size={23} />;
  return <LinuxIcon size={25} />;
}

interface DownloadModalProps {
  onClose: () => void;
}

export function DownloadModal({ onClose }: DownloadModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

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
          <CloseIcon size={18} />
        </button>

        <h2 id="download-title">Descargar Kinkel</h2>

        <div className="download-options">
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              className={`download-option${
                platform.id === SYSTEM ? " download-option--active" : ""
              }`}
            >
              <span className={`download-os download-os--${platform.id}`}>
                {platformIcon(platform.id)}
              </span>
              <strong className="download-name">{platform.name}</strong>

              <a
                className="download-cta"
                href={assetUrl(platform.primary)}
                target="_blank"
                rel="noreferrer"
                title={platform.primary.label}
              >
                Descargar
                <DownloadIcon size={16} />
              </a>

              {platform.alternates.length > 0 ? (
                <div className="download-alts">
                  {platform.alternates.map((option) => (
                    <a
                      key={option.file}
                      href={assetUrl(option)}
                      target="_blank"
                      rel="noreferrer"
                      title={option.label}
                    >
                      {option.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
