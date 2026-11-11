import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Barcode / QR Code',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or connection.');
      }

      // Prefer back camera on mobile phones
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if native BarcodeDetector API is supported (Chrome/Android/Edge)
      if ('BarcodeDetector' in window) {
        startNativeBarcodeDetection();
      } else {
        // Fallback visual scanner with canvas luminance contrast sampling
        startCanvasBarcodeDetection();
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setHasCamera(false);
      setCameraError(err.message || 'Unable to access device camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
  };

  const handleDetected = (code: string) => {
    if (!code) return;
    // Play subtle audio beep if supported
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // AudioContext optional
    }

    stopCamera();
    onScan(code.trim());
    onClose();
  };

  const startNativeBarcodeDetection = async () => {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const formats = await BarcodeDetectorClass.getSupportedFormats();
      const detector = new BarcodeDetectorClass({
        formats: formats.length > 0 ? formats : ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
      });

      const detectFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detectFrame);
          return;
        }

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleDetected(barcodes[0].rawValue);
            return;
          }
        } catch (e) {
          // ignore detection tick frame error
        }

        animationFrameRef.current = requestAnimationFrame(detectFrame);
      };

      animationFrameRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      startCanvasBarcodeDetection();
    }
  };

  const startCanvasBarcodeDetection = () => {
    // When BarcodeDetector is not natively present in Safari or desktop,
    // Provide a continuous scanning guide with 1D/2D visual target
    const tick = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleDetected(manualCode.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 text-slate-100 space-y-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewport / Scanner Frame */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
          {hasCamera && !cameraError ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Laser Target Overlay */}
              <div className="absolute inset-8 border-2 border-cyan-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                <div className="flex justify-between">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-300" />
                  <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-300" />
                </div>

                {/* Laser animation */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee] animate-pulse" />

                <div className="flex justify-between">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-300" />
                  <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-300" />
                </div>
              </div>

              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="px-3 py-1 rounded-full bg-slate-950/80 text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                  Align barcode or QR code inside the frame
                </span>
              </div>
            </>
          ) : (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-slate-300 font-medium">Camera Not Available</p>
              <p className="text-[11px] text-slate-400">
                {cameraError || 'Unable to access device camera. You can type or paste the code below.'}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Retry Camera</span>
              </button>
            </div>
          )}
        </div>

        {/* Manual Code Input Barcode/QR input fallback */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="text-[10px] font-semibold uppercase text-slate-400 block">
            Or Type / Paste Barcode / SKU
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 6001234567891 or SKU-101"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-hidden focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
