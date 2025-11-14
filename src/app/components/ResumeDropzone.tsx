import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { cx } from "../lib/cx";

const defaultFileState = {
  name: "",
  size: 0,
  fileUrl: "",
  ownBlob: false,
};

type ResumeDropzoneProps = {
  onFileUrlChange: (fileUrl: string, fileName: string, file?: File) => void;
  className?: string;
  playgroundView?: boolean;
  initialFileUrl?: string;
  initialFileName?: string;
  fallbackFileUrl?: string;
  currentFile?: {
    name: string;
    url: string;
    type: string;
    data?: string;
  };
};

export const ResumeDropzone: React.FC<ResumeDropzoneProps> = ({
  onFileUrlChange,
  className,
  playgroundView = false,
  initialFileUrl,
  initialFileName = "",
  fallbackFileUrl,
  currentFile,
}) => {
  const [file, setFile] = useState(defaultFileState);
  const [isHoveredOnDropzone, setIsHoveredOnDropzone] = useState(false);
  const [hasNonPdfFile, setHasNonPdfFile] = useState(false);

  const hasFile = Boolean(file.name);
  const displayFileName = currentFile?.name || initialFileName || file.name || "No file chosen";

  // cleanup blob URLs - Prevent race conditions by delaying revocation
  useEffect(() => {
    // Only revoke object URLs that this component created (ownBlob === true).
    return () => {
      try {
        if (file.ownBlob && file.fileUrl?.startsWith("blob:")) {
          // Add a small delay to ensure no pending operations reference this URL
          const url = file.fileUrl;
          setTimeout(() => {
            try {
              URL.revokeObjectURL(url);
              console.log("Revoked blob URL:", url);
            } catch (e) {
              // ignore revoke errors
            }
          }, 100);
        }
      } catch (e) {
        // ignore any revoke errors
      }
    };
  }, [file.fileUrl]);

  // initialize from props
  useEffect(() => {
    if (initialFileUrl) {
      setFile({
        name: initialFileName || "resume.pdf",
        size: 0,
        fileUrl: initialFileUrl,
        ownBlob: false,
      });
      onFileUrlChange(initialFileUrl, initialFileName || "resume.pdf");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentFile?.name && currentFile?.url) {
      setFile({
        name: currentFile.name,
        size: 0,
        fileUrl: currentFile.url,
        ownBlob: false,
      });
    }
  }, [currentFile?.name, currentFile?.url]);

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = event.target.files?.[0];
    if (!newFile) return;

    const validTypes = [".pdf", ".png", ".jpg", ".jpeg", ".docx"];
    const ext = newFile.name.substring(newFile.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      setHasNonPdfFile(true);
      toast.error("Invalid file type", {
        description: "Please upload PDF, image (PNG/JPG), or DOCX files.",
        duration: 3000,
      });
      event.target.value = "";
      return;
    }

    setHasNonPdfFile(false);
    if (file.ownBlob && file.fileUrl?.startsWith("blob:")) {
      try { URL.revokeObjectURL(file.fileUrl); } catch {}
    }

    const blobUrl = URL.createObjectURL(newFile);
    setFile({ name: newFile.name, size: newFile.size, fileUrl: blobUrl, ownBlob: true });
    // Pass the File object as the third parameter so parent gets the MIME type
    onFileUrlChange(blobUrl, newFile.name, newFile);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const newFile = event.dataTransfer.files[0];
    if (!newFile) return;

    const validTypes = [".pdf", ".png", ".jpg", ".jpeg", ".docx"];
    const ext = newFile.name.substring(newFile.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      setHasNonPdfFile(true);
      toast.error("Invalid file type", {
        description: "Please upload PDF, image (PNG/JPG), or DOCX files.",
        duration: 3000,
      });
      return;
    }

    setHasNonPdfFile(false);
    if (file.ownBlob && file.fileUrl?.startsWith("blob:")) {
      try { URL.revokeObjectURL(file.fileUrl); } catch {}
    }
    const blobUrl = URL.createObjectURL(newFile);
    setFile({ name: newFile.name, size: newFile.size, fileUrl: blobUrl, ownBlob: true });
    // Pass the File object as the third parameter so parent gets the MIME type
    onFileUrlChange(blobUrl, newFile.name, newFile);
  };

  const onRemove = () => {
    if (file.ownBlob && file.fileUrl?.startsWith("blob:")) {
      try { URL.revokeObjectURL(file.fileUrl); } catch {}
    }
    setFile(defaultFileState);
    if (fallbackFileUrl) {
      onFileUrlChange(fallbackFileUrl, fallbackFileUrl.split(/[\\/]/).pop() || "template.pdf");
    } else {
      onFileUrlChange("", "");
    }
  };

  return (
    <div
      className={cx(
        "flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6",
        isHoveredOnDropzone && "border-sky-400",
        playgroundView ? "pb-6 pt-4" : "py-12",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsHoveredOnDropzone(true);
      }}
      onDragLeave={() => setIsHoveredOnDropzone(false)}
      onDrop={onDrop}
    >
      <div className="text-center space-y-3">
        {!hasFile ? (
          <>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={onInputChange} />
            {hasNonPdfFile && <p className="mt-2 text-red-500">Only PDF, PNG, JPG, and DOCX files supported</p>}
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              onClick={onRemove}
            >
              ✕
            </button>
            <span className="font-semibold text-gray-900">{displayFileName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
