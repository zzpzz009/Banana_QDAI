import React from 'react';

interface SessionRestoreDialogProps {
  onContinue: () => void;
  onNew: () => void;
  lastName: string;
  lastTime: number;
}

export const SessionRestoreDialog: React.FC<SessionRestoreDialogProps> = ({
  onContinue,
  onNew,
  lastName,
  lastTime,
}) => {
  const date = new Date(lastTime);
  const formattedTime = date.toLocaleString();

  const title = lastName || '未命名画布';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md pod-rounded-xl border border-slate-700 bg-slate-900/95 p-6 shadow-xl backdrop-blur">
        <h2 className="mb-2 text-lg font-semibold text-slate-50">
          继续上次的创作？
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-slate-300">
          上次编辑的画布
          <span className="mx-1 font-medium text-slate-50">「{title}」</span>
          ，时间
          <span className="ml-1 tabular-nums text-slate-200">
            {formattedTime}
          </span>
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700 active:bg-slate-800"
            onClick={onNew}
          >
            开始新画布
          </button>
          <button
            type="button"
            className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-yellow-300 active:bg-yellow-400"
            onClick={onContinue}
          >
            继续上次
          </button>
        </div>
      </div>
    </div>
  );
};
