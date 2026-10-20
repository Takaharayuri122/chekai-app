'use client';

import { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Loader2 } from 'lucide-react';
import { getCroppedLogoBlob, LOGO_ASPECT, AreaPixels } from '@/lib/crop-image';
import { FormModal } from './form-modal';

interface LogoCropperModalProps {
  open: boolean;
  onClose: () => void;
  imageSource: string;
  onConfirm: (blob: Blob) => void | Promise<void>;
  title?: string;
}

/**
 * Modal para recortar a logo do cliente em formato quadrado.
 * Permite posicionar e dar zoom na imagem antes de aplicar.
 */
export function LogoCropperModal({
  open,
  onClose,
  imageSource,
  onConfirm,
  title = 'Ajustar imagem da logo',
}: LogoCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<AreaPixels | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, pixels: AreaPixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const blob = await getCroppedLogoBlob(imageSource, croppedAreaPixels);
      await onConfirm(blob);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [imageSource, croppedAreaPixels, onConfirm, onClose]);

  const footerContent = (
    <>
      <button type="button" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted" onClick={onClose} disabled={loading}>
        Cancelar
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={handleConfirm}
        disabled={loading || !croppedAreaPixels}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Aplicando...
          </>
        ) : (
          'Aplicar'
        )}
      </button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="2xl"
      isDirty={zoom !== 1 || crop.x !== 0 || crop.y !== 0}
      footer={footerContent}
    >
      <p className="text-sm text-muted-foreground mb-4">
        Arraste e use o zoom para enquadrar. A logo será recortada em formato quadrado para o relatório.
      </p>
      <style>{`
        .logo-cropper-wrap .reactEasyCrop_CropAreaGrid::before,
        .logo-cropper-wrap .reactEasyCrop_CropAreaGrid::after {
          border-color: rgba(107, 114, 128, 0.7);
        }
      `}</style>
      <div className="logo-cropper-wrap relative w-full h-[280px] bg-muted rounded-lg overflow-hidden">
        <Cropper
          image={imageSource}
          crop={crop}
          zoom={zoom}
          aspect={LOGO_ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
          showGrid
        />
      </div>
      <div className="mt-4">
        <label className="flex items-center gap-3">
          <span className="text-sm font-medium min-w-[3rem]">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full cursor-pointer accent-[hsl(175_100%_36%)] range-primary flex-1"
          />
        </label>
      </div>
    </FormModal>
  );
}
