import Box from "@mui/material/Box";
import { useEffect, useRef } from "react";

// API nativa (Chrome/Android). Não está na lib do TypeScript.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/** Usa a API nativa quando existe; no iPhone (WebKit) e no Chrome desktop do Windows, carrega o leitor zxing-wasm do próprio app. */
async function loadDetector(): Promise<BarcodeDetectorCtor> {
  const native = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (native) return native;
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
  });
  return BarcodeDetector as unknown as BarcodeDetectorCtor;
}

export const canUseCamera = () => Boolean(navigator.mediaDevices?.getUserMedia);

interface Props {
  onCode: (raw: string) => void;
  onError: (message: string) => void;
}

/**
 * Lê códigos enquanto estiver montado. O mesmo código só dispara de novo depois de sair
 * do quadro por 2,5 s, para a leitura contínua não repetir a etiqueta parada na frente da câmera.
 */
export default function QrCameraScanner({ onCode, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onCode, onError });
  useEffect(() => {
    handlers.current = { onCode, onError };
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let busy = false;
    const last = { value: "", at: 0 };

    Promise.all([loadDetector(), navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })])
      .then(([Ctor, media]) => {
        stream = media;
        if (stopped || !videoRef.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        const detector = new Ctor({ formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"] });
        videoRef.current.srcObject = media;
        void videoRef.current.play();
        timer = window.setInterval(async () => {
          if (busy || !videoRef.current || videoRef.current.readyState < 2) return;
          busy = true;
          const [first] = await detector.detect(videoRef.current).catch(() => []);
          busy = false;
          const value = first?.rawValue;
          if (!value || stopped) return;
          const now = Date.now();
          const repeated = value === last.value && now - last.at < 2500;
          last.value = value;
          last.at = now;
          if (!repeated) handlers.current.onCode(value);
        }, 400);
      })
      .catch(() => handlers.current.onError("Não foi possível abrir a câmera. Verifique a permissão do navegador ou digite o código."));

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return <Box component="video" ref={videoRef} muted playsInline sx={{ width: "100%", maxHeight: 360, bgcolor: "common.black", borderRadius: 2 }} />;
}
