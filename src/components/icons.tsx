import type { ComponentType, ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
};

export type LucideIcon = ComponentType<IconProps>;

function IconBase({
  children,
  size = 24,
  className,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

const line = (x1: number, y1: number, x2: number, y2: number, key?: string) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />
);

const path = (d: string, key?: string) => <path key={key} d={d} />;

const polyline = (points: string, key?: string) => <polyline key={key} points={points} />;

const circle = (cx: number, cy: number, r: number, key?: string) => (
  <circle key={key} cx={cx} cy={cy} r={r} />
);

export function ArrowLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      {[path('M19 12H5', 'arrow-left-stem'), polyline('12 19 5 12 12 5', 'arrow-left-head')]}
    </IconBase>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <IconBase {...props}>
      {[path('M5 12h14', 'arrow-right-stem'), polyline('12 5 19 12 12 19', 'arrow-right-head')]}
    </IconBase>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[path('M12 5v14', 'arrow-down-stem'), polyline('19 12 12 19 5 12', 'arrow-down-head')]}
    </IconBase>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'book-top'),
        path('M6 2h14v20H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', 'book-body'),
      ]}
    </IconBase>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M9 3a3 3 0 0 0-3 3v1', 'brain-0'),
        path('M15 3a3 3 0 0 1 3 3v1', 'brain-1'),
        path('M6 8a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2', 'brain-2'),
        path('M18 8a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2', 'brain-3'),
        path('M8 21v-2', 'brain-4'),
        path('M16 21v-2', 'brain-5'),
        path('M12 3v18', 'brain-6'),
        path('M9 7h6', 'brain-7'),
        path('M9 12h6', 'brain-8'),
      ]}
    </IconBase>
  );
}

export function Check(props: IconProps) {
  return <IconBase {...props}>{polyline('20 6 9 17 4 12')}</IconBase>;
}

export const CheckIcon = Check;

export function CheckCircle(props: IconProps) {
  return (
    <IconBase {...props}>
      {[circle(12, 12, 9, 'check-circle-ring'), polyline('16 8 10.5 14 8 11.5', 'check-circle-mark')]}
    </IconBase>
  );
}

export function ChevronDown(props: IconProps) {
  return <IconBase {...props}>{polyline('6 9 12 15 18 9')}</IconBase>;
}

export const ChevronDownIcon = ChevronDown;

export function ChevronLeft(props: IconProps) {
  return <IconBase {...props}>{polyline('15 18 9 12 15 6')}</IconBase>;
}

export const ChevronLeftIcon = ChevronLeft;

export function ChevronRight(props: IconProps) {
  return <IconBase {...props}>{polyline('9 18 15 12 9 6')}</IconBase>;
}

export const ChevronRightIcon = ChevronRight;

export function ChevronUp(props: IconProps) {
  return <IconBase {...props}>{polyline('18 15 12 9 6 15')}</IconBase>;
}

export function Circle(props: IconProps) {
  return <IconBase {...props}>{circle(12, 12, 9)}</IconBase>;
}

export function CornerDownLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M9 10v4a4 4 0 0 0 4 4h7', 'corner-down-left-path'),
        polyline('9 15 4 10 9 5', 'corner-down-left-arrow'),
      ]}
    </IconBase>
  );
}

export function DatabaseBackup(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M12 3c-4.4 0-8 1.8-8 4s3.6 4 8 4 8-1.8 8-4-3.6-4-8-4z', 'db-backup-top'),
        path('M4 7v10c0 2.2 3.6 4 8 4s8-1.8 8-4V7', 'db-backup-body'),
        path('M12 11v7', 'db-backup-stem'),
        polyline('9 14 12 11 15 14', 'db-backup-chevron'),
      ]}
    </IconBase>
  );
}

export function Dot(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      {circle(12, 12, 3)}
    </IconBase>
  );
}

export function Ellipsis(props: IconProps) {
  return (
    <IconBase {...props} stroke="currentColor">
      {[
        circle(5, 12, 1.5, 'ellipsis-0'),
        circle(12, 12, 1.5, 'ellipsis-1'),
        circle(19, 12, 1.5, 'ellipsis-2'),
      ]}
    </IconBase>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'file-text-outline'),
        polyline('14 2 14 8 20 8', 'file-text-fold'),
        line(9, 13, 15, 13, 'file-text-line-1'),
        line(9, 17, 15, 17, 'file-text-line-2'),
      ]}
    </IconBase>
  );
}

export function FileUp(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'file-up-outline'),
        polyline('14 2 14 8 20 8', 'file-up-fold'),
        polyline('12 18 12 11 9 14', 'file-up-arrow-1'),
        polyline('12 11 15 14', 'file-up-arrow-2'),
      ]}
    </IconBase>
  );
}

export function Gamepad(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M6 11h12a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-1a4 4 0 0 1 4-4z', 'gamepad-body'),
        line(8, 13, 8, 17, 'gamepad-dpad-v'),
        line(6, 15, 10, 15, 'gamepad-dpad-h'),
        circle(16, 14, 1, 'gamepad-btn-a'),
        circle(18.5, 16.5, 1, 'gamepad-btn-b'),
      ]}
    </IconBase>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        circle(12, 12, 9, 'globe-ring'),
        path('M3 12h18', 'globe-horiz'),
        path('M12 3a14 14 0 0 1 0 18', 'globe-meridian-r'),
        path('M12 3a14 14 0 0 0 0 18', 'globe-meridian-l'),
      ]}
    </IconBase>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(3, 3, 18, 18, 'image-frame'),
        circle(9, 9, 2, 'image-sun'),
        polyline('21 15 16 10 5 21', 'image-hill'),
      ]}
    </IconBase>
  );
}

export function ImagePlus(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(3, 3, 18, 18, 'image-plus-frame'),
        circle(9, 9, 2, 'image-plus-sun'),
        polyline('21 15 16 10 5 21', 'image-plus-hill'),
        line(15, 8, 15, 14, 'image-plus-plus-v'),
        line(12, 11, 18, 11, 'image-plus-plus-h'),
      ]}
    </IconBase>
  );
}

function rect(x: number, y: number, width: number, height: number, key?: string) {
  return <rect key={key} x={x} y={y} width={width} height={height} rx="2" ry="2" />;
}

export function LayoutGrid(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(3, 3, 7, 7, 'layout-grid-0'),
        rect(14, 3, 7, 7, 'layout-grid-1'),
        rect(3, 14, 7, 7, 'layout-grid-2'),
        rect(14, 14, 7, 7, 'layout-grid-3'),
      ]}
    </IconBase>
  );
}

export function Loader2(props: IconProps) {
  return (
    <IconBase {...props} className={['animate-spin', props.className].filter(Boolean).join(' ')}>
      {[circle(12, 12, 9, 'loader2-ring'), path('M21 12a9 9 0 0 0-9-9', 'loader2-cap')]}
    </IconBase>
  );
}

export const Loader2Icon = Loader2;

export function LogOut(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M10 17l5-5-5-5', 'logout-chevron'),
        path('M15 12H3', 'logout-stem'),
        path('M21 3v18', 'logout-door'),
      ]}
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[line(4, 6, 20, 6, 'menu-0'), line(4, 12, 20, 12, 'menu-1'), line(4, 18, 20, 18, 'menu-2')]}
    </IconBase>
  );
}

export function MessageCircle(props: IconProps) {
  return (
    <IconBase {...props}>
      {[circle(12, 12, 9, 'message-circle-ring'), path('M8 15l-2 4 4-2', 'message-circle-tail')]}
    </IconBase>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'mic-capsule'),
        path('M5 11v1a7 7 0 0 0 14 0v-1', 'mic-stand'),
        path('M12 19v4', 'mic-stem'),
        path('M8 23h8', 'mic-base'),
      ]}
    </IconBase>
  );
}

export function Music2Icon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M9 18V5l12-2v13', 'music2-stem'),
        circle(6, 18, 3, 'music2-note-l'),
        circle(18, 16, 3, 'music2-note-r'),
      ]}
    </IconBase>
  );
}

export function PanelsTopLeft(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(3, 3, 18, 18, 'panels-frame'),
        line(3, 9, 21, 9, 'panels-top'),
        line(9, 3, 9, 21, 'panels-left'),
      ]}
    </IconBase>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path(
          'M21.44 11.05 12 20.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.19 9.19a2 2 0 1 1-2.83-2.83L15 6',
          'paperclip-path',
        ),
      ]}
    </IconBase>
  );
}

export function Plug(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M12 2v6', 'plug-prong'),
        path('M8 8h8', 'plug-bar'),
        path('M10 8v7a2 2 0 0 1-2 2H6', 'plug-left'),
        path('M14 8v7a2 2 0 0 0 2 2h2', 'plug-right'),
      ]}
    </IconBase>
  );
}

export function Plus(props: IconProps) {
  return (
    <IconBase {...props}>
      {[line(12, 5, 12, 19, 'plus-v'), line(5, 12, 19, 12, 'plus-h')]}
    </IconBase>
  );
}

export const PlusIcon = Plus;

export function RotateCcw(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M3 12a9 9 0 1 0 3-6.7', 'rotate-ccw-arc'),
        polyline('3 4 6 4 6 7', 'rotate-ccw-arrow'),
      ]}
    </IconBase>
  );
}

export function Search(props: IconProps) {
  return (
    <IconBase {...props}>
      {[circle(11, 11, 7, 'search-lens'), line(16.65, 16.65, 21, 21, 'search-handle')]}
    </IconBase>
  );
}

export function Send(props: IconProps) {
  return (
    <IconBase {...props}>
      {[path('M22 2 11 13', 'send-wing'), path('M22 2 15 22 11 13 2 9 22 2', 'send-body')]}
    </IconBase>
  );
}

export function SquareIcon(props: IconProps) {
  return <IconBase {...props}>{rect(4, 4, 16, 16)}</IconBase>;
}

export function SquarePen(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(4, 4, 16, 16, 'square-pen-rect'),
        path('M13.5 6.5 17.5 10.5 8.5 19.5H4.5v-4z', 'square-pen-path'),
      ]}
    </IconBase>
  );
}

export function Trash2(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M3 6h18', 'trash2-lid'),
        path('M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'trash2-rim'),
        path('M10 11v6', 'trash2-stroke-left'),
        path('M14 11v6', 'trash2-stroke-right'),
        path('M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14', 'trash2-bin'),
      ]}
    </IconBase>
  );
}

export function Upload(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'upload-tray'),
        polyline('17 8 12 3 7 8', 'upload-chevron'),
        line(12, 3, 12, 15, 'upload-stem'),
      ]}
    </IconBase>
  );
}

export function User(props: IconProps) {
  return (
    <IconBase {...props}>
      {[circle(12, 8, 4, 'user-head'), path('M4 21a8 8 0 0 1 16 0', 'user-body')]}
    </IconBase>
  );
}

export const UserIcon = User;

export function Users(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        path('M17 21a5 5 0 0 0-10 0', 'users-path-base'),
        circle(9, 7, 3, 'users-circle-left'),
        circle(17, 7, 3, 'users-circle-right'),
        path('M22 21a5 5 0 0 0-3-4.58', 'users-path-right'),
        path('M2 21a5 5 0 0 1 3-4.58', 'users-path-left'),
      ]}
    </IconBase>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {[
        rect(3, 5, 14, 14, 'video-frame'),
        polyline('17 10 21 7 21 17 17 14', 'video-play'),
      ]}
    </IconBase>
  );
}

export function X(props: IconProps) {
  return (
    <IconBase {...props}>
      {[line(18, 6, 6, 18, 'x-1'), line(6, 6, 18, 18, 'x-2')]}
    </IconBase>
  );
}

export const XIcon = X;
