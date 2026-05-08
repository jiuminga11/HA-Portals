import { useCallback, useMemo, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import type { RichTextContent } from "../../types";
import { uploadFile } from "../../api/upload";

interface Props {
  content: RichTextContent;
  onChange: (content: RichTextContent) => void;
}

export default function RichTextEditor({ content, onChange }: Props) {
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await uploadFile(file);
        const quill = quillRef.current?.getEditor();
        if (quill) {
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", res.file_url);
          quill.setSelection(range.index + 1, 0);
        }
      } catch {
        alert("图片上传失败，请重试");
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [2, 3, false] }],
          ["bold", "italic"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler,
        },
      },
    }),
    [imageHandler]
  );

  const formats = ["header", "bold", "italic", "list", "bullet", "link", "image"];

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={content.body}
        onChange={(val) => onChange({ body: val })}
        modules={modules}
        formats={formats}
        placeholder="在此输入内容..."
        style={{ minHeight: "300px" }}
      />
    </div>
  );
}
