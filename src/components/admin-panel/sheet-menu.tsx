import Link from "next/link";
import { MenuIcon } from "@/components/icons";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

import { Button } from "@/components/ui/button";
import { Menu } from "@/components/admin-panel/menu";
import {
  Sheet,
  SheetHeader,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";

export function SheetMenu() {
  return (
    <Sheet>
      <SheetTrigger className="lg:hidden" asChild>
        <Button className="h-8" variant="outline" size="icon">
          <MenuIcon size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:w-72 px-3 h-full flex flex-col" side="left">
        <SheetHeader>
          <Button
            className="flex justify-center items-center pb-2 pt-1"
            variant="link"
            asChild
          >
            <Link href="/heap" className="flex items-center gap-2">
              <VisuallyHidden.Root>
                <SheetTitle>m4trix</SheetTitle>
              </VisuallyHidden.Root>
              <pre className="font-mono text-[6px] font-bold leading-[0.9] tracking-[-0.06em] drop-shadow-[0_0_10px_rgba(236,72,153,0.28)] text-fuchsia-200">
{`≈≈≈≈≈≈≈≈≈≈≈≈[ m4trix ]≈≈≈≈≈≈≈≈≈≈≈≈≈
≈≈≈███╗≈≈███╗≈██╗≈████████╗██████╗≈██╗≈██╗≈≈██╗
≈≈≈████╗≈████║≈███║≈╚══██╔══╝██╔══██╗██║≈╚██╗██╔╝
≈≈≈██╔████╔██║≈██╔██║≈≈≈≈██║≈≈≈██████╔╝██║≈≈╚███╔╝
≈≈≈██║╚██╔╝██║≈███████║≈≈≈██║≈≈≈██╔══██╗██║≈≈██╔██╗
≈≈≈██║≈╚═╝≈██║≈╚════██║≈≈≈██║≈≈≈██║≈≈██║██║≈██╔╝╚██╗
≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈╚═╝≈≈≈╚═╝≈≈╚═╝╚═╝≈╚═╝≈≈╚═╝`}
              </pre>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
            </Link>
          </Button>
        </SheetHeader>
        <Menu isOpen />
      </SheetContent>
    </Sheet>
  );
}
