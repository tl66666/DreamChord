import { Layers } from 'lucide-react'
import type { ChapterBlock } from './types'
import { PADDING } from './constants'

interface ChapterBandProps {
  blocks: ChapterBlock[]
  width: number
}

/**
 * ChapterBand — 章节带背景渲染
 *
 * 为每个章节绘制半透明背景带（交替 dream-50/40 与 dream-50/20），
 * 并在 headerY 位置渲染带 Layers 图标的章节标题。
 */
function ChapterBand({ blocks, width }: ChapterBandProps) {
  return (
    <>
      {blocks.map((block, index) => {
        // 交替背景色
        const bgColor = index % 2 === 0 ? 'bg-dream-50/40' : 'bg-dream-50/20'
        // 章节带高度：从 headerY 覆盖到 bodyY + bodyHeight（含标题区与卡片区）
        const bandHeight = block.bodyY + block.bodyHeight - block.headerY

        return (
          <div key={block.id}>
            {/* 半透明背景带 */}
            <div
              className={`absolute ${bgColor}`}
              style={{
                top: block.headerY,
                left: 0,
                width,
                height: bandHeight,
              }}
            />

            {/* 章节标题（左侧带 Layers 图标） */}
            <div
              className="absolute flex items-center gap-1 text-xs font-medium text-dream-500"
              style={{
                left: PADDING / 2,
                top: block.headerY,
              }}
            >
              <Layers className="h-3 w-3" />
              <span>{block.label}</span>
            </div>
          </div>
        )
      })}
    </>
  )
}

export default ChapterBand
