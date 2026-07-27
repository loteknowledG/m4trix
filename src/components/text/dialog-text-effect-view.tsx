"use client";

import { BlurText } from "@/components/text/blur-text";
import { GradientText } from "@/components/text/gradient-text";
import { HighlightText } from "@/components/text/highlight-text";
import { ShimmeringText } from "@/components/text/shimmering-text";
import { TextGenerateEffect } from "@/components/text/text-generate-effect";
import { TypewriterText } from "@/components/text/typewriter-text";
import {
  normalizeDialogTextEffect,
  type DialogTextEffect,
} from "@/lib/dialog-text-effects";
import { cn } from "@/lib/utils";

export type DialogTextEffectViewProps = {
  text: string;
  effect?: DialogTextEffect | string | null;
  className?: string;
  lineKey?: string;
  replayKey?: string;
};

export function DialogTextEffectView({
  text,
  effect,
  className,
  lineKey,
  replayKey,
}: DialogTextEffectViewProps) {
  const resolved = normalizeDialogTextEffect(effect);
  const animationKey = replayKey ?? lineKey;

  switch (resolved) {
    case "generate":
      return (
        <TextGenerateEffect key={animationKey} className={className}>
          {text}
        </TextGenerateEffect>
      );
    case "blur":
      return <BlurText key={animationKey} text={text} className={className} />;
    case "shimmer":
      return <ShimmeringText className={className}>{text}</ShimmeringText>;
    case "gradient":
      return <GradientText className={className}>{text}</GradientText>;
    case "highlight":
      return <HighlightText className={className}>{text}</HighlightText>;
    case "typewriter":
      return <TypewriterText key={animationKey} text={text} className={className} />;
    case "none":
      return <span className={cn("whitespace-pre-wrap", className)}>{text}</span>;
    default: {
      const _exhaustive: never = resolved;
      return <span className={cn("whitespace-pre-wrap", className)}>{text}</span>;
    }
  }
}
