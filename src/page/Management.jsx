import React, { useEffect, useState, useMemo, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { MdClear } from "react-icons/md";
import { FaFilter, FaFolderOpen, FaCheck } from "react-icons/fa";
import { batchProcessFolder, searchOcrResults } from '../api/ocr';
import { toast } from "sonner";

const PENDING_KEY = "batchOcr:pending";
const INFLIGHT_KEY = "batchOcr:inflight"; // <-- added

const Management = ({ onTaskStart, onTaskEnd }) => {
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
    setCurrentPage(1);
  }, [searchTerm, selectedFilters]);

  // load pending set from localStorage after docs are loaded
  useEffect(() => {
    const restorePending = async () => {
      try {
        // Restore pending spinner state from localStorage (do not consult /ocr/status)
        const raw = window.localStorage.getItem(PENDING_KEY);
        if (!raw) return;
        const pending = JSON.parse(raw || "[]");
        if (!Array.isArray(pending) || pending.length === 0) return;

        // fetch docs to consult isProcessed flags
        const docsList = await window.fileAPI.listDocuments();
        const ocrResults = new Set((await window.fileAPI.readDirectory('ocr_results') || []).map(f => f.replace('.json', '')));
        const map = {};
        let hasAnyPending = false;

        for (const name of pending) {
          const found = docsList.find(d => d.name === name);
          if (found && !ocrResults.has(name) && !found.isProcessed) {
            map[name] = true;
            hasAnyPending = true;
          } else {
            // cleanup stale entries
            removePending(name);
          }
        }

        if (!hasAnyPending) {
          // nothing pending anymore — clear inflight marker
          window.localStorage.removeItem(INFLIGHT_KEY);
          setProcessingMap({});
          return;
        }

        setProcessingMap(prev => ({ ...prev, ...map }));
      } catch (err) {
        console.warn("Failed to restore pending OCR set:", err);
        // don't aggressively wipe PENDING_KEY here; leave to explicit events or cleanup flows
      }
    };
    restorePending();
  }, []); // run once on mount

  // helper localStorage helpers
  const savePendingSet = (set) => {
    try {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  };
  const addPending = (name) => {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!arr.includes(name)) {
      arr.push(name);
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
      // ensure inflight marker exists so restore knows there's work
      if (!window.localStorage.getItem(INFLIGHT_KEY)) {
        window.localStorage.setItem(INFLIGHT_KEY, "1");
      }
    }
  };
  const removePending = (name) => {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw).filter((v) => v !== name);
    if (arr.length === 0) {
      window.localStorage.removeItem(PENDING_KEY);
      window.localStorage.removeItem(INFLIGHT_KEY);
    } else {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
    }
  };
  const clearPending = () => {
    window.localStorage.removeItem(PENDING_KEY);
    window.localStorage.removeItem(INFLIGHT_KEY);
  };

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
    // Fetch documents and restore spinner state from PENDING_KEY (do not clear pending on transient backend replies)
    const fetchDocs = async () => {
      try {
        const docsList = await window.fileAPI.listDocuments();
        setDocs(docsList);

        // Always try to restore spinner state from PENDING_KEY (safer/resilient to navigation)
        const raw = window.localStorage.getItem(PENDING_KEY);
        if (!raw) return;
        const pending = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
        if (pending.length === 0) return;

        const ocrResults = new Set((await window.fileAPI.readDirectory('ocr_results') || []).map(f => f.replace('.json', '')));
        const map = {};
        let any = false;
        for (const name of pending) {
          const doc = docsList.find(d => d.name === name);
          if (doc && !doc.isProcessed && !ocrResults.has(name)) {
            map[name] = true;
            any = true;
          } else {
            // cleanup stale entries
            removePending(name);
          }
        }
        if (any) {
          setProcessingMap(prev => ({ ...prev, ...map }));
        } else {
          // nothing pending anymore — clear inflight
          window.localStorage.removeItem(INFLIGHT_KEY);
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      }
    };
    fetchDocs();
  }, []); // Run on mount

  useEffect(() => {
    const restoreProcessingState = async () => {
      try {
        const batchTaskId = window.localStorage.getItem(INFLIGHT_KEY);
        if (!batchTaskId) return;

        const response = await fetch(`http://localhost:8000/ocr/tasks/${batchTaskId}`).catch(() => null);
        if (!response || !response.ok) {
          // backend might not be available / task may be managed by main-process — do not clear pending on transient errors
          return;
        }
        const { task } = await response.json();

        if (!task || task.status === "completed" || task.status === "failed") {
          // Clean up if task is done
          window.localStorage.removeItem(INFLIGHT_KEY);
          window.localStorage.removeItem(PENDING_KEY);
          setProcessingMap({});
          return;
        }

        // Restore processing state for files from backend task.details.files if present
        const pendingFiles = task.details?.files || [];
        const map = {};
        pendingFiles.forEach(filename => {
          const doc = docs.find(d => d.name === filename);
          if (doc && !doc.isProcessed) {
            map[filename] = true;
            addPending(filename); // ensure local storage includes it
          }
        });
        setProcessingMap(prev => ({ ...prev, ...map }));
      } catch (err) {
        console.warn("Failed to restore processing state:", err);
        // avoid wiping local pending state on errors
      }
    };

    restoreProcessingState();
  }, [docs]); // Re-run when docs list changes

  useEffect(() => {
  // Create a stable reference to the handler function
  const handleOcrProgress = (e) => {
    const evt = e?.detail ?? e;
    const { filename, status, task_id } = evt || {};
    
    if (filename) {
      if (status === "started") {
        setProcessingMap(prev => ({ ...prev, [filename]: true }));
        addPending(filename);
      } else if (status === "done" || status === "error") {
        setProcessingMap(prev => ({ ...prev, [filename]: false }));
        removePending(filename);
        if (status === "done") {
          window.fileAPI.listDocuments().then(setDocs);
        }
      }
    } else if (status === "all_done") {
      window.localStorage.removeItem(INFLIGHT_KEY);
      clearPending();
      setProcessingMap({});
      window.fileAPI.listDocuments().then(setDocs);
      onTaskEnd(task_id);
    }
  };

  // Add single event listener with stable handler reference
  window.addEventListener("app:ocr-progress", handleOcrProgress);
  
  // Remove the same handler reference on cleanup
  return () => {
    window.removeEventListener("app:ocr-progress", handleOcrProgress);
  };
}, []); // Empty deps since handler uses only stable functions

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
      toast.loading("Starting background OCR...", { id: "ocr-batch" });

      const allowedExts = new Set([
        "pdf", "png", "jpg", "jpeg", "tif", "tiff", "bmp"
      ]);

      // Get documents to process
      const docsList = await window.fileAPI.listDocuments();
      const pathsToProcess = docsList
        .filter(doc => {
          if (doc.isProcessed) return false;
          const ext = (doc.type || "").toLowerCase();
          return allowedExts.has(ext);
        })
        .map(doc => ({
          path: doc.path,
          name: doc.name
        }));

      if (pathsToProcess.length === 0) {
        toast("No new files to process", { id: "ocr-batch" });
        setIsProcessing(false);
        return;
      }

      // Create a batch task first
      const batchResponse = await fetch("http://localhost:8000/ocr/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "batch_ocr",
          files: pathsToProcess.map((p) => p.name),
          details: { total_files: pathsToProcess.length },
        }),
      });

      const batchData = await batchResponse.json().catch(() => ({}));
      if (!batchResponse.ok) {
        // include backend message if available
        throw new Error(batchData?.error || "Failed to create batch task");
      }

      // backend returns { task_id: number }
      const batchTaskId = batchData.task_id ?? batchData.task?.id;
      if (!batchTaskId) {
        throw new Error("No task_id returned from backend");
      }

      // notify app-level tracker
      onTaskStart(batchTaskId, { type: "batch_ocr", files: pathsToProcess.map(p => p.name) });

      // Start batch OCR via main process and pass backend task id so worker can update backend if desired
      const res = await window.fileAPI.startBatchOcr({
        files: pathsToProcess.map((p) => p.path),
        batch_task_id: batchTaskId,
      });

       if (!res || !res.success) {
        throw new Error(res?.error || "Failed to start batch OCR");
       }
 
       // Mark files as processing
      window.localStorage.setItem(INFLIGHT_KEY, String(batchTaskId));
       pathsToProcess.forEach(p => {
         setProcessingMap(prev => ({ ...prev, [p.name]: true }));
         addPending(p.name);
       });

    } catch (err) {
      console.error("Failed to start OCR process:", err);
      toast.error("Failed to start OCR process");
      setProcessingMap({});
      window.localStorage.removeItem(INFLIGHT_KEY);
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64, mimeFallback = "application/octet-stream") => {
    // Accept either "data:<mime>;base64,AAAA" or raw base64 "AAAA"
    let dataPart = base64;
    let mime = mimeFallback;

    if (typeof base64 !== "string") {
      throw new Error("base64ToBlob expects a string");
    }

    if (base64.startsWith("data:")) {
      const parts = base64.split(",");
      dataPart = parts[1] ?? "";
      const mimeMatch = base64.match(/data:([^;]+);base64,/);
      if (mimeMatch && mimeMatch[1]) mime = mimeMatch[1];
    } else {
      // raw base64: keep dataPart as-is, mime from fallback
      // If the string accidentally contains whitespace/newlines, clean them
      dataPart = base64.replace(/\s+/g, "");
    }

    // atob expects proper base64 string — wrap in try to provide clearer error
    let binaryString;
    try {
      binaryString = atob(dataPart);
    } catch (err) {
      console.error("base64ToBlob: invalid base64 data", { mime, snippet: dataPart?.slice?.(0,50) });
      throw err;
    }

    const n = binaryString.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = binaryString.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
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
                    {doc.isProcessed && (
                      <FaCheck style={{ color: "#2ea44f", marginLeft: 8 }} title="OCR processed" />
                    )}
                  </td>
                  <td>.{doc.type}</td>
                  <td>{doc.size}</td>
                  <td>{new Date(doc.date).toLocaleDateString()}</td>
                </tr>
              ))
            ): (
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
