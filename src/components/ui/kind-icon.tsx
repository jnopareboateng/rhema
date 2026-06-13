import { BookOpenIcon, Music2Icon, VideoIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ContentKind } from "@/types/content"

const ICONS = { verse: BookOpenIcon, lyrics: Music2Icon, media: VideoIcon } as const
const COLORS: Record<ContentKind, string> = {
  verse: "text-blue-400",
  lyrics: "text-purple-400",
  media: "text-teal-400",
}

export function KindIcon({
  kind,
  size = 16,
  className,
  colored = true,
}: {
  kind: ContentKind
  size?: number
  className?: string
  colored?: boolean
}) {
  const Icon = ICONS[kind]
  return <Icon size={size} className={cn(colored && COLORS[kind], className)} aria-hidden />
}
