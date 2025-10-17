import React, { useState, useEffect } from "react";
import { parseResumeFromPdf } from "../lib/parse-resume-from-pdf";
import {
  getHasUsedAppBefore,
  saveStateToLocalStorage,
} from "../lib/redux/local-storage";
import { type ShowForm, initialSettings } from "../lib/redux/settingsSlice";
import { cx } from "../lib/cx";
import { deepClone } from "../lib/deep-clone";
import { useNavigate } from "react-router-dom";
import {toast} from "sonner";

const defaultFileState = {
  name: "",
  size: 0,
  fileUrl: "",
};

export const ResumeDropzone = ({
  onFileUrlChange,
  className,
  playgroundView = false,
  initialFileUrl,
  initialFileName = "",
  fallbackFileUrl,
}: {
  // allow optional File param so the parent can read the DOCX without fetching the blob URL
  onFileUrlChange: (fileUrl: string, fileName: string, file?: File) => void;
  className?: string;
  playgroundView?: boolean;
  initialFileUrl?: string;
  initialFileName?: string;
  fallbackFileUrl?: string;
}) => {
  const [file, setFile] = useState(defaultFileState);
  const [isHoveredOnDropzone, setIsHoveredOnDropzone] = useState(false);
  const [hasNonPdfFile, setHasNonPdfFile] = useState(false);

  const navigate = useNavigate();
  const hasFile = Boolean(file.name);

  

  useEffect(() => {
    if (initialFileUrl) {
      setFile({
        name: initialFileName || "resume.pdf",
        size: 0,
        fileUrl: initialFileUrl,
      });
      onFileUrlChange(initialFileUrl, initialFileName || "resume.pdf");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setNewFile = (newFile: File) => {
    if (file.fileUrl) {
      URL.revokeObjectURL(file.fileUrl);
    }
    const { name, size } = newFile;
    const fileUrl = URL.createObjectURL(newFile);
    setFile({ name, size, fileUrl });
    // pass the File object to the parent so it can safely read it (no fetch / no navigation)
    onFileUrlChange(fileUrl, name, newFile);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
  event.preventDefault();
  const newFile = event.dataTransfer.files[0];
  const validTypes = ['.pdf', '.docx'];
  const fileExtension = newFile.name.substring(newFile.name.lastIndexOf('.')).toLowerCase();

  if (!validTypes.includes(fileExtension)) {
    setHasNonPdfFile(true);
    toast.error("Invalid file type", {
      description: "Please upload only PDF or DOCX files.",
      action: {
        label: "Dismiss",
        onClick: () => {}
      },
      duration: 3000
    });
    return;
  }

  setHasNonPdfFile(false);
  setNewFile(newFile);
  setIsHoveredOnDropzone(false);
};

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const newFile = event.target.files?.[0];
  if (!newFile) return;

  // Enhanced file type validation
  const validTypes = ['.pdf'];
  const fileExtension = newFile.name.substring(newFile.name.lastIndexOf('.')).toLowerCase();
  
  if (!validTypes.includes(fileExtension)) {
    setHasNonPdfFile(true);
    // Show error toast
    toast.error("Invalid file type", {
      description: "Please upload only PDF files.",
      action: {
        label: "Dismiss",
        onClick: () => {}
      },
      duration: 3000
    });
    
    // Reset input
    event.target.value = '';
    return;
  }

  setHasNonPdfFile(false);

  // Clean up previous URL if it exists
  if (file.fileUrl) {
    URL.revokeObjectURL(file.fileUrl);
  }

  // Create new URL and update state
  const fileUrl = URL.createObjectURL(newFile);
  setFile({
    name: newFile.name,
    size: newFile.size,
    fileUrl: fileUrl,
  });

  // Call parent callback with new file URL, name and File object
  onFileUrlChange(fileUrl, newFile.name, newFile);
};

  const onRemove = () => {
    setFile(defaultFileState);
    onFileUrlChange(
      fallbackFileUrl,
      fallbackFileUrl.split(/[\\/]/).pop() || "template.pdf"
    );
  };

  const onImportClick = async () => {
    const resume = await parseResumeFromPdf(file.fileUrl);
    const settings = deepClone(initialSettings);

    if (getHasUsedAppBefore()) {
      const sections = Object.keys(settings.formToShow) as ShowForm[];
      const sectionToFormToShow: Record<ShowForm, boolean> = {
        workExperiences: resume.workExperiences.length > 0,
        educations: resume.educations.length > 0,
        projects: resume.projects.length > 0,
        skills: resume.skills.descriptions.length > 0,
        custom: resume.custom.descriptions.length > 0,
      };
      for (const section of sections) {
        settings.formToShow[section] = sectionToFormToShow[section];
      }
    }

    saveStateToLocalStorage({ resume, settings });
    navigate("/resume-parser");
  };

  return (
    <div
      className={cx(
        "flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6",
        isHoveredOnDropzone && "border-sky-400",
        playgroundView ? "pb-6 pt-4" : "py-12",
        className
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsHoveredOnDropzone(true);
      }}
      onDragLeave={() => setIsHoveredOnDropzone(false)}
      onDrop={onDrop}
    >
      <div
        className={cx("text-center", playgroundView ? "space-y-2" : "space-y-3")}
      >
        {!hasFile ? (
          <>
            <label
              className={cx(
                "within-outline-theme-purple cursor-pointer rounded-full px-6 pb-2.5 pt-2 font-semibold shadow-sm",
                playgroundView ? "border" : "bg-primary"
              )}
            >
              <input
                type="file"
                className="sr-only"
                accept=".pdf"
                onChange={onInputChange}
              />
            </label>
            {hasNonPdfFile && (
              <p className="mt-6 text-red-400">Only PDF files are supported</p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="outline-theme-blue rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
              title="Remove file"
              onClick={onRemove}
            >
              X
            </button>
            <span className="font-semibold text-gray-900">{file.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
