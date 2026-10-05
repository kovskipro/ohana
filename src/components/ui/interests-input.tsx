"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface InterestsInputProps {
  value: string[]
  onChange: (value: string[]) => void
  error?: string
  placeholder?: string
}

function InterestsInput({
  value = [],
  onChange,
  error,
  placeholder = "Naciśnij Enter, aby dodać...",
}: InterestsInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const addInterest = (interest: string) => {
    const trimmed = interest.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue("")
  }

  const removeInterest = (interestToRemove: string) => {
    onChange(value.filter((i) => i !== interestToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addInterest(inputValue)
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeInterest(value[value.length - 1])
    } else if (e.key === "Comma" || e.key === ",") {
      e.preventDefault()
      addInterest(inputValue)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    const items = pasted
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const unique = [...new Set([...value, ...items])]
    onChange(unique)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          error && "border-destructive focus-within:ring-3 focus-within:ring-destructive/20",
        )}
      >
        {value.map((interest) => (
          <Badge key={interest} variant="secondary" className="text-xs">
            {interest}
            <button
              type="button"
              onClick={() => removeInterest(interest)}
              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
              aria-label={`Usuń ${interest}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] border-0 bg-transparent px-1 text-inherit outline-none placeholder:text-muted-foreground"
        />
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export { InterestsInput }
