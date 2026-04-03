"use client";

import { SidebarLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion, AnimatePresence } from "motion/react";
import { useState, type ReactNode } from "react";

export interface MacOSSidebarProps {
  items: Array<string | { label: string; icon?: ReactNode }>;
  defaultOpen?: boolean;
  initialSelectedIndex?: number;
  onItemClick?: (label: string, index: number) => void;
  children?: ReactNode;
  className?: string;
}

export function MacOSSidebar({
  items,
  defaultOpen = true,
  initialSelectedIndex = 0,
  onItemClick,
  children,
  className = "",
}: MacOSSidebarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(initialSelectedIndex);
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const railWidth = isOpen ? 220 : 24;

  return (
    <div
      className={`theme-injected bg-white relative flex min-w-96 overflow-hidden rounded-lg p-0 ${className}`}
    >
      <motion.div
        animate={{
          width: railWidth,
        }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
        className={`flex shrink-0 flex-col items-start rounded-lg p-0.5 transition-colors duration-900 ease-out ${
          isOpen ? "bg-background" : "bg-transparent"
        }`}
      >
        <div
          className={`flex w-full items-center ${
            isOpen ? "justify-end gap-2" : "justify-center"
          } text-muted-foreground shrink-0 p-0.5`}
        >
          <motion.div
            layout
            className="flex shrink-0 items-center justify-center"
          >
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex size-8 items-center justify-center rounded-md text-black transition-all hover:bg-black/10 hover:scale-105"
            >
              <HugeiconsIcon
                icon={SidebarLeftIcon}
                className="size-5 cursor-pointer text-black"
              />
            </button>
          </motion.div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative z-10 mt-4 flex w-full flex-col gap-2 whitespace-nowrap"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {items.map((item, index) => {
                const itemLabel = typeof item === "string" ? item : item.label;
                const itemIcon = typeof item === "string" ? null : item.icon;

                return (
                  <div
                    key={`${itemLabel}-${index}`}
                    className="relative cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onClick={() => {
                      setSelectedIndex(index);
                      onItemClick?.(itemLabel, index);
                    }}
                  >
                    <AnimatePresence>
                      {selectedIndex === index && (
                        <motion.div
                          className="absolute inset-0 z-0 rounded-lg bg-neutral-700"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        />
                      )}
                    </AnimatePresence>
                    <p
                      className={`relative z-10 flex items-center gap-3 px-5 py-3 tracking-tight ${
                        selectedIndex === index
                          ? "font-medium text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      {itemIcon ? (
                        <span className="inline-flex size-4 items-center justify-center">
                          {itemIcon}
                        </span>
                      ) : null}
                      <span>{itemLabel}</span>
                    </p>
                    <AnimatePresence>
                      {hoveredIndex === index && selectedIndex !== index && (
                        <motion.span
                          layoutId="sidebar-hover-bg"
                          className="absolute inset-0 z-0 rounded-lg bg-neutral-200"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 350,
                            damping: 30,
                          }}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="z-0 h-full min-h-full w-full flex-1 overflow-y-auto pl-0">
        {children}
      </div>
    </div>
  );
}
