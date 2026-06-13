import * as React from "react"
import type { ContentItem } from "@/types/content"
import { BibleBrowser } from "@/components/browser/bible-browser"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  BookOpenIcon,
  Music2Icon,
  VideoIcon,
  FileTextIcon,
} from "lucide-react"

interface ContentBrowserProps {
  /** Called when the user selects a result. Stages the item in Preview/Staging. */
  setStagedItem: (i: ContentItem | null) => void
  /** Called when the active tab changes, so the detail panel can mirror it. */
  onTabChange?: (tab: string) => void
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground/40">
        {icon}
      </div>
      <p className="max-w-[20ch] text-[0.6875rem] leading-relaxed text-muted-foreground/50">
        {message}
      </p>
    </div>
  )
}

export function ContentBrowser({ setStagedItem, onTabChange }: ContentBrowserProps) {
  const [activeTab, setActiveTab] = React.useState("bible")

  return (
    <div
      data-slot="content-browser"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card",
      )}
    >
      <Tabs
        defaultValue="bible"
        onValueChange={(tab) => {
          setActiveTab(tab)
          onTabChange?.(tab)
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {/* Tab bar */}
        <div className="flex shrink-0 items-center border-b border-border bg-card px-2">
          <TabsList
            variant="line"
            className="h-10 gap-0 rounded-none bg-transparent px-0"
          >
            <TabsTrigger value="bible" className="gap-1.5 px-3 text-xs">
              <BookOpenIcon className="size-3.5" />
              Bible
            </TabsTrigger>
            <TabsTrigger value="songs" className="gap-1.5 px-3 text-xs">
              <Music2Icon className="size-3.5" />
              Songs
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5 px-3 text-xs">
              <VideoIcon className="size-3.5" />
              Media
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1.5 px-3 text-xs">
              <FileTextIcon className="size-3.5" />
              Text
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Bible tab — fully functional */}
        <TabsContent
          value="bible"
          className="min-h-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
        >
          <BibleBrowser onStage={setStagedItem} isActive={activeTab === "bible"} />
        </TabsContent>

        {/* Songs tab — placeholder */}
        <TabsContent
          value="songs"
          className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <EmptyState
            icon={<Music2Icon className="size-5" />}
            message="Songs library coming in a future update"
          />
        </TabsContent>

        {/* Media tab — placeholder */}
        <TabsContent
          value="media"
          className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <EmptyState
            icon={<VideoIcon className="size-5" />}
            message="Media library coming in a future update"
          />
        </TabsContent>

        {/* Text tab — placeholder */}
        <TabsContent
          value="text"
          className="min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <EmptyState
            icon={<FileTextIcon className="size-5" />}
            message="Custom text coming in a future update"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
