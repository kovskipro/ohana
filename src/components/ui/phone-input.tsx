"use client"

import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  disabled?: boolean
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, label, value, onChange, error, disabled, ...props }, ref) => {
    const inputId = React.useId()

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <Label htmlFor={inputId} className="text-sm font-medium">
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={onChange}
          disabled={disabled}
          error={error}
          className={cn("w-full", className)}
          {...props}
        />
      </div>
    )
  },
)
PhoneInput.displayName = "PhoneInput"

export { PhoneInput }
