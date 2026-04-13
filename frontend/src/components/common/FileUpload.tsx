import { useRef, useState } from "react";
import { uploadFile } from "../../api/upload";

interface Props {
  accept?: string;
  onUploaded: (url: string, filename: string) => void;
  label?: string;
  className?: string;
}

export default function FileUpload({ accept, onUploaded, label = "选择文件", className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadFile(file, setProgress);
      onUploaded(res.file_url, res.filename);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "上传失败，请重试";
      setError(msg);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={uploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-60 transition-colors"
      >
        {uploading ? (
          <>
            <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            上传中 {progress}%
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {label}
          </>
        )}
      </button>
      {uploading && (
        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
