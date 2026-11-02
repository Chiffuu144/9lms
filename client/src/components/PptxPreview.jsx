import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../utils/api';

export default function PptxPreview({ url, name }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let viewer;
    const controller = new AbortController();
    setLoading(true);
    setError('');

    const loadPresentation = async () => {
      try {
        const { PPTXViewer } = await import('pptx-viewer');
        if (!active || !containerRef.current) return;
        viewer = new PPTXViewer(containerRef.current, { keyboardNavigation: false });
        const apiPath = url.replace(/^\/api(?=\/)/, '');
        const response = await apiClient.get(apiPath, {
          responseType: 'arraybuffer',
          signal: controller.signal,
        });
        if (!active) return;
        await viewer.load(response.data);
        if (active) setLoading(false);
      } catch (loadError) {
        if (!active || loadError.code === 'ERR_CANCELED') return;
        setError(loadError.message || `Unable to preview ${name}.`);
        setLoading(false);
      }
    };

    loadPresentation();
    return () => {
      active = false;
      controller.abort();
      viewer?.destroy();
    };
  }, [name, url]);

  return (
    <div className="relative min-h-[min(70vh,720px)] w-full bg-slate-900">
      <div ref={containerRef} className="min-h-[min(70vh,720px)] w-full"/>
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6 text-center text-white" role="status">Loading presentation preview...</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/95 p-6 text-center text-white" role="alert">Could not preview this presentation: {error}</div>}
    </div>
  );
}
