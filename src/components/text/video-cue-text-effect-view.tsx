'use client';

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
import { CUE_TEXT_WRAP_CLASS, CueTextByWords } from '@/lib/cue-text-word-wrap';
import {
  cueWordRotateWords,
  normalizeVideoCueTextEffect,
  type VideoCueTextAnimatePreset,
  type VideoCueTextEffect,
} from '@/lib/video-cue-text-effects';
import { cn } from '@/lib/utils';

export type VideoCueTextEffectViewProps = {
  text: string;
  effect?: VideoCueTextEffect | string | null;
  color?: string;
  shadowColor?: string;
  className?: string;
  lineKey?: string;
  replayKey?: string;
  animated?: boolean;
};

export function VideoCueTextEffectView({
  text,
  effect,
  color = '#ffffff',
  shadowColor = '#000000',
  className,
  lineKey = 'line',
  replayKey,
  animated = true,
}: VideoCueTextEffectViewProps) {
  const textEffect = normalizeVideoCueTextEffect(effect);
  const animationKey = replayKey ?? lineKey;
  const displayText = text.trim() || '…';

  if (textEffect === 'lineShadowText') {
    return (
      <LineShadowText
        key={animationKey}
        shadowColor={shadowColor}
        as="span"
        className={cn('inline text-[length:inherit] font-[inherit]', className)}
      >
        {displayText}
      </LineShadowText>
    );
  }

  if (textEffect === 'sparklesText') {
    return (
      <SparklesText
        key={animationKey}
        colors={{ first: color, second: shadowColor }}
        sparklesCount={8}
        className={cn('inline text-[length:inherit] font-[inherit] font-normal', className)}
      >
        {displayText}
      </SparklesText>
    );
  }

  if (textEffect === 'spinningText') {
    return (
      <SpinningText
        key={animationKey}
        radius={2.5}
        duration={10}
        className={cn(
          'inline-flex min-h-[5ch] min-w-[5ch] items-center justify-center text-[length:inherit] font-[inherit]',
          className,
        )}
        style={{ color }}
      >
        {displayText}
      </SpinningText>
    );
  }

  if (textEffect === 'gradientText') {
    return (
      <GradientText key={animationKey} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {displayText}
      </GradientText>
    );
  }

  if (textEffect === 'shimmeringText') {
    return (
      <ShimmeringText key={animationKey} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {displayText}
      </ShimmeringText>
    );
  }

  if (textEffect === 'colourfulText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <ColourfulText text={word} />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'breathingText') {
    return (
      <BreathingText key={animationKey} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {displayText}
      </BreathingText>
    );
  }

  if (textEffect === 'embossText') {
    return (
      <EmbossText
        key={animationKey}
        className={cn('text-[length:inherit] font-[inherit]', className)}
        highlightColor="rgba(255, 255, 255, 0.45)"
        shadowColor={shadowColor || 'rgba(0, 0, 0, 0.65)'}
      >
        {displayText}
      </EmbossText>
    );
  }

  if (textEffect === 'echoText') {
    return (
      <EchoText key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)} />
    );
  }

  if (textEffect === 'driftText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <DriftText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'paperCutText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => (
          <PaperCutText
            text={word}
            color={color}
            shadowColor={shadowColor || 'rgba(0, 0, 0, 0.65)'}
            className="inline"
          />
        )}
      </CueTextByWords>
    );
  }

  if (textEffect === 'liquidText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <LiquidText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'waveText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <WaveText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'waveformText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <WaveformText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'wobbleText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <WobbleText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (!animated || textEffect === 'none') {
    return <span className={cn(CUE_TEXT_WRAP_CLASS, 'whitespace-pre-wrap', className)}>{displayText}</span>;
  }

  if (textEffect === 'typing') {
    return (
      <TypingAnimation key={animationKey} startOnView={false} loop={false} className={cn('inline', className)}>
        {displayText}
      </TypingAnimation>
    );
  }

  if (textEffect === 'wordRotate') {
    return (
      <WordRotate
        key={animationKey}
        words={cueWordRotateWords(displayText)}
        containerClassName="py-0"
        className={cn('inline-block text-[length:inherit] font-[inherit] leading-snug', className)}
      />
    );
  }

  if (textEffect === 'hyperText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
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
    );
  }

  if (textEffect === 'morphingText') {
    return (
      <MorphingText
        key={animationKey}
        texts={cueWordRotateWords(displayText)}
        className={cn(
          'relative mx-0 h-auto min-h-[1.2em] w-full max-w-none text-[length:inherit] font-[inherit] font-normal leading-snug lg:text-[length:inherit]',
          className,
        )}
      />
    );
  }

  if (textEffect === 'blurText') {
    return (
      <BlurText
        key={animationKey}
        text={displayText}
        className={cn('inline', className)}
        animateBy="words"
        segmentClassName="whitespace-nowrap"
      />
    );
  }

  if (textEffect === 'flipWords') {
    return (
      <FlipWords
        key={animationKey}
        words={cueWordRotateWords(displayText)}
        duration={2500}
        className={cn(
          'relative inline-block px-0 text-[length:inherit] font-[inherit] text-inherit dark:text-inherit',
          className,
        )}
      />
    );
  }

  if (textEffect === 'textGenerate') {
    return (
      <TextGenerateEffect key={animationKey} className={cn('inline', className)} wordClassName="whitespace-nowrap">
        {displayText}
      </TextGenerateEffect>
    );
  }

  if (textEffect === 'bouncingText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => <BouncingText text={word} className="inline" />}
      </CueTextByWords>
    );
  }

  if (textEffect === 'popText') {
    return (
      <CueTextByWords key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)}>
        {word => (
          <PopText text={word} burstColor={color} className="inline text-[length:inherit] font-[inherit]" />
        )}
      </CueTextByWords>
    );
  }

  if (textEffect === 'typingText') {
    return (
      <TypingText key={animationKey} text={displayText} className={cn('text-[length:inherit] font-[inherit]', className)} />
    );
  }

  return (
    <TextAnimate
      key={animationKey}
      animation={textEffect as VideoCueTextAnimatePreset}
      by="word"
      startOnView={false}
      once
      as="span"
      className={cn('inline', className)}
      segmentClassName="whitespace-nowrap"
    >
      {displayText}
    </TextAnimate>
  );
}
