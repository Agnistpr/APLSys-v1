import React, { useEffect, useState, useMemo, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { MdClear } from "react-icons/md";
import { FaFilter } from "react-icons/fa";
import { FaFolderOpen } from "react-icons/fa";
import { batchProcessFolder, searchOcrResults } from '../api/ocr';
const Management = () => {
  const [docs, setDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [jumpPage, setJumpPage] = useState("");
  const filterRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMap, setProcessingMap] = useState({}); 
  const columnLabelMap = { type: "Type" };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docs = await window.fileAPI.listDocuments();
        setDocs(docs);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      }
    };
    fetchDocs();
  }, []);

  const uniqueValues = useMemo(() => {
    const values = { type: new Set() };
    docs.forEach((row) => {
      values.type.add(row.type || "");
    });
    return {
      type: Array.from(values.type),
    };
  }, [docs]);

  const clearFilters = () => setSelectedFilters({});
  const toggleFilterValue = (column, value) => {
    setSelectedFilters((prev) => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter((v) => v !== value)
        : [...colValues, value];
      return { ...prev, [column]: updated, __activeColumn: column };
    });
  };

  // Add OCR search handler
  const handleSearch = async (value) => {
    setSearchTerm(value);
    setCurrentPage(1);

    // OCR search syntax:
    // =WORD   or ="WORD"  or ='WORD'
    if (value && value.startsWith("=")) {
      // strip leading '=' and optional surrounding quotes
      let query = value.slice(1).trim();
      if (
        (query.startsWith('"') && query.endsWith('"')) ||
        (query.startsWith("'") && query.endsWith("'"))
      ) {
        query = query.slice(1, -1);
      }

      if (query.length === 0) {
        // empty query after '=' -> clear any ocrMatch flags
        setDocs(prevDocs => prevDocs.map(doc => ({ ...doc, ocrMatch: false })));
        return;
      }

      // call OCR search and annotate docs
      const matches = await searchOcrResults(query);
      const matchSet = new Set(matches.map(m => m.filename));
      setDocs(prevDocs =>
        prevDocs.map(doc => ({ ...doc, ocrMatch: matchSet.has(doc.name) }))
      );

      return;
    }
  };

  // Add batch OCR processing
  const processFolderOcr = async () => {
    try {
      setIsProcessing(true);

      // Allowed extensions for OCR
      const allowedExts = new Set([
        "pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp", "jpeg"
      ]);

      // Map extension -> mime for Blob creation
      const mimeMap = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        tif: "image/tiff",
        tiff: "image/tiff",
        bmp: "image/bmp"
      };

      // Get all documents from the current directory
      const docs = await window.fileAPI.listDocuments();
      const filesToProcess = [];

      // Convert file paths to File objects
      for (const doc of docs) {
        // Skip if file has already been OCR processed
        if (doc.isProcessed) {
          console.log(`[OCR] Skipping already-processed file: ${doc.name}`);
          continue;
        }

        const ext = (doc.type || "").toLowerCase();
        if (!allowedExts.has(ext)) {
          console.log(`[OCR] Skipping unsupported file type: ${doc.name} (.${ext || "unknown"})`);
          continue;
        }

        try {
          console.log(`[OCR] Reading file for OCR: ${doc.name} (${doc.path})`);
          // read file via IPC (returns base64 string)
          const base64 = await window.fileAPI.readFileAsBase64(doc.path);

          // convert base64 (raw) to Blob
          function base64ToBlobInline(b64, mime = "application/octet-stream") {
            const bstr = atob(b64);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new Blob([u8arr], { type: mime });
          }

          const mime = mimeMap[ext] || "application/octet-stream";
          const blob = base64ToBlobInline(base64, mime);
          const file = new File([blob], doc.name, { type: mime });
          
          // mark this file as processing (UI indicator)
          setProcessingMap(prev => ({ ...prev, [doc.name]: true }));
          
          filesToProcess.push(file);
          console.log(`[OCR] Queued file for upload: ${doc.name}`);
        } catch (err) {
          console.error(`[OCR] Failed to read/queue ${doc.name}:`, err);
        }
      }

      if (filesToProcess.length === 0) {
        console.log("[OCR] No new files to process");
        return;
      }

      console.log(`[OCR] Starting batch upload of ${filesToProcess.length} file(s)`);
      // Process the files (pass File[])
      const results = await batchProcessFolder(filesToProcess);
      console.log("[OCR] Batch OCR completed. Results:", results);

      // Log per-file results if available
      if (Array.isArray(results)) {
        results.forEach((r) => {
          if (r.error) {
            console.error(`[OCR] ${r.filename} -> error: ${r.error}`);
          } else {
            console.log(`[OCR] ${r.filename} -> processed`);
          }
          // clear processing indicator for this filename
          setProcessingMap(prev => ({ ...prev, [r.filename]: false }));
        });
      }

      // In case some files weren't returned in results (backend error), clear all queued flags after a short grace
      setTimeout(() => {
        setProcessingMap(prev => {
          const copy = { ...prev };
          filesToProcess.forEach(f => { copy[f.name] = false; });
          return copy;
        });
      }, 2000);

      // Refresh document list after processing
      const updatedDocs = await window.fileAPI.listDocuments();
      setDocs(updatedDocs);

    } catch (err) {
      console.error("OCR processing failed:", err);
      // clear any processing flags on top-level error
      setProcessingMap({});
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = useMemo(() => {
    return docs.filter((row) => {

      if (searchTerm.startsWith('=')) { //OCR search query
        const query = searchTerm.slice(2, -1);
        // This will be populated by searchOcrResults
        return row.ocrMatch;
      }


      const matchesSearch =
        row.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.type?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === "__activeColumn") return true;
        return values.length === 0 || values.includes(row[column] || "");
      });

      return matchesSearch && matchesFilters;
    });
  }, [docs, searchTerm, selectedFilters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  return (
    <div className="managementContainer">
      <div className="managementHeaderRow">
        <div className="managementHeader">
          <h1>Documents</h1>
             <button 
                className="openFolderBtn" 
                onClick={() => {
                    if (docs.length > 0) {
                    window.fileAPI.openFolder(docs[0].path);
                    }
                }}
                >
                <FaFolderOpen />
                {/* Open Folder */}
            </button>
            <button
            className="ocrProcessBtn"
            onClick={processFolderOcr}
            disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Scan all files'}
            </button>
        </div>

        <div className="managementControls">
          <div className="filterContainer" ref={filterRef}>
            <button className="filterBtn" onClick={() => setFilterOpen((p) => !p)}>
              <FaFilter />
            </button>

            {filterOpen && (
              <div className="filterDropdown">
                <div className="filterHeader">
                  <strong>Filter by</strong>
                  <button className="clearFilterBtn" onClick={clearFilters}>
                    Clear
                  </button>
                </div>
                <div className="filterColumns">
                  {["type"].map((col) => (
                    <div
                      key={col}
                      className={`filterColumnName ${
                        selectedFilters[col] ? "activeColumn" : ""
                      }`}
                      onClick={() => {
                        setSelectedFilters((prev) => ({
                          ...prev,
                          __activeColumn: prev.__activeColumn === col ? null : col,
                        }));
                      }}
                    >
                      {columnLabelMap[col]}
                      <span className="chevronIcon">&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filterOpen && selectedFilters.__activeColumn && (
              <div className="filterValuesPanel">
                <div className="filterValuesHeader">
                  {columnLabelMap[selectedFilters.__activeColumn]}
                </div>
                <div className="filterValuesList">
                  {uniqueValues[selectedFilters.__activeColumn]?.map((val, i) => (
                    <label key={i} className="filterValueItem">
                      <input
                        type="checkbox"
                        checked={
                          selectedFilters[selectedFilters.__activeColumn]?.includes(val) || false
                        }
                        onChange={() => toggleFilterValue(selectedFilters.__activeColumn, val)}
                      />
                      {val || "—"}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="searchContainer">
            <div className="searchWrapper" style={{ position: "relative", display: "inline-block" }}>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => {
                  handleSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <div className="searchTooltip">
                  (Use =&quot;text&quot; for looking for specific texts that is within documents)
                </div>
            </div>
            <button className="searchIconBtn">
              <FiSearch />
            </button>
            {searchTerm && (
              <button className="clearSearchBtn" onClick={() => setSearchTerm("")}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="docTableWrapper">
        <table className="docTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length > 0 ? (
              paginated.map((doc, idx) => (
                <tr
                  key={idx}
                  className="docRow"
                  onClick={() => window.fileAPI.openDocument(doc.path)}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    {doc.name}
                    {processingMap[doc.name] && (
                      <span className="inlineSpinner" title="Processing OCR" />
                    )}
                  </td>
                  <td>.{doc.type}</td>
                  <td>{doc.size}</td>
                  <td>{new Date(doc.date).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  No documents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="tableFooter">
          <div className="paginationItems">
            <label>Items: </label>
            <select
              value={itemsPerPage === docs.length ? "all" : itemsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setItemsPerPage(val === "all" ? docs.length : Number(val));
                setCurrentPage(1);
              }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="all">All</option>
            </select>
          </div>

          <div className="paginationPage">
            <button
              className="paginationBtn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              &lt;
            </button>

            {(() => {
              if (totalPages === 0) return null;

              const pages = [];
              if (totalPages <= 3) {
                for (let i = 1; i <= totalPages; i++) {
                  pages.push(i);
                }
              } else {
                if (currentPage <= 2) {
                  pages.push(1, 2, "ellipsis", totalPages);
                } else if (currentPage >= totalPages - 1) {
                  pages.push(1, "ellipsis", totalPages - 1, totalPages);
                } else {
                  pages.push(1, currentPage, "ellipsis", totalPages);
                }
              }

              return pages.map((page, idx) => {
                if (page === "ellipsis") {
                  return showJumpInput ? (
                    <input
                      key="jumpInput"
                      className="paginationJumpInput"
                      type="number"
                      min={1}
                      max={totalPages}
                      autoFocus
                      value={jumpPage}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || (/^\d+$/.test(val) && Number(val) <= totalPages)) {
                          setJumpPage(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const pageNum = Number(jumpPage);
                          if (pageNum >= 1 && pageNum <= totalPages) {
                            setCurrentPage(pageNum);
                            setShowJumpInput(false);
                            setJumpPage("");
                          }
                        } else if (e.key === "Escape") {
                          setShowJumpInput(false);
                          setJumpPage("");
                        }
                      }}
                      onBlur={() => {
                        setShowJumpInput(false);
                        setJumpPage("");
                      }}
                      placeholder="Page #"
                    />
                  ) : (
                    <span
                      key={`ellipsis-${idx}`}
                      className="paginationEllipsis"
                      onClick={() => setShowJumpInput(true)}
                      title="Jump to page"
                    >
                      {jumpPage !== "" ? jumpPage : "..."}
                    </span>
                  );
                } else {
                  return (
                    <button
                      key={page}
                      className={`paginationBtn ${currentPage === page ? "currentPage" : ""}`}
                      onClick={() => setCurrentPage(page)}
                      disabled={currentPage === page}
                    >
                      {page}
                    </button>
                  );
                }
              });
            })()}

            <button
              className="paginationBtn"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              &gt;
            </button>
            </div>
            <button
                className="uploadBtn"
                onClick={async () => {
                    try {
                    const files = await window.fileAPI.selectFile({ type: "documents", multi: true });
                    if (!files) return;

                    for (const file of files) {
                        await window.fileAPI.saveFileToFolder({ sourcePath: file });
                    }

                    const docs = await window.fileAPI.listDocuments();
                    setDocs(docs);
                    } catch (err) {
                    console.error("Upload failed:", err);
                    }
                }}
                >
                +
            </button>
        </div>
      )}
    </div>
  );
};

export default Management;
