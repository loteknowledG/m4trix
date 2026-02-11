import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileUp, ImagePlus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface AgentCardProps {
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  dragOverId?: string | null;
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
  dragOverId,
  onAvatarUpload,
  onImport,
  onExport,
  onDelete,
  onRemove,
  onNameChange,
  onDescriptionChange,
  isUser = false,
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex gap-2 items-center">
        <label
          className="relative group cursor-pointer"
          onDragOver={e => {
            e.preventDefault();
          }}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && onAvatarUpload) onAvatarUpload(file);
          }}
        >
          <Avatar className="h-10 w-10 shrink-0 border transition-all hover:border-primary/50 overflow-hidden relative">
            <AvatarImage
              src={avatarUrl}
              style={
                avatarCrop
                  ? (() => {
                      // Match the crop/export logic from the cropper (object-fit: contain, -20px offset)
                      const UI_WORKSPACE = 400;
                      const UI_CROP_CIRCLE = 320;
                      const AVATAR_SIZE = 40; // px, matches .h-10.w-10
                      // Assume the avatar image is a square crop of 256x256 exported
                      const EXPORT_SIZE = 256;
                      // The crop circle is mapped to the avatar size
                      const scale = AVATAR_SIZE / UI_CROP_CIRCLE;
                      // The offset in the cropper UI (including -20px vertical offset)
                      const offsetX = -avatarCrop.x * scale;
                      const offsetY = (-avatarCrop.y - 20) * scale;
                      // The zoom factor
                      const zoom = avatarCrop.zoom;
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
                'absolute inset-0 flex flex-col items-center justify-center bg-black/40 transition-all',
                dragOverId === (isUser ? 'user' : name)
                  ? 'opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                  : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <ImagePlus className="h-4 w-4 text-white mb-1" />
              {dragOverId === (isUser ? 'user' : name) && (
                <span className="text-[8px] text-white font-bold uppercase tracking-tighter">
                  Drop
                </span>
              )}
            </div>
          </Avatar>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && onAvatarUpload) onAvatarUpload(file);
              e.target.value = '';
            }}
          />
        </label>
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
          title="Import Agent Role (.md)"
        >
          <label style={{ margin: 0 }}>
            <FileUp className="h-3.5 w-3.5" />
            <input
              type="file"
              className="hidden"
              accept=".md"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.name.endsWith('.md')) {
                  toast.error(`File ${file.name} is not a Markdown file.`);
                  e.target.value = '';
                  return;
                }
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
        placeholder={isUser ? 'Your name (shown in messages)' : 'Agent name'}
        value={name}
        onChange={e => onNameChange && onNameChange(e.target.value)}
      />
      <textarea
        className="min-h-[60px] text-[11px] w-full mt-1"
        placeholder={isUser ? 'Describe your role and how you interact...' : 'Agent description'}
        value={description}
        onChange={e => onDescriptionChange && onDescriptionChange(e.target.value)}
      />
    </div>
  );
};
