import { useCallback } from 'react'
import type React from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import type { Element, ImageElement, Point, Tool } from '@/types'
import { fileToDataUrl } from '@/utils/fileUtils'
import { resizeBase64ToMax } from '@/utils/image'

type Deps = {
  svgRef: MutableRefObject<SVGSVGElement | null>
  getCanvasPoint: (x: number, y: number) => Point
  setElements: (updater: (prev: Element[]) => Element[]) => void
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>
  setActiveTool: Dispatch<SetStateAction<Tool>>
  setError: Dispatch<SetStateAction<string | null>>
  generateId: () => string
}

export function useDragImport({ svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, generateId }: Deps) {
  const handleAddImageElement = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.')
      return
    }
    setError(null)
    try {
      const { dataUrl, mimeType } = await fileToDataUrl(file)
      const resized = await resizeBase64ToMax(dataUrl, mimeType, 2048, 2048)
      const usedDataUrl = resized && resized.scale < 1 ? `data:${mimeType};base64,${resized.base64}` : dataUrl
      const img = new Image()
      img.onload = () => {
        if (!svgRef.current) return
        const svgBounds = svgRef.current.getBoundingClientRect()
        const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 }
        const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y)
        const newImage: ImageElement = {
          id: generateId(),
          type: 'image',
          name: file.name,
          x: canvasPoint.x - img.width / 2,
          y: canvasPoint.y - img.height / 2,
          width: img.width,
          height: img.height,
          href: usedDataUrl,
          mimeType,
          opacity: 100,
        }
        setElements(prev => [...prev, newImage])
        setSelectedElementIds([newImage.id])
        setActiveTool('select')
      }
      img.src = usedDataUrl
    } catch (err) {
      setError('Failed to load image.')
      console.error(err)
    }
  }, [svgRef, getCanvasPoint, setElements, setSelectedElementIds, setActiveTool, setError, generateId])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAddImageElement(e.dataTransfer.files[0])
    }
  }, [handleAddImageElement])

  return { handleAddImageElement, handleDragOver, handleDrop }
}
