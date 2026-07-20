"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";

const order = ["light", "dark", "system"] as const;
type Mode = (typeof order)[number];

const icons: Record<Mode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const labels: Record<Mode, string> = {
  light: "Chiaro",
  dark: "Scuro",
  system: "Sistema",
};

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const current: Mode = mounted && order.includes(theme as Mode) ? (theme as Mode) : "system";
  const Icon = icons[current];

  return (
    <Tooltip content={`Tema: ${labels[current]}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={className}
        aria-label="Cambia tema"
        onClick={() => setTheme(order[(order.indexOf(current) + 1) % order.length])}
      >
        {mounted ? <Icon className="h-5 w-5" /> : <span className="h-5 w-5" />}
      </Button>
    </Tooltip>
  );
}
