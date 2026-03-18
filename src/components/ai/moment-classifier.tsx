'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, ImageClassifier } from '@mediapipe/tasks-vision';

export type MomentClassifierProps = {
  imageSrc: string;
  maxTags?: number;
  onAddTags?: (tags: string[]) => void;
};

export default function MomentClassifier({
  imageSrc,
  maxTags = 5,
  onAddTags,
}: MomentClassifierProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const classifierRef = useRef<ImageClassifier | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // If the image is already loaded (cache or preloaded), sync the state.
    if (img.complete && img.naturalWidth > 0) {
      setImageLoaded(true);
      setImageError(null);
    }
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      // Clean up WASM resources when this component unmounts
      classifierRef.current?.close();
      classifierRef.current = null;
    };
  }, []);

  const ensureClassifier = async () => {
    if (classifierRef.current) return classifierRef.current;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    const classifier = await ImageClassifier.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
      },
      runningMode: 'IMAGE',
    });

    classifierRef.current = classifier;
    return classifier;
  };

  const runClassification = async () => {
    setLoading(true);
    setError(null);

    try {
      const img = imgRef.current;
      if (!img) throw new Error('Image element not available');
      if (imageError) throw new Error(imageError);

      // Wait until the image has loaded (or failed) before classifying.
      if (!imageLoaded) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Image load timeout')), 10_000);
          const onLoad = () => {
            clearTimeout(timeout);
            resolve();
          };
          const onError = () => {
            clearTimeout(timeout);
            reject(new Error(imageError ?? 'Failed to load image'));
          };

          img.addEventListener('load', onLoad, { once: true });
          img.addEventListener('error', onError, { once: true });
        });
      }

      const classifier = await ensureClassifier();

      // Ensure we pass a valid bitmap to the classifier to avoid texture/upload issues.
      // Using createImageBitmap tends to be more reliable than passing the raw HTMLImageElement.
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(img as any);
      } catch (bitmapErr) {
        // Fall back if createImageBitmap is not supported or fails
        bitmap = null;
      }

      const input = bitmap ?? (img as any);
      const result = await classifier.classify(input);

      if (bitmap) bitmap.close();

      const categories = result.classifications?.[0]?.categories ?? [];
      const top = categories
        .slice(0, maxTags)
        .map(c => c.categoryName)
        .filter(Boolean) as string[];

      setLabels(top);
      if (onAddTags && top.length) {
        onAddTags(top);
      }
    } catch (err) {
      const message = (err as any)?.message ?? String(err);
      const stack = (err as any)?.stack ? `\n${(err as any).stack}` : '';
      const full = `${message}${stack}`;
      console.error('MomentClassifier error:', full);
      setError(full);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={runClassification}
        disabled={loading || !!imageError}
        className="w-full px-3 py-2 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Classifying…' : 'Suggest tags'}
      </button>

      <div className="text-xs text-white/70">
        This uses a small demo MediaPipe image classifier to suggest tags from the current moment.
      </div>

      {imageError ? (
        <div className="rounded bg-red-500/20 p-2 text-xs text-red-100">{imageError}</div>
      ) : null}

      {error ? (
        <div className="rounded bg-red-500/20 p-2 text-xs text-red-100 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}

      {labels.length ? (
        <div className="flex flex-wrap gap-2">
          {labels.map(label => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-white text-xs"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <img
        ref={imgRef}
        src={imageSrc}
        alt="Moment for classification"
        className="hidden"
        crossOrigin="anonymous"
        onLoad={() => {
          setImageLoaded(true);
          setImageError(null);
        }}
        onError={event => {
          setImageLoaded(false);
          const target = event.target as HTMLImageElement;
          const src = target?.src ?? imageSrc;
          setImageError(`Failed to load image for classification: ${src}`);
        }}
      />
    </div>
  );
}
