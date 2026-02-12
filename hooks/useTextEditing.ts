import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Element } from '@/types';

export interface EditingElementState {
  id: string;
  text: string;
}

export interface UseTextEditingOptions {
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
  setElements: (updater: (prev: Element[]) => Element[], commit?: boolean) => void;
  elementsRef: MutableRefObject<Element[]>;
}

export interface UseTextEditingResult {
  editingElement: EditingElementState | null;
  setEditingElement: (value: EditingElementState | null) => void;
  editingTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  handleStopEditing: () => void;
}

export function useTextEditing(options: UseTextEditingOptions): UseTextEditingResult {
  const { commitAction, setElements, elementsRef } = options;
  const [editingElement, setEditingElement] = useState<EditingElementState | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleStopEditing = useCallback(() => {
    if (!editingElement) return;
    commitAction(prev =>
      prev.map(el =>
        el.id === editingElement.id && el.type === 'text'
          ? { ...el, text: editingElement.text }
          : el.id === editingElement.id && el.type === 'text' && editingTextareaRef.current
            ? { ...el, text: editingElement.text, height: editingTextareaRef.current.scrollHeight }
            : el
      )
    );
    setEditingElement(null);
  }, [commitAction, editingElement]);

  const editingId = editingElement?.id;

  useEffect(() => {
    if (!editingId || !editingTextareaRef.current) return;
    setTimeout(() => {
      if (editingTextareaRef.current) {
        editingTextareaRef.current.focus();
        editingTextareaRef.current.select();
      }
    }, 0);
  }, [editingId]);

  useEffect(() => {
    if (editingElement && editingTextareaRef.current) {
      const textarea = editingTextareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = textarea.scrollHeight;
      textarea.style.height = '';
      const currentElement = elementsRef.current.find(el => el.id === editingElement.id);
      if (currentElement && currentElement.type === 'text' && currentElement.height !== newHeight) {
        setElements(prev =>
          prev.map(el =>
            el.id === editingElement.id && el.type === 'text'
              ? { ...el, height: newHeight }
              : el
          ),
          false
        );
      }
    }
  }, [editingElement, elementsRef, setElements]);

  return { editingElement, setEditingElement, editingTextareaRef, handleStopEditing };
}
