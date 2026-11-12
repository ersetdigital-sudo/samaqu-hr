"use client";

import type { ReactNode, RefObject } from "react";
import type { DrawerSize } from "./drawer-sizes";
import { FormDrawer } from "./form-drawer";

/** Cangkang drawer baca-saja dengan gaya visual yang sama seperti form. */
export function DetailDrawer({
  open,
  title,
  description,
  size = "md",
  onClose,
  footer,
  subnav,
  bodyRef,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: DrawerSize;
  onClose: () => void;
  footer?: ReactNode;
  subnav?: ReactNode;
  bodyRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <FormDrawer
      open={open}
      title={title}
      description={description}
      size={size}
      modal={false}
      onRequestClose={onClose}
      footer={footer}
      subnav={subnav}
      bodyRef={bodyRef}
    >
      {children}
    </FormDrawer>
  );
}
