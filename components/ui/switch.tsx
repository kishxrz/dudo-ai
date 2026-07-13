"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none",
        size === "sm" ? "h-3.5 w-6" : "h-[20px] w-9",
        "bg-zinc-200 data-[checked]:bg-[#22577A] focus-visible:ring-2 focus-visible:ring-[#22577A]/25",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50 cursor-pointer shadow-inner",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow transition-transform",
          size === "sm" 
            ? "size-2.5 group-data-[checked]/switch:translate-x-2.5 translate-x-0.5" 
            : "size-4 group-data-[checked]/switch:translate-x-4.5 translate-x-0.5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
