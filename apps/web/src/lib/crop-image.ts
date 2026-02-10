/**
 * Gera um blob da imagem recortada a partir da área em pixels.
 * Usado pelo cropper de logo (quadrada para o relatório).
 */
export interface AreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LOGO_OUTPUT_SIZE = 400;

/**
 * Logo quadrada por padrão para caber no relatório.
 * Saída 400x400 (2x) para nitidez.
 */
export const LOGO_ASPECT = 1;

export async function getCroppedLogoBlob(
  imageSrc: string,
  crop: AreaPixels,
  outputSize = LOGO_OUTPUT_SIZE,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d não disponível');
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))),
      'image/jpeg',
      0.9,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
