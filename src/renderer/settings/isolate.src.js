// Subject isolation (background removal) for custom craft images.
//
// Bundled by esbuild into isolate.bundle.js (the app ships raw <script> files,
// so this is the one module that needs a build step). The ML model + WASM are
// fetched from @imgly's CDN on first use and cached by the browser, so there's
// no installer bloat and it works offline after the first run.
//
// Phase 1: static images (PNG/JPG/WebP) → transparent PNG cut-out.
// Phase 2 (todo): animated GIF → per-frame cut-out re-encoded as transparent
// APNG. For now GIFs are passed through unchanged so the feature degrades
// gracefully instead of failing.
import { removeBackground } from '@imgly/background-removal';

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// isolate(dataUrl, onProgress) -> { dataUrl, isolated, animated }
// onProgress(fraction 0..1, label) is called as the model downloads/runs.
async function isolate(srcDataUrl, onProgress) {
  const srcBlob = await (await fetch(srcDataUrl)).blob();

  // Animated GIFs are the hard case (per-frame). Until phase 2, keep them as-is.
  if (srcBlob.type === 'image/gif') {
    return { dataUrl: srcDataUrl, isolated: false, animated: true };
  }

  const report = (key, current, total) => {
    if (!onProgress) return;
    const frac = total ? current / total : 0;
    onProgress(frac, key && key.startsWith('fetch') ? 'Downloading model…' : 'Isolating subject…');
  };

  const cut = await removeBackground(srcBlob, {
    progress: report,
    output: { format: 'image/png' }, // PNG preserves the alpha cut-out
  });
  return { dataUrl: await blobToDataURL(cut), isolated: true, animated: false };
}

window.AirplaneIsolate = { isolate };
