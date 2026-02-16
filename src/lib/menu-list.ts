import {
  Users,
  SquarePen,
  LayoutGrid,
  DatabaseBackup,
  Trash2,
  Gamepad,
  LucideIcon,
} from 'lucide-react';

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

export function getMenuList(): Group[] {
  return [
    {
      groupLabel: '',
      menus: [
        {
          href: '/heap',
          label: 'Heap',
          icon: LayoutGrid,
          submenus: [],
        },
      ],
    },
    {
      groupLabel: 'Contents',
      menus: [
        {
          href: '/agents',
          label: 'Agents',
          icon: Users,
        },
        {
          href: '/stories',
          label: 'Stories',
          icon: SquarePen,
          submenus: [
            {
              href: '/stories',
              label: 'All Stories',
            },
          ],
        },
        {
          href: '/games',
          label: 'Games',
          icon: Gamepad,
        },
        {
          href: '/trash',
          label: 'Trash',
          icon: Trash2,
        },
      ],
    },
    {
      groupLabel: 'Settings',
      menus: [
        {
          href: '/backups',
          label: 'Backups',
          icon: DatabaseBackup,
        },
      ],
    },
  ];
}
