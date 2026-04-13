interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  open,
  title = "确认操作",
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
  danger = false,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <div className="flex border-t border-slate-100">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            {cancelText}
          </button>
          <div className="w-px bg-slate-100" />
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
              danger
                ? "text-red-600 hover:bg-red-50"
                : "text-primary hover:bg-indigo-50"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
