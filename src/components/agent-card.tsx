import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUp, ImagePlus, User } from '@/components/icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { copyImageToClipboardFromSrc, getImageFileFromPasteEvent } from '@/lib/clipboard-image';

export interface AgentCardProps {
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  /** Stable id for drag highlight (prefer character id over display name). */
  avatarDropId?: string;
  dragOverId?: string | null;
  /** Sidebar-level hint: user is dragging a file — show drop frames at full strength. */
  fileDropHint?: boolean;
  onAvatarDragHover?: (id: string | null) => void;
  onAvatarUpload?: (file: File) => void;
  onImport?: (file: File) => void;
  onExport?: () => void;
  onDelete?: () => void;
  onRemove?: () => void;
  onNameChange?: (name: string) => void;
  onDescriptionChange?: (desc: string) => void;
  isUser?: boolean;
}

function defaultExportAgent(name: string, description: string) {
  const safeName = name || 'Agent';
  const safeDescription = description || '';
  const content = `# ${safeName}\n\n${safeDescription}`;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename =
    safeName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-') || 'agent-skill';
  a.download = `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(`Agent skill "${safeName}" exported!`);
}

export const AgentCard: React.FC<AgentCardProps> = ({
  name,
  description,
  avatarUrl,
  avatarCrop,
  avatarDropId,
  dragOverId,
  fileDropHint,
  onAvatarDragHover,
  onAvatarUpload,
  onImport,
  onExport,
  onDelete,
  onRemove,
  onNameChange,
  onDescriptionChange,
  isUser = false,
}) => {
  const dropId = avatarDropId ?? (isUser ? 'user' : name);

  const handleCopyPortrait = async () => {
    if (!avatarUrl?.trim()) {
      toast.error('No portrait to copy yet.');
      return;
    }
    try {
      await copyImageToClipboardFromSrc(avatarUrl);
      toast.success('Portrait copied — paste into Grok or another app.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not copy image.';
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2 items-center">
        <label
          className={cn(
            'relative group cursor-pointer rounded-lg p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60',
            'border-2 border-dashed border-zinc-500/70 bg-zinc-950/30',
            fileDropHint && dragOverId !== dropId && 'border-cyan-500/50 bg-cyan-950/25',
            dragOverId === dropId &&
              'border-cyan-400 border-solid bg-cyan-500/20 shadow-[0_0_0_2px_rgba(34,211,238,0.45)] ring-2 ring-cyan-300/50'
          )}
          tabIndex={0}
          title="Drop image, paste from clipboard (click here first), or pick a file"
          onPaste={e => {
            const file = getImageFileFromPasteEvent(e);
            if (!file || !onAvatarUpload) return;
            e.preventDefault();
            onAvatarUpload(file);
            toast.success('Image pasted from clipboard.');
          }}
          onDragEnter={e => {
            if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
            e.preventDefault();
            onAvatarDragHover?.(dropId);
          }}
          onDragLeave={e => {
            if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
            const next = e.relatedTarget as Node | null;
            if (next && e.currentTarget.contains(next)) return;
            onAvatarDragHover?.(null);
          }}
          onDragOver={e => {
            if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            onAvatarDragHover?.(dropId);
          }}
          onDrop={e => {
            e.preventDefault();
            onAvatarDragHover?.(null);
            const file = e.dataTransfer.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
              toast.error('Drop an image file.');
              return;
            }
            onAvatarUpload?.(file);
            toast.success('Image dropped — opening crop…');
          }}
        >
          <Avatar
            className={cn(
              'relative h-8 w-8 shrink-0 border transition-all hover:border-primary/50',
              (fileDropHint || dragOverId === dropId) && 'border-cyan-400/80'
            )}
          >
            <AvatarImage
              src={avatarUrl}
              style={
                avatarCrop
                  ? (() => {
                      // Match the crop/export logic from the cropper (object-fit: contain, -20px offset)
                      const UI_WORKSPACE = 400;
                      const UI_CROP_CIRCLE = 320;
                      const AVATAR_SIZE = 32; // px, matches .h-8.w-8
                      // Assume the avatar image is a square crop of 256x256 exported
                      const EXPORT_SIZE = 256;
                      // The crop circle is mapped to the avatar size
                      const scale = AVATAR_SIZE / UI_CROP_CIRCLE;
                      // The offset in the cropper UI (including -20px vertical offset)
                      // Flip the crop sign so UI drag direction matches final avatar result
                      const offsetX = avatarCrop.x * scale;
                      const offsetY = avatarCrop.y * scale;
                      // Slightly increase displayed avatar zoom so the final avatar appears closer.
                      const ZOOM_ADJUST = 1.38; // match message avatar scaling
                      const zoom = avatarCrop.zoom * ZOOM_ADJUST;
                      return {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                      };
                    })()
                  : undefined
              }
              className={cn(avatarCrop && 'max-w-none')}
            />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center transition-all',
                dragOverId === dropId
                  ? 'bg-cyan-950/75 opacity-100 ring-2 ring-cyan-300 ring-offset-1 ring-offset-zinc-950'
                  : fileDropHint
                  ? 'bg-black/35 opacity-100'
                  : 'bg-black/40 opacity-0 group-hover:opacity-100'
              )}
            >
              <ImagePlus
                className={cn(
                  'mb-0.5 h-4 w-4 text-white drop-shadow',
                  (fileDropHint || dragOverId === dropId) && 'text-cyan-100'
                )}
              />
              {(dragOverId === dropId || fileDropHint) && (
                <span
                  className={cn(
                    'text-[7px] font-bold uppercase tracking-tighter text-white',
                    dragOverId === dropId ? 'text-cyan-50' : 'text-zinc-300'
                  )}
                >
                  {dragOverId === dropId ? 'Drop here' : 'Drop'}
                </span>
              )}
            </div>
          </Avatar>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            aria-label="Upload avatar image"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && onAvatarUpload) onAvatarUpload(file);
              e.target.value = '';
            }}
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
          title="Copy portrait to clipboard"
          aria-label="Copy portrait to clipboard"
          disabled={!avatarUrl}
          onClick={() => void handleCopyPortrait()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
          title="Import Role/Profile (.md or image)"
        >
          <label className="m-0">
            <FileUp className="h-3.5 w-3.5" />
            <input
              type="file"
              className="hidden"
              accept=".md,image/*"
              aria-label="Import role or profile file"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (onImport) onImport(file);
                e.target.value = '';
              }}
            />
          </label>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (onExport ? onExport() : defaultExportAgent(name, description))}
          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
          title="Export Agent Skill"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete || onRemove}
          className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove Agent"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
          </svg>
        </Button>
      </div>
      <Input
        className="h-7 text-xs"
        placeholder={isUser ? 'Your name (shown in messages)' : 'Character name'}
        value={name}
        onChange={e => onNameChange && onNameChange(e.target.value)}
      />
      <textarea
        className="min-h-[60px] text-[11px] w-full mt-1"
        placeholder={
          isUser ? 'Describe your role and how you interact...' : 'Character description'
        }
        value={description}
        onChange={e => onDescriptionChange && onDescriptionChange(e.target.value)}
      />
    </div>
  );
};
