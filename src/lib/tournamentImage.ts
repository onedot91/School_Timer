const EXPORT_SCALE = 2;

const readAsDataUrl = async (source: string): Promise<string> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error('TOURNAMENT_IMAGE_UNAVAILABLE');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('TOURNAMENT_IMAGE_UNAVAILABLE'));
    reader.readAsDataURL(blob);
  });
};

const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('TOURNAMENT_IMAGE_RENDER_FAILED'));
  image.src = source;
});

/** 화면의 대진표 SVG를 그대로 PNG로 바꾼다. 프로필 그림은 파일 안에 담아 넣는다. */
export const renderTournamentPng = async (svg: SVGSVGElement): Promise<Blob> => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const inlined = new Map<string, Promise<string>>();
  await Promise.all(Array.from(clone.querySelectorAll('image'), async (image) => {
    const source = image.getAttribute('href');
    if (!source) return;
    if (!inlined.has(source)) inlined.set(source, readAsDataUrl(source));
    image.setAttribute('href', await inlined.get(source)!);
  }));

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * EXPORT_SCALE;
    canvas.height = height * EXPORT_SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('TOURNAMENT_IMAGE_RENDER_FAILED');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('TOURNAMENT_IMAGE_RENDER_FAILED'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
