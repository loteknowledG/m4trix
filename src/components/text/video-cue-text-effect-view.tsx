'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BlurText } from '@/components/text/blur-text';import { BouncingText } from '@/components/text/bouncing-text';
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
  resolveActiveTextEffects,
  videoCueTextEffectsKey,
  type VideoCueTextAnimatePreset,
  type VideoCueTextEffect,
} from '@/lib/video-cue-text-effects';
import { cn } from '@/lib/utils';

export type VideoCueTextEffectViewProps = {
  text: string;
  effect?: VideoCueTextEffect | VideoCueTextEffect[] | string | null;
  effects?: VideoCueTextEffect | VideoCueTextEffect[] | string | null;
  color?: string;
  shadowColor?: string;
  className?: string;
  lineKey?: string;
  replayKey?: string;
  animated?: boolean;
};

function wrapOuterTextEffect(
  effect: VideoCueTextEffect,
  content: ReactNode,
  text: string,
  props: VideoCueTextEffectViewProps,
): ReactNode {
  const {
    color = '#ffffff',
    shadowColor = '#000000',
    className,
    lineKey = 'line',
    replayKey,
    animated = true,
  } = props;
  const animationKey = `${replayKey ?? lineKey}-wrap-${effect}`;
  const wrappedClass = cn('inline text-[length:inherit] font-[inherit]', className);

  if (!animated) {
    return <span className={wrappedClass}>{content}</span>;
  }

  switch (effect) {
    case 'breathingText':
      return (
        <motion.span
          key={animationKey}
          className={wrappedClass}
          animate={{ scale: [1, 1.05, 1], opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {content}
        </motion.span>
      );
    case 'shimmeringText':
      return (
        <span
          key={animationKey}
          className={cn(
            'inline-block bg-[length:200%_100%] bg-clip-text text-transparent animate-dialog-shimmer',
            'bg-gradient-to-r from-current via-white/95 to-current',
            wrappedClass,
          )}
        >
          {content}
        </span>
      );
    case 'gradientText':
      return (
        <span
          key={animationKey}
          className={cn(
            'inline-block bg-[length:200%_auto] bg-clip-text text-transparent animate-dialog-gradient',
            'bg-gradient-to-r from-sky-300 via-fuchsia-300 to-lime-300',
            wrappedClass,
          )}
        >
          {content}
        </span>
      );
    case 'lineShadowText':
      return (
        <LineShadowText key={animationKey} shadowColor={shadowColor} as="span" className={wrappedClass}>
          {text}
        </LineShadowText>
      );
    case 'sparklesText':
      return (
        <SparklesText
          key={animationKey}
          colors={{ first: color, second: shadowColor }}
          sparklesCount={8}
          className={cn('inline text-[length:inherit] font-[inherit] font-normal', className)}
        >
          {text}
        </SparklesText>
      );
    case 'spinningText':
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
          {text}
        </SpinningText>
      );
    case 'fadeIn':
    case 'blurIn':
    case 'blurInUp':
    case 'blurInDown':
    case 'slideUp':
    case 'slideDown':
    case 'slideLeft':
    case 'slideRight':
    case 'scaleUp':
    case 'scaleDown':
      return (
        <TextAnimate
          key={animationKey}
          animation={effect as VideoCueTextAnimatePreset}
          by="word"
          startOnView={false}
          once
          as="span"
          className={cn('inline', className)}
          segmentClassName="whitespace-nowrap"
        >
          {text}
        </TextAnimate>
      );
    default:
      return <span className={wrappedClass}>{content}</span>;
  }
}

function VideoCueTextEffectSingle({
  text,
  effect,
  color = '#ffffff',
  shadowColor = '#000000',
  className,
  lineKey = 'line',
  replayKey,
  animated = true,
}: VideoCueTextEffectViewProps & { effect: VideoCueTextEffect }) {
  const textEffect = normalizeVideoCueTextEffect(effect);
  const animationKey = replayKey ?? lineKey;
  const displayText = !text || !text.trim() ? '…' : text;
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
      <TextGenerateEffect key={animationKey} className={cn('inline', className)}>
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

export function VideoCueTextEffectView({
  text,
  effect,
  effects,
  className,
  ...rest
}: VideoCueTextEffectViewProps) {
  const activeEffects = resolveActiveTextEffects(effects ?? effect);
  const displayText = !text || !text.trim() ? '…' : text;

  if (activeEffects.length === 0) {
    return (
      <span className={cn(CUE_TEXT_WRAP_CLASS, 'whitespace-pre-wrap', className)}>{displayText}</span>
    );
  }

  if (activeEffects.length === 1) {
    return (
      <VideoCueTextEffectSingle
        text={displayText}
        effect={activeEffects[0]}
        className={className}
        {...rest}
      />
    );
  }

  const stackKey = videoCueTextEffectsKey(activeEffects);
  let node: ReactNode = (
    <VideoCueTextEffectSingle
      key={`${stackKey}-inner`}
      text={displayText}
      effect={activeEffects[activeEffects.length - 1]}
      className={className}
      {...rest}
    />
  );

  for (let index = activeEffects.length - 2; index >= 0; index -= 1) {
    const currentEffect = activeEffects[index];
    node = wrapOuterTextEffect(
      currentEffect,
      node,
      displayText,
      { text: displayText, className, ...rest },
    );
  }

  return <span className={cn('inline', className)}>{node}</span>;
}
