"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"
import { Label } from "@/components/ui/label"

export interface SwitchProps
  extends Omit<React.ComponentProps<typeof SwitchPrimitive.Root>, "onCheckedChange"> {
  label?: string
  description?: React.ReactNode
  onCheckedChange?: (checked: boolean) => void
}

function Switch({
  className,
  label,
  description,
  onCheckedChange,
  ...props
}: SwitchProps) {
  const switchId = React.useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <SwitchPrimitive.Root
          id={switchId}
          data-slot="switch"
          data-size="default"
          className={cn(
            "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
            className,
          )}
          onCheckedChange={onCheckedChange}
          {...props}
        >
          <SwitchPrimitive.Thumb
            data-slot="switch-thumb"
            className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
          />
        </SwitchPrimitive.Root>
        {label && (
          <Label htmlFor={switchId} className="text-sm font-medium">
            {label}
          </Label>
        )}
      </div>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  )
}

export { Switch }
