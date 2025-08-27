import React, { useState, useEffect } from "react";
import { parseResumeFromPdf } from "lib/parse-resume-from-pdf";
import {
  getHasUsedAppBefore,
  saveStateToLocalStorage,
} from "lib/redux/local-storage";
import { type ShowForm, initialSettings } from "lib/redux/settingsSlice";
import { cx } from "lib/cx";
import { deepClone } from "lib/deep-clone";
import { useNavigate } from "react-router-dom";

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
  onFileUrlChange: (fileUrl: string, fileName: string) => void;
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
  }, [])

  const setNewFile = (newFile: File) => {
    if (file.fileUrl) {
      URL.revokeObjectURL(file.fileUrl);
    }
    const { name, size } = newFile;
    const fileUrl = URL.createObjectURL(newFile);
    setFile({ name, size, fileUrl });
    onFileUrlChange(fileUrl, name);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const newFile = event.dataTransfer.files[0];
    if (newFile.name.endsWith(".pdf")) {
      setHasNonPdfFile(false);
      setNewFile(newFile);
    } else {
      setHasNonPdfFile(true);
    }
    setIsHoveredOnDropzone(false);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const newFile = files[0];
    setNewFile(newFile);
  };

  const onRemove = () => {
    setFile(defaultFileState);
    onFileUrlChange(fallbackFileUrl, fallbackFileUrl.split(/[\\/]/).pop() || "template.pdf");
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
              <p className="mt-6 text-red-400">Only pdf file is supported</p>
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
