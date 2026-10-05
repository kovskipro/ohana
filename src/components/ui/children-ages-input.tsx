"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"

export interface ChildrenAgesInputProps {
  numChildren: number
  ages: number[]
  onNumChildrenChange: (num: number) => void
  onAgesChange: (ages: number[]) => void
  error?: string
}

function ChildrenAgesInput({
  numChildren,
  ages,
  onNumChildrenChange,
  onAgesChange,
  error,
}: ChildrenAgesInputProps) {
  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    const num = isNaN(val) ? 0 : Math.max(0, Math.min(20, val))

    const newAges = [...ages]
    if (num > ages.length) {
      newAges.push(...Array(num - ages.length).fill(0))
    } else if (num < ages.length) {
      newAges.splice(num)
    }

    onNumChildrenChange(num)
    onAgesChange(newAges)
  }

  const handleAgeChange = (index: number, value: string) => {
    const val = parseInt(value, 10)
    const newAges = [...ages]
    newAges[index] = isNaN(val) ? 0 : Math.max(0, Math.min(99, val))
    onAgesChange(newAges)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-4">
        <Input
          label="Liczba dzieci"
          type="number"
          min={0}
          max={20}
          value={numChildren}
          onChange={handleNumChange}
          error={error}
        />
      </div>

      {numChildren > 0 && (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: numChildren }).map((_, i) => (
            <div key={i} className="flex items-end gap-1.5">
              <Input
                label={`Wiek dziecka ${i + 1}`}
                type="number"
                min={0}
                max={99}
                value={ages[i] ?? ""}
                onChange={(e) => handleAgeChange(i, e.target.value)}
                className="w-20"
              />
              {numChildren > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    const newAges = [...ages]
                    newAges.splice(i, 1)
                    const newNum = numChildren - 1
                    onNumChildrenChange(newNum)
                    onAgesChange(newAges.length > 0 ? newAges : [0])
                  }}
                  aria-label={`Usuń dziecko ${i + 1}`}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {numChildren > 0 && numChildren < 20 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const newAges = [...ages]
            newAges.push(0)
            onNumChildrenChange(numChildren + 1)
            onAgesChange(newAges)
          }}
        >
          <Plus className="size-4" />
          Dodaj dziecko
        </Button>
      )}
    </div>
  )
}

export { ChildrenAgesInput }
