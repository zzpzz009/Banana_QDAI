import React from 'react'
import type { Element } from '@/types'

type Props = {
  contextMenu: { x: number; y: number; elementId: string | null } | null
  elements: Element[]
  selectedElementIds: string[]
  t: (key: string, ...args: unknown[]) => string
  onGroup: () => void
  onUngroup: () => void
  onMergeLayers: (mode: 'selected' | 'visible') => void
  onLayerAction: (elementId: string, action: 'forward' | 'backward' | 'front' | 'back') => void
  onRasterizeSelection: () => void
}

export function ContextMenuOverlay({ contextMenu, elements, selectedElementIds, t, onGroup, onUngroup, onMergeLayers, onLayerAction, onRasterizeSelection }: Props) {
  if (!contextMenu) return null
  const hasDrawableSelection = elements.some(el => selectedElementIds.includes(el.id) && el.type !== 'image' && el.type !== 'video')
  const isGroupable = selectedElementIds.length > 1
  const isUngroupable = selectedElementIds.length === 1 && elements.find(el => el.id === selectedElementIds[0])?.type === 'group'

  return (
    <div style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-30 bg-white rounded-md shadow-lg border border-gray-200 text-sm py-1 text-gray-800" onContextMenu={e => e.stopPropagation()}>
      {isGroupable && <button onClick={onGroup} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.group')}</button>}
      {isGroupable && <button onClick={() => onMergeLayers('selected')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.mergeLayers')}</button>}
      {isUngroupable && <button onClick={onUngroup} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.ungroup')}</button>}
      {(isGroupable || isUngroupable) && <div className="border-t border-gray-100 my-1"></div>}
      {contextMenu.elementId && (
        <>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'forward')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.bringForward')}</button>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'backward')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.sendBackward')}</button>
          <div className="border-t border-gray-100 my-1"></div>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'front')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.bringToFront')}</button>
          <button onClick={() => onLayerAction(contextMenu.elementId!, 'back')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.sendToBack')}</button>
        </>
      )}
      {hasDrawableSelection && (
        <>
          <div className="border-t border-gray-100 my-1"></div>
          <button onClick={onRasterizeSelection} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.rasterize')}</button>
        </>
      )}
    </div>
  )
}

