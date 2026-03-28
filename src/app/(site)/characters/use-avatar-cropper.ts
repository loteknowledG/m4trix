import { useState } from 'react';
import { toast } from 'sonner';
import { cropAvatarFromImage } from './crop-image';

export type AvatarCropTarget = string | 'user';

type AgentLike = {
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
};

type UseAvatarCropperArgs<TAgent extends AgentLike> = {
  updateAgent: (id: string, updates: Partial<Pick<TAgent, 'avatarUrl' | 'avatarCrop'>>) => void;
  updatePrompterAgent: (
    updates: Partial<Pick<TAgent, 'avatarUrl' | 'avatarCrop'>>
  ) => void;
};

export function useAvatarCropper<TAgent extends AgentLike>({
  updateAgent,
  updatePrompterAgent,
}: UseAvatarCropperArgs<TAgent>) {
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingTarget, setCroppingTarget] = useState<AvatarCropTarget | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [isGif, setIsGif] = useState(false);
  const [isHoveringEdge, setIsHoveringEdge] = useState(false);

  function clearCropper() {
    setCroppingImage(null);
    setCroppingTarget(null);
    setCrop({ x: 0, y: 0, zoom: 1 });
    setIsGif(false);
    setIsHoveringEdge(false);
  }

  function handleAvatarUpload(file: File, id: AvatarCropTarget) {
    if (!file.type.startsWith('image/')) {
      toast.error('File is not an image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setCroppingImage(result);
      setCroppingTarget(id);
      setCrop({ x: 0, y: 0, zoom: 1 });
      setIsGif(file.type === 'image/gif');
    };
    reader.readAsDataURL(file);
  }

  function applyGifImmediately() {
    if (!croppingImage || !croppingTarget) return;

    if (croppingTarget === 'user') {
      updatePrompterAgent({ avatarUrl: croppingImage });
    } else {
      updateAgent(croppingTarget, { avatarUrl: croppingImage });
    }

    clearCropper();
  }

  async function handleApplyCrop() {
    if (!croppingImage || !croppingTarget) return;

    if (isGif) {
      if (croppingTarget === 'user') {
        updatePrompterAgent({ avatarUrl: croppingImage, avatarCrop: { ...crop } });
      } else {
        updateAgent(croppingTarget, { avatarUrl: croppingImage, avatarCrop: { ...crop } });
      }
      clearCropper();
      toast.success('Animated crop applied!');
      return;
    }

    const croppedDataUrl = await cropAvatarFromImage(croppingImage, crop);
    if (croppingTarget === 'user') {
      updatePrompterAgent({ avatarUrl: croppedDataUrl, avatarCrop: undefined });
    } else {
      updateAgent(croppingTarget, { avatarUrl: croppedDataUrl, avatarCrop: undefined });
    }

    clearCropper();
  }

  return {
    applyGifImmediately,
    clearCropper,
    crop,
    croppingImage,
    croppingTarget,
    handleApplyCrop,
    handleAvatarUpload,
    isGif,
    isHoveringEdge,
    setCrop,
    setIsHoveringEdge,
  };
}
