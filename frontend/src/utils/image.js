function loadImageFromFile(file) {
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

function getTargetSize(image, maxSize) {
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

function buildOutputName(file, outputType) {
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  if (outputType === "image/png") {
    return `${baseName || "image"}.png`;
  }
  return `${baseName || "image"}.jpg`;
}

export async function resizeImageFile(file, maxSize = 1600, quality = 0.85) {
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
  const blob = await new Promise((resolve) => {
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

export async function resizeImageToDataUrl(file, maxSize = 256, quality = 0.8) {
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
