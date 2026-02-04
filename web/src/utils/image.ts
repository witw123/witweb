function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    image.src = url;
  });
}

type TargetSize = {
  width: number;
  height: number;
  scale: number;
};

function getTargetSize(image: HTMLImageElement, maxSize: number): TargetSize {
  const width = image.width;
  const height = image.height;
  const maxDim = Math.max(width, height);
  if (!maxDim || maxDim <= maxSize) {
    return { width, height, scale: 1 };
  }
  const scale = maxSize / maxDim;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    scale,
  };
}

function buildOutputName(file: File, outputType: string) {
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  if (outputType === "image/png") {
    return `${baseName || "image"}.png`;
  }
  return `${baseName || "image"}.jpg`;
}

export async function resizeImageFile(file: File, maxSize: number = 1600, quality: number = 0.85): Promise<File> {
  if (!file || !file.type.startsWith("image/")) {
    return file;
  }
  const image = await loadImageFromFile(file);
  const { width, height, scale } = getTargetSize(image, maxSize);
  if (scale === 1) {
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }
  context.drawImage(image, 0, 0, width, height);
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result || file),
      outputType,
      outputType === "image/jpeg" ? quality : undefined,
    );
  });
  if (!(blob instanceof Blob)) {
    return file;
  }
  return new File([blob], buildOutputName(file, outputType), { type: blob.type });
}

export async function resizeImageToDataUrl(file: File, maxSize: number = 256, quality: number = 0.8): Promise<string> {
  if (!file || !file.type.startsWith("image/")) {
    return "";
  }
  const image = await loadImageFromFile(file);
  const { width, height, scale } = getTargetSize(image, maxSize);
  const canvas = document.createElement("canvas");
  canvas.width = scale === 1 ? image.width : width;
  canvas.height = scale === 1 ? image.height : height;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(outputType, outputType === "image/jpeg" ? quality : undefined);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((result) => resolve(result || new Blob()), type, quality);
  });
}

export async function compressImageFile(
  file: File,
  options?: {
    maxSize?: number;
    maxBytes?: number;
    initialQuality?: number;
    minQuality?: number;
    qualityStep?: number;
  },
): Promise<File> {
  if (!file || !file.type.startsWith("image/")) return file;
  const maxSize = options?.maxSize ?? 1200;
  const maxBytes = options?.maxBytes ?? 900 * 1024;
  const initialQuality = options?.initialQuality ?? 0.82;
  const minQuality = options?.minQuality ?? 0.45;
  const qualityStep = options?.qualityStep ?? 0.08;

  const image = await loadImageFromFile(file);
  let { width, height } = getTargetSize(image, maxSize);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return file;

  const render = (w: number, h: number) => {
    canvas.width = w;
    canvas.height = h;
    context.clearRect(0, 0, w, h);
    context.drawImage(image, 0, 0, w, h);
  };

  render(width, height);
  let quality = initialQuality;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);

  while (blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - qualityStep);
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  while (blob.size > maxBytes && Math.max(width, height) > 640) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    render(width, height);
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob.size > maxBytes && quality > minQuality) {
      quality = Math.max(minQuality, quality - qualityStep);
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
    }
  }

  if (!blob.size) return file;
  const outputName = `${file.name.replace(/\.[^/.]+$/, "") || "image"}.jpg`;
  return new File([blob], outputName, { type: "image/jpeg" });
}
