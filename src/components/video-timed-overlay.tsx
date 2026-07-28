'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { BlurText } from '@/components/text/blur-text';
import { BouncingText } from '@/components/text/bouncing-text';
import { EmbossText } from '@/components/text/emboss-text';
import { DriftText } from '@/components/text/drift-text';
import { EchoText } from '@/components/text/echo-text';
import { LiquidText } from '@/components/text/liquid-text';
import { PaperCutText } from '@/components/text/paper-cut-text';
import { PopText } from '@/components/text/pop-text';
import { WaveText } from '@/components/text/wave-text';
import { WaveformText } from '@/components/text/waveform-text';
import { BreathingText } from '@/components/text/breathing-text';
import { GradientText } from '@/components/text/gradient-text';
import { ShimmeringText } from '@/components/text/shimmering-text';
import { TextGenerateEffect } from '@/components/text/text-generate-effect';
import { TypingText } from '@/components/text/typing-text';
import { WobbleText } from '@/components/text/wobble-text';
import ColourfulText from '@/components/ui/colourful-text';
import { FlipWords } from '@/components/ui/flip-words';
import { TextAnimate } from '@/components/ui/text-animate';
import { HyperText } from '@/components/ui/hyper-text';
import { LineShadowText } from '@/components/ui/line-shadow-text';
import { MorphingText } from '@/components/ui/morphing-text';
import { SparklesText } from '@/components/ui/sparkles-text';
import { SpinningText } from '@/components/ui/spinning-text';
import { TypingAnimation } from '@/components/ui/typing-animation';
import { WordRotate } from '@/components/ui/word-rotate';
import {
  buildCueTextShadow,
  getActiveCues,
  resolveVideoCueFontFamily,
  type VideoCueTextAnimatePreset,
  type VideoTimedCue,
} from '@/lib/video-timed-cues';
import { cueWordRotateWords, normalizeVideoCueTextEffect } from '@/lib/video-cue-text-effects';
import { CUE_TEXT_WRAP_CLASS, CueTextByWords } from '@/lib/cue-text-word-wrap';
import { cn } from '@/lib/utils';

type CueLayoutPatch = Partial<Pick<VideoTimedCue, 'x' | 'y' | 'width' | 'fontScale'>>;

type VideoTimedOverlayProps = {
  cues: VideoTimedCue[];
  currentTime: number;
  className?: string;
  editCueId?: string | null;
  onCueLayoutChange?: (cueId: string, patch: CueLayoutPatch) => void;
};

type CueLayout = {
  x: number;
  y: number;
  width: number;
  fontScale: number;
};

function cueFontSize(fontScale: number) {
  return `clamp(0.65rem, ${fontScale * 100}cqmin, 999px)`;
}

function VideoCueBubbleContent({
  cue,
  animated = true,
}: {
  cue: VideoTimedCue;
  animated?: boolean;
}) {
  const textColor = cue.color ?? '#ffffff';
  const speakerColor = cue.speakerColor ?? textColor;
  const textShadow = buildCueTextShadow(cue.shadowColor ?? '#000000');
  const text = cue.text.trim() || '…';
  const textEffect = normalizeVideoCueTextEffect(cue.textEffect);

  return (
    <>
      {cue.speaker?.trim() ? (
        <div
          className={cn(
            'mb-1 text-[0.85em] font-bold uppercase tracking-wide',
            CUE_TEXT_WRAP_CLASS,
          )}
          style={{ color: speakerColor, textShadow }}
        >
          {cue.speaker.trim()}
        </div>
      ) : null}
      <div className={CUE_TEXT_WRAP_CLASS} style={{ color: textColor, textShadow }}>
        {textEffect === 'lineShadowText' ? (
          <LineShadowText
            key={cue.id}
            shadowColor={cue.shadowColor ?? '#000000'}
            as="span"
            className="inline text-[length:inherit] font-[inherit]"
          >
            {text}
          </LineShadowText>
        ) : textEffect === 'sparklesText' ? (
          <SparklesText
            key={cue.id}
            colors={{ first: textColor, second: cue.shadowColor ?? '#ffffff' }}
            sparklesCount={8}
            className="inline text-[length:inherit] font-[inherit] font-normal"
          >
            {text}
          </SparklesText>
        ) : textEffect === 'spinningText' ? (
          <SpinningText
            key={cue.id}
            radius={2.5}
            duration={10}
            className="inline-flex min-h-[5ch] min-w-[5ch] items-center justify-center text-[length:inherit] font-[inherit]"
            style={{ color: textColor }}
          >
            {text}
          </SpinningText>
        ) : textEffect === 'gradientText' ? (
          <GradientText key={cue.id} className="text-[length:inherit] font-[inherit]">
            {text}
          </GradientText>
        ) : textEffect === 'shimmeringText' ? (
          <ShimmeringText key={cue.id} className="text-[length:inherit] font-[inherit]">
            {text}
          </ShimmeringText>
        ) : textEffect === 'colourfulText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <ColourfulText text={word} />}
          </CueTextByWords>
        ) : textEffect === 'breathingText' ? (
          <BreathingText key={cue.id} className="text-[length:inherit] font-[inherit]">
            {text}
          </BreathingText>
        ) : textEffect === 'embossText' ? (
          <EmbossText
            key={cue.id}
            className="text-[length:inherit] font-[inherit]"
            highlightColor="rgba(255, 255, 255, 0.45)"
            shadowColor={cue.shadowColor ?? 'rgba(0, 0, 0, 0.65)'}
          >
            {text}
          </EmbossText>
        ) : textEffect === 'echoText' ? (
          <EchoText key={cue.id} text={text} className="text-[length:inherit] font-[inherit]" />
        ) : textEffect === 'driftText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <DriftText text={word} className="inline" />}
          </CueTextByWords>
        ) : textEffect === 'paperCutText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => (
              <PaperCutText
                text={word}
                color={textColor}
                shadowColor={cue.shadowColor ?? 'rgba(0, 0, 0, 0.65)'}
                className="inline"
              />
            )}
          </CueTextByWords>
        ) : textEffect === 'liquidText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <LiquidText text={word} className="inline" />}
          </CueTextByWords>
        ) : textEffect === 'waveText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <WaveText text={word} className="inline" />}
          </CueTextByWords>
        ) : textEffect === 'waveformText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <WaveformText text={word} className="inline" />}
          </CueTextByWords>
        ) : textEffect === 'wobbleText' ? (
          <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
            {word => <WobbleText text={word} className="inline" />}
          </CueTextByWords>
        ) : animated && textEffect !== 'none' ? (
          textEffect === 'typing' ? (
            <TypingAnimation key={cue.id} startOnView={false} loop={false} className="inline">
              {text}
            </TypingAnimation>
          ) : textEffect === 'wordRotate' ? (
            <WordRotate
              key={cue.id}
              words={cueWordRotateWords(text)}
              containerClassName="py-0"
              className="inline-block text-[length:inherit] font-[inherit] leading-snug"
            />
          ) : textEffect === 'hyperText' ? (
            <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
              {word => (
                <HyperText
                  startOnView={false}
                  animateOnHover={false}
                  as="span"
                  className="inline py-0 text-[length:inherit] font-[inherit]"
                >
                  {word}
                </HyperText>
              )}
            </CueTextByWords>
          ) : textEffect === 'morphingText' ? (
            <MorphingText
              key={cue.id}
              texts={cueWordRotateWords(text)}
              className="relative mx-0 h-auto min-h-[1.2em] w-full max-w-none text-[length:inherit] font-[inherit] font-normal leading-snug lg:text-[length:inherit]"
            />
          ) : textEffect === 'blurText' ? (
            <BlurText
              key={cue.id}
              text={text}
              className="inline"
              animateBy="words"
              segmentClassName="whitespace-nowrap"
            />
          ) : textEffect === 'flipWords' ? (
            <FlipWords
              key={cue.id}
              words={cueWordRotateWords(text)}
              duration={2500}
              className="relative inline-block px-0 text-[length:inherit] font-[inherit] text-inherit dark:text-inherit"
            />
          ) : textEffect === 'textGenerate' ? (
            <TextGenerateEffect key={cue.id} className="inline" wordClassName="whitespace-nowrap">
              {text}
            </TextGenerateEffect>
          ) : textEffect === 'bouncingText' ? (
            <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
              {word => <BouncingText text={word} className="inline" />}
            </CueTextByWords>
          ) : textEffect === 'popText' ? (
            <CueTextByWords key={cue.id} text={text} className="text-[length:inherit] font-[inherit]">
              {word => (
                <PopText
                  text={word}
                  burstColor={textColor}
                  className="inline text-[length:inherit] font-[inherit]"
                />
              )}
            </CueTextByWords>
          ) : textEffect === 'typingText' ? (
            <TypingText key={cue.id} text={text} className="text-[length:inherit] font-[inherit]" />
          ) : (
            <TextAnimate
              key={cue.id}
              animation={textEffect as VideoCueTextAnimatePreset}
              by="word"
              startOnView={false}
              once
              as="span"
              className="inline"
              segmentClassName="whitespace-nowrap"
            >
              {text}
            </TextAnimate>
          )
        ) : (
          text
        )}
      </div>
    </>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cueToLayout(cue: VideoTimedCue): CueLayout {
  return {
    x: cue.x,
    y: cue.y,
    width: cue.width ?? 0.72,
    fontScale: cue.fontScale ?? 0.04,
  };
}

function VideoCueBubble({
  cue,
  editable = false,
  stageRef,
  onLayoutChange,
}: {
  cue: VideoTimedCue;
  editable?: boolean;
  stageRef?: RefObject<HTMLElement | null>;
  onLayoutChange?: (patch: CueLayoutPatch) => void;
}) {
  const layoutRef = useRef(cueToLayout(cue));
  const interactingRef = useRef(false);
  const [layout, setLayout] = useState(layoutRef.current);

  useEffect(() => {
    if (interactingRef.current) return;
    const next = cueToLayout(cue);
    layoutRef.current = next;
    setLayout(next);
  }, [cue.id, cue.x, cue.y, cue.width, cue.fontScale]);

  const applyLayout = useCallback((next: CueLayout) => {
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const onStartDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editable || !stageRef?.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const stage = stageRef.current;

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        applyLayout({
          ...layoutRef.current,
          x: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
          y: clamp((ev.clientY - rect.top) / rect.height, 0, 1),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        onLayoutChange?.({ x: layoutRef.current.x, y: layoutRef.current.y });
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, editable, onLayoutChange, stageRef],
  );

  const onStartResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!editable || !stageRef?.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);

      const stage = stageRef.current;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = { ...layoutRef.current };
      const handle = event.currentTarget;

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = (ev.clientX - startX) / rect.width;
        const dy = (ev.clientY - startY) / rect.height;
        applyLayout({
          ...layoutRef.current,
          width: clamp(startLayout.width + dx * 1.4, 0.2, 1),
          fontScale: clamp(startLayout.fontScale + dy * 0.25, 0.02, 0.12),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        onLayoutChange?.({
          width: layoutRef.current.width,
          fontScale: layoutRef.current.fontScale,
        });
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, editable, onLayoutChange, stageRef],
  );

  return (
    <div
      className={cn(
        'absolute min-w-0 max-w-none -translate-x-1/2 -translate-y-1/2 touch-none select-none',
        editable ? 'pointer-events-auto z-30' : 'pointer-events-none z-20',
      )}
      style={{
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        width: `${layout.width * 100}%`,
        fontSize: cueFontSize(layout.fontScale),
        fontFamily: resolveVideoCueFontFamily(cue.font),
      }}
    >
      <div
        className={cn(
          'relative rounded-md',
          editable && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-transparent',
        )}
      >
        {editable ? (
          <div
            role="presentation"
            onPointerDown={onStartDrag}
            className="mb-1 flex cursor-grab items-center justify-center rounded-t-md bg-primary/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground active:cursor-grabbing"
          >
            Drag
          </div>
        ) : null}
        <div className={editable ? 'px-1 pb-1' : undefined}>
          <VideoCueBubbleContent cue={cue} animated={!editable} />
        </div>
        {editable ? (
          <button
            type="button"
            aria-label="Resize dialog"
            onPointerDown={onStartResize}
            className="absolute -bottom-2.5 -right-2.5 z-40 h-5 w-5 cursor-se-resize rounded-sm border-2 border-white bg-primary shadow-md"
          />
        ) : null}
      </div>
    </div>
  );
}

export default function VideoTimedOverlay({
  cues,
  currentTime,
  className,
  editCueId = null,
  onCueLayoutChange,
}: VideoTimedOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const editMode = editCueId != null;
  const [, setFullscreenEpoch] = useState(0);
  const onCueLayoutChangeRef = useRef(onCueLayoutChange);
  onCueLayoutChangeRef.current = onCueLayoutChange;

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreenEpoch(epoch => epoch + 1);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleLayoutChange = useCallback((cueId: string, patch: CueLayoutPatch) => {
    onCueLayoutChangeRef.current?.(cueId, patch);
  }, []);

  const activeCues = useMemo(() => getActiveCues(cues, currentTime), [cues, currentTime]);

  const editingCue = useMemo(
    () => (editCueId ? cues.find(cue => cue.id === editCueId) ?? null : null),
    [cues, editCueId],
  );

  const playbackCues = useMemo(() => {
    if (!editMode) return activeCues;
    return activeCues.filter(cue => cue.id !== editCueId);
  }, [activeCues, editCueId, editMode]);

  if (cues.length === 0 && !editMode) return null;

  return (
    <div
      ref={stageRef}
      className={cn('pointer-events-none absolute inset-0 z-20 [container-type:size]', className)}
      aria-hidden={!editMode}
    >
      {playbackCues.map(cue => (
        <VideoCueBubble key={cue.id} cue={cue} />
      ))}

      {editingCue ? (
        <VideoCueBubble
          key={editingCue.id}
          cue={editingCue}
          editable
          stageRef={stageRef}
          onLayoutChange={patch => handleLayoutChange(editingCue.id, patch)}
        />
      ) : null}

      {editMode ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
            Use the drag bar to move · corner handle to resize
          </span>
        </div>
      ) : null}
    </div>
  );
}
