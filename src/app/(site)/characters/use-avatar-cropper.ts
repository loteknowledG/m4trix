import { useState } from 'react';
import { toast } from 'sonner';

export type AvatarCropTarget = string | 'user';

type AgentLike = {
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
};

type UseAvatarCropperArgs<TAgent extends AgentLike> = {
  updateAgent: (
    id: string,
    updates: Partial<Pick<TAgent, 'avatarUrl' | 'avatarCrop'>>,
  ) => void | Promise<void>;
  updatePrompterAgent: (
    updates: Partial<Pick<TAgent, 'avatarUrl' | 'avatarCrop'>>,
  ) => void | Promise<void>;
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
  const [isApplying, setIsApplying] = useState(false);

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

  async function applyPortraitUpdate(avatarCrop?: { x: number; y: number; zoom: number }) {
    if (!croppingImage || !croppingTarget || isApplying) return;

    setIsApplying(true);
    try {
      const updates = { avatarUrl: croppingImage, avatarCrop };
      if (croppingTarget === 'user') {
        await updatePrompterAgent(updates);
      } else {
        await updateAgent(croppingTarget, updates);
      }
      clearCropper();
    } catch (error) {
      console.error('[avatar-crop] save failed', error);
      toast.error('Could not save avatar. Try again.');
    } finally {
      setIsApplying(false);
    }
  }

  async function applyGifImmediately() {
    await applyPortraitUpdate(undefined);
  }

  async function handleApplyCrop() {
    await applyPortraitUpdate({ ...crop });
  }

  return {
    applyGifImmediately,
    clearCropper,
    crop,
    croppingImage,
    croppingTarget,
    handleApplyCrop,
    handleAvatarUpload,
    isApplying,
    isGif,
    isHoveringEdge,
    setCrop,
    setIsHoveringEdge,
  };
}
