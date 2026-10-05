"use client"

import * as React from "react"
import { cn } from "cn"
import { Avatar as AvatarPrimitive } from "radix-ui"

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function Avatar({
  className,
  size = 32,
  name,
  src,
  alt,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: number
  name?: string | null
  src?: string | null
  alt?: string
}) {
  const pixelSize = typeof size === "number" ? size : 32
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "group/avatar relative inline-flex shrink-0 rounded-full select-none",
        className,
      )}
      style={{ width: pixelSize, height: pixelSize }}
      {...props}
    >
      <AvatarPrimitive.Image
        data-slot="avatar-image"
        src={src ?? undefined}
        alt={alt || name || "Avatar"}
        className={cn(
          "aspect-square size-full rounded-full object-cover",
          !src && "hidden",
        )}
      />
      {!src && (
        <AvatarPrimitive.Fallback
          data-slot="avatar-fallback"
          className={cn(
            "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
          )}
        >
          {name ? getInitials(name) : null}
        </AvatarPrimitive.Fallback>
      )}
    </AvatarPrimitive.Root>
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full rounded-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
