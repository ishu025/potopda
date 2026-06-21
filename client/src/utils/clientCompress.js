// Compresses an image in the browser before it's ever sent over the
// network — smaller upload, faster on slow connections. The server
// compresses again on arrival (Sharp) as the authoritative pass, so if
// this fails for any reason (old browser, unusual file), the original
// file is just sent as-is and the server handles it instead.
export function compressImageInBrowser(file, { maxDimension, quality, square }) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document.createElement('canvas').getContext) {
      reject(new Error('Canvas not supported in this browser'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;

      if (square) {
        const side = Math.min(sw, sh);
        sx = Math.round((sw - side) / 2);
        sy = Math.round((sh - side) / 2);
        sw = side;
        sh = side;
      }

      let dw = sw;
      let dh = sh;
      if (dw > maxDimension || dh > maxDimension) {
        if (dw >= dh) {
          dh = Math.round((dh * maxDimension) / dw);
          dw = maxDimension;
        } else {
          dw = Math.round((dw * maxDimension) / dh);
          dh = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression produced no output'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image for compression'));
    };

    img.src = objectUrl;
  });
}
