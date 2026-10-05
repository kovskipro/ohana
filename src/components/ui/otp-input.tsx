"use client"

import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export type OtpStatus = "idle" | "error" | "loading" | "success"

export interface OtpInputProps {
  label?: string
  length?: number
  mode?: "numeric" | "alphanumeric" | "mixed"
  groupEvery?: number
  onChange?: (value: string) => void
  status?: OtpStatus
  errorMessage?: string
  disabled?: boolean
  value?: string
}

function OtpInput({
  label,
  length = 6,
  mode = "numeric",
  groupEvery,
  onChange,
  status = "idle",
  errorMessage,
  disabled,
  value: controlledValue,
}: OtpInputProps) {
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([])
  const [internal, setInternal] = React.useState("")
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue! : internal

  const notifyChange = React.useCallback(
    (val: string) => {
      if (!isControlled) setInternal(val)
      onChange?.(val)
    },
    [isControlled, onChange],
  )

  const moveCursor = (index: number, dir: "forward" | "backward") => {
    const next = index + (dir === "forward" ? 1 : -1)
    if (next >= 0 && next < length) {
      inputRefs.current[next]?.focus()
    }
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace") {
      if (value[index] && index < length - 1) {
        // don't move on empty-backspace, just let onChange clear
      } else if (!value[index]) {
        moveCursor(index, "backward")
      }
    } else if (e.key === "ArrowLeft") {
      moveCursor(index, "backward")
      e.preventDefault()
    } else if (e.key === "ArrowRight") {
      moveCursor(index, "forward")
      e.preventDefault()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").trim()
    if (mode === "numeric") {
      const digits = pasted.replace(/\D/g, "").slice(0, length)
      if (digits.length === length) {
        notifyChange(digits)
        inputRefs.current[length - 1]?.focus()
      }
    }
  }

  const handleInput = (index: number, raw: string) => {
      const char = raw.slice(0, 1)
    if (!char) return

    if (mode === "numeric") {
      if (!/^\d$/.test(char)) return
    } else if (mode === "alphanumeric") {
      if (!/^[a-zA-Z0-9]$/.test(char)) return
    } else {
      if (!/^\S$/.test(char)) return
    }

    const chars = value.split("")
    chars[index] = mode === "numeric" ? char : char.toUpperCase()
    const newVal = chars.join("").slice(0, length)
    notifyChange(newVal)

    if (newVal.length === length) {
      inputRefs.current[length - 1]?.blur()
    } else if (index < length - 1) {
      moveCursor(index, "forward")
    }
  }

  const inputId = React.useId()
  const inputClasses = cn(
    "w-10 h-12 text-center text-lg font-medium tracking-wider transition-colors",
    status === "error" && "border-destructive focus:ring-destructive/50",
    status === "loading" && "cursor-wait opacity-60",
    "dark:bg-input/30",
  )

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <div className="flex items-center gap-2">
        {Array.from({ length }).map((_, i) => {
          const groupStart = groupEvery && i > 0 && i % groupEvery === 0
          const groupMid =
            groupEvery && i > 0 && i % groupEvery !== 0 && i !== length - 1

          return (
            <React.Fragment key={i}>
              {groupStart && groupEvery && groupEvery < length ? (
                <span className="w-px self-stretch bg-border" />
              ) : null}
              <Input
                id={inputId}
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                type={mode === "numeric" ? "tel" : "text"}
                inputMode={mode === "numeric" ? "numeric" : "text"}
                maxLength={length}
                autoComplete="one-time-code"
                autoFocus={i === 0}
                value={value[i] ?? ""}
                onInput={(e) => handleInput(i, e.currentTarget.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onPaste={i === 0 ? handlePaste : undefined}
                onChange={() => {}}
                disabled={disabled || status === "loading"}
                className={inputClasses}
                aria-label={`Cyfra ${i + 1} z ${length}`}
              />
              {groupMid && <span className="sr-only"> </span>}
            </React.Fragment>
          )
        })}
      </div>

      {status === "error" && errorMessage ? (
        <span className="text-xs text-destructive">{errorMessage}</span>
      ) : null}
      {status === "loading" ? (
        <span className="text-xs text-muted-foreground">Wysyłamy kod…</span>
      ) : null}
    </div>
  )
}

export { OtpInput }
