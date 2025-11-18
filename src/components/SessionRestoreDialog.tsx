import React from 'react'

interface Props {
  onContinue: () => void
  onNew: () => void
  lastName?: string
  lastTime?: number
}

export const SessionRestoreDialog: React.FC<Props> = ({ onContinue, onNew, lastName, lastTime }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onNew}>
      <div className="pod-panel p-4 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg" style={{ color: 'var(--text-heading)', fontWeight: 600 }}>发现上次图版</h3>
          <button className="pod-icon-button" onClick={onNew}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
          <div>上次活动图版：{lastName || '未命名'}</div>
          <div>保存时间：{lastTime ? new Date(lastTime).toLocaleString() : '-'}</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button className="pod-primary-button flex-1" onClick={onContinue}>继续上次图版</button>
          <button className="pod-chip flex-1" onClick={onNew}>打开新图版</button>
        </div>
      </div>
    </div>
  )
}