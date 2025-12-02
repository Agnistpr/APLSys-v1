import React, { useEffect, useState, useMemo, useRef } from "react";
import { FiSearch } from "react-icons/fi";
import { MdClear } from "react-icons/md";
import { FaFilter, FaFolderOpen, FaCheck } from "react-icons/fa";
import { batchProcessFolder, searchOcrResults } from '../api/ocr';
import { toast } from "sonner";
import { useOcrStore } from '../electron/ocrStore';
import { API_BASE_URL } from '../../config';

const Management = ({ onTaskStart, onTaskEnd }) => {
  const { docs, setDocs, setProcessingMap, batchId, setBatchId, ocrMatches, setOcrMatches } = useOcrStore();
  const selectedFolder = useOcrStore(s => s.selectedFolder); // <<< new: ensure we know which folder is active
  // global flag setter used to show/hide global OCR processing state
  const setGlobalProcessing = useOcrStore(s => s.setProcessing);
  // subscribe to processingMap and derive context flags
  const processingMap = useOcrStore(s => s.processingMap || {});
  const batchProcessing = Boolean(Object.keys(processingMap).some(k => String(k).startsWith('batch:')));
  const scannerProcessing = Boolean(Object.keys(processingMap).some(k => String(k).startsWith('scanner:')));
  // keep any global overlay separate if you still use it
  const globalProcessing = useOcrStore(s => s.isProcessing);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [jumpPage, setJumpPage] = useState("");
  const filterRef = useRef(null);
  const isOpeningFolder = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState(new Set()); // <<< new
  const columnLabelMap = { type: "Type" };
  const PROCESSING_STATE_KEY = "documentProcessingState";
  const scanToastId = `scan:${Date.now()}`;
  const OPEN_FOLDER_TOAST = "open-folder";

  // helper to call backend create-task
  const createServerTask = async (payload) => {
   const resp = await fetch(`${API_BASE_URL}/ocr/create-task`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(payload),
   });
   if (!resp.ok) {
     const text = await resp.text().catch(() => "");
     throw new Error(`create-task failed: ${resp.status} ${text}`);
   }
   return resp.json();
};

  const handleFolderOpen = async () => {
    if (isOpeningFolder.current) return;
    isOpeningFolder.current = true;

    try {
      const picked = await window.fileAPI.openFolder();

      // Electron dialog: if cancelled, picked may be { canceled: true }
      if (!picked || (picked && picked.canceled === true)) {
        isOpeningFolder.current = false;
        return;
      }

      let pickedPath = "";
      if (typeof picked === "string" && picked) pickedPath = picked;
      else if (Array.isArray(picked) && picked.length > 0) pickedPath = picked[0];
      else if (picked?.filePaths?.length) pickedPath = picked.filePaths[0];
      else if (picked?.path) pickedPath = picked.path;

      // If user cancelled, pickedPath will be empty or falsy
      if (!pickedPath) {
        isOpeningFolder.current = false;
        return;
      }

      const folderName = String(pickedPath).split(/[\\/]/).pop() || pickedPath;

      toast.dismiss(OPEN_FOLDER_TOAST);
      toast.loading(`Opening ${folderName}. Please wait`, {
        id: OPEN_FOLDER_TOAST,
        icon: "⏳",
        dismissible: true
      });

      // update store now
      useOcrStore.getState().setSelectedFolder(pickedPath);

      await new Promise(r => setTimeout(r, 50));

      const newDocs = await window.fileAPI.listDocuments();
      setDocs(newDocs);

      toast.success(`Opened: ${folderName}`, {
        id: OPEN_FOLDER_TOAST,
        description: pickedPath,
        icon: "✅",
        dismissible: true,
        duration: 10000
      });

    } catch (err) {
      toast.error("Failed to open folder", {
        id: OPEN_FOLDER_TOAST,
        description: String(err)
      });
    } finally {
      isOpeningFolder.current = false;
    }
  };

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const docsList = await window.fileAPI.listDocuments();

        // preserve processing state for files that are mid-scan
        const updated = docsList.map(d => ({
          ...d,
          isProcessed: d.isProcessed || false,
         }));
         setDocs(updated);

        // Log once on the initial fetch when the page mounts / when user navigates back
        if (!fetchDocs.__loggedOnce) {
          // use store snapshot to show current processing map
          const storeProcessing = useOcrStore.getState().processingMap || {};
          console.log("Docs loaded (mount):", docsList.length, "Processing map:", storeProcessing);
          fetchDocs.__loggedOnce = true;
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        toast.error("Failed to load documents");
      }
    };


    fetchDocs();

    // Optional: Set up polling to refresh document list periodically
    const interval = setInterval(fetchDocs, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, []); 

  // Restore saved spinner state immediately at mount
  // Update the restore effect to validate against ocr_results and isProcessed flag
useEffect(() => {
  const restoreState = async () => {
    try {
      const raw = localStorage.getItem(PROCESSING_STATE_KEY);
      if (!raw) return;
      
      const parsed = JSON.parse(raw);
      const savedMap = parsed?.processingMap ?? {};

      // Only show spinners if:
      // 1. File exists in docs
      // 2. Not already processed (no OCR result)
      // 3. Has an active task ID in pendingMap
      const ocrResults = new Set(
        (await window.fileAPI.readDirectory("ocr_results") || [])
          .map(f => f.replace(".json", ""))
      );

      const pendingMap = JSON.parse(localStorage.getItem("batchOcr:pendingMap") || "{}");
      
      const validatedMap = {};
      let hasValid = false;

      Object.keys(savedMap).forEach(key => {
        // Keys may be prefixed (e.g. "batch:foo.pdf"); normalize to bare filename
        const filename = key && String(key).startsWith("batch:") ? String(key).replace(/^batch:/, "") : String(key);
        // Skip if OCR result exists or no pending task
        if (ocrResults.has(filename) || !pendingMap[filename]) return;
        
        const doc = docs.find(d => normalizeName(d.name) === filename);
        if (doc && !doc.isProcessed) {
          // store validated map with batch: prefix to indicate this is a batch job
          validatedMap[`batch:${filename}`] = true;
          hasValid = true;
        }
      });

      if (hasValid) {
        setProcessingMap(validatedMap);
      } else {
        // No valid pending files - clean up
        localStorage.removeItem(PROCESSING_STATE_KEY);
        localStorage.removeItem("batchOcr:pendingMap");
        setProcessingMap({});
      }

    } catch (err) {
      console.warn("Failed to restore state:", err);
    }
  };

  restoreState();
}, [docs]); // Run when docs list changes

  // small helper: normalize file keys for map/localStorage comparisons
  const normalizeName = (n) => {
    if (!n) return "";
    return String(n).trim();
  };

  useEffect(() => {
  // Create a stable reference to the handler function
  const handleOcrProgress = (e) => {
    const evt = e?.detail ?? e;
    const rawFilename = evt?.filename || "";
    const rawParent = evt?.parent || "";
    const filename = normalizeName(rawFilename);
    const parent = normalizeName(rawParent);
    const { status, task_id } = evt || {};

    if (filename) {
      if (status === "started") {
        // Use a batch-prefixed key so scanner and batch tasks don't collide
        const batchKey = `batch:${filename}`;
        // Check if file is already in processing state to avoid duplicate "started" notifications
        const currentProcessing = useOcrStore.getState().processingMap || {};
        if (currentProcessing[batchKey]) {
          return; // Skip if already processing
        }
        // mark the actual event filename as started (namespaced)
        setProcessingMap(prev => ({ ...prev, [batchKey]: true }));

        // persist with normalized, namespaced key
        try {
          const raw = localStorage.getItem(PROCESSING_STATE_KEY);
          const stored = raw ? JSON.parse(raw) : { batchId: useOcrStore.getState().batchId, processingMap: {} };
          stored.processingMap = { ...(stored.processingMap || {}), [batchKey]: true };
          localStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify(stored));
        } catch (err) { /* noop */ }
        
        toast(`${filename}: Started`, {
          id: task_id,
          description: "Scanning has started, you can close this while it runs.",
          icon: "⏳",
          dismissible: true,
          duration: 10000,
        });
      } else if (status === "done") {
        // Dismiss any existing toasts for this file first
        toast.dismiss(`ocr-${filename}`);

        setProcessingMap(prev => {
          const next = { ...prev };
          // Remove namespaced batch keys (and fall back to bare keys for backward compatibility)
          const batchKey = `batch:${filename}`;
          const parentBatchKey = parent ? `batch:${parent}` : null;
          if (batchKey && next[batchKey]) delete next[batchKey];
          if (parentBatchKey && next[parentBatchKey]) delete next[parentBatchKey];
          if (filename && next[filename]) delete next[filename];
          if (parent && next[parent]) delete next[parent];
          return next;
        });

        // Update docs to mark as processed
        const currentDocs = useOcrStore.getState().docs || [];
        const updatedDocs = currentDocs.map(doc => {
          const docName = normalizeName(doc.name);
          if (docName === filename || docName === parent) {
            return { ...doc, isProcessed: true };
          }
          return doc;
        });
        setDocs(updatedDocs);
        //Notify as done
        toast.success(`${filename} parsed successfully.`, {
            id: task_id,
            description: `${filename} has been scanned successfully.`,
            icon: "✅",
            dismissible: true,
            duration: 10000,
          });
        
        // Clear from localStorage
        try {
          const raw = localStorage.getItem(PROCESSING_STATE_KEY);
          const stored = raw ? JSON.parse(raw) : {};
          if (stored.processingMap) {
            // Remove namespaced keys from persisted map
            delete stored.processingMap[`batch:${filename}`];
            if (parent) delete stored.processingMap[`batch:${parent}`];
            // Also remove legacy bare keys if present
            delete stored.processingMap[filename];
            if (parent) delete stored.processingMap[parent];
          }
          if (Object.keys(stored.processingMap || {}).length === 0) {
            localStorage.removeItem(PROCESSING_STATE_KEY);
          } else {
            localStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify(stored));
          }
        } catch (err) {
          console.warn("Failed to update storage:", err);
        }
      } else if (status === "error") {
        // clean up map for both keys
        setProcessingMap(prev => {
          const next = { ...prev };
          const batchKey = `batch:${filename}`;
          const parentBatchKey = parent ? `batch:${parent}` : null;
          if (batchKey && next[batchKey]) delete next[batchKey];
          if (parentBatchKey && next[parentBatchKey]) delete next[parentBatchKey];
          if (filename && next[filename]) delete next[filename];
          if (parent && next[parent]) delete next[parent];
          return next;
        });
        toast(`${filename} failed to extract.`, {
            id: task_id,
            description: `${filename} was not scanned correctly. Please try again later.`,
            icon: "❌",
            dismissible: true,
            duration: 10000,
          });
      }
    } else if (status === "all_done") {
      setProcessingMap({});
      setBatchId(null);
      localStorage.removeItem(PROCESSING_STATE_KEY);
      window.fileAPI.listDocuments().then(setDocs);
      onTaskEnd(task_id);
      toast.success("All files have been processed", {id: scanToastId, description: "Done", duration: 4000 });
    }
  };

  // Add single event listener with stable handler reference
  window.addEventListener("app:ocr-progress", handleOcrProgress);
  
  return () => {
    window.removeEventListener("app:ocr-progress", handleOcrProgress);
  };
}, []);

  const uniqueValues = useMemo(() => {
    const values = { type: new Set() };
    if (Array.isArray(docs)) {
      docs.forEach((row) => {
        values.type.add(row.type || "");
      });
    }
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

      if (!query) {
        setOcrMatches({}); // Clear matches
        return;
      }


      try{
      // call OCR search and annotate docs
        const matches = await searchOcrResults(query);
        console.log("OCR search results for", { query, matches, matchedFiles: matches.map(m => m.filename) });

        // Store matches in separate state
        const matchSet = new Set(matches.map(m => normalizeName(m.filename)));
        const newMatches = {};
        docs.forEach(doc => {
          const normalized = normalizeName(doc.name);
          if (matchSet.has(normalized)) {
            newMatches[normalized] = true;
          }
        });
        setOcrMatches(newMatches);
      } 
      catch (err)
      {
        console.error("OCR search failed:", err);
        toast.error("Word Search failed");
        setOcrMatches({});
      }
      return;
    }
    // Clear OCR matches for non-OCR searches
    setOcrMatches({});
  };

  // Updated processFolderOcr: construct optimistic map with normalized names
  const processFolderOcr = async () => {
    try {
      // set both local and global flags
      setIsProcessing(true);
      setGlobalProcessing(true);

      const docsList = await window.fileAPI.listDocuments();
      setDocs(docsList);

      // Check for unprocessed files BEFORE showing any toast
      const allowedExts = new Set(["png", "jpg", "jpeg", "tif", "tiff", "bmp", "pdf"]);
      const pathsToProcess = docsList
        .filter(doc => !doc.isProcessed && allowedExts.has((doc.type || "").toLowerCase()))
        .map(doc => ({ path: doc.path, name: doc.name }));

      if (pathsToProcess.length === 0) {
        toast("No new files to process", {
          id: "scan:none",
          description: "All files in this page have been scanned.",
          dismissible: true,
          duration: 10000,
        });
        
        setIsProcessing(false);
        setGlobalProcessing(false);
        return;
      }

      const filenames = pathsToProcess.map(p => normalizeName(p.name));

      // Build initial processing map from freshly fetched docsList using namespaced batch keys
      const initialProcessingMap = {};
      filenames.forEach(name => {
        const doc = docsList.find(d => normalizeName(d.name) === name);
        if (doc && !doc.isProcessed) {
          initialProcessingMap[`batch:${name}`] = true;
        }
      });

      // Merge with existing store map once (avoid duplicate declarations)
      const storeState = useOcrStore.getState();
      const mergedOptimistic = { ...(storeState.processingMap || {}), ...initialProcessingMap };
      setProcessingMap(mergedOptimistic);

      // persist optimistic state with normalized keys (no batch id yet)
      localStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify({
        batchId: null,
        processingMap: mergedOptimistic
      }));

      // Create batch task
      const batchResp = await createServerTask({
        task_type: "batch_ocr",
        files: filenames,
        details: { total_files: filenames.length }
      });

      const batchTaskId = batchResp?.task_id;
      if (!batchTaskId) throw new Error("No batch task id returned from server");
      setBatchId(batchTaskId);

      // Only show "Scanning..." toast if we actually have files to process
      toast("Scanning all files...", {
        id: scanToastId,
        description: "Scanning all files, you can close this while it runs.",
        icon: "⏳",
        dismissible: true,
        duration: 10000,
      });

      // Create per-file tasks
      const fileTaskMap = {};
      for (let i = 0; i < filenames.length; i++) {
        const name = filenames[i];
        const fileResp = await createServerTask({
          task_type: "ocr_file",
          filename: name,
          details: { batch_id: batchTaskId, index: i + 1 }
        });
        fileTaskMap[name] = fileResp?.task_id || null;
      }

      // Persist per-file task map and inflight batch id immediately
      try {
        localStorage.setItem("batchOcr:pendingMap", JSON.stringify(fileTaskMap));
        localStorage.setItem("batchOcr:inflight", String(batchTaskId));
      } catch (err) {
        console.warn("Failed to persist pendingMap/inflight:", err);
      }

      // Update persisted optimistic state with real batch id
      localStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify({
        batchId: batchTaskId,
        processingMap: mergedOptimistic
      }));

      // Start worker
      const workerResponse = await window.fileAPI.startBatchOcr({
        files: pathsToProcess.map(p => p.path),
        batch_task_id: batchTaskId
      });

      if (!workerResponse?.success) {
        throw new Error(workerResponse?.error || "Failed to start OCR worker");
      }

      // Merge worker-confirmed processing files (if present) with optimistic map
      const actualMap = { ...mergedOptimistic };
      if (Array.isArray(workerResponse.processing_files) && workerResponse.processing_files.length > 0) {
        workerResponse.processing_files.forEach(fname => {
          actualMap[`batch:${normalizeName(fname)}`] = true;
        });
      }

      // set the confirmed batch keys; Sidebar and Management will derive batchProcessing from these
      setProcessingMap(actualMap);
      localStorage.setItem(PROCESSING_STATE_KEY, JSON.stringify({
        batchId: batchTaskId,
        processingMap: actualMap
      }));

      // log after worker confirms start (one-time)
      console.log("Batch OCR worker running. processingMap:", actualMap);

      if (typeof onTaskStart === "function") onTaskStart(batchTaskId, { type: "batch_ocr", files: filenames });

    } catch (err) {
      console.error("Failed to start OCR process:", err);
      toast.error(err.message || "Failed to start OCR process");
      setProcessingMap({});
      localStorage.removeItem(PROCESSING_STATE_KEY);
      setBatchId(null);
    } finally {
      setIsProcessing(false);
      // don't clear globalProcessing here because scanner may still be running;
      // global overlay should be computed from store or cleared only when appropriate
      window.fileAPI.listDocuments().then(setDocs);
    }
  };

  // Toggle selection helpers
  const toggleSelectDoc = (name) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      const key = normalizeName(name);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = (select) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      filtered.forEach(d => {
        const k = normalizeName(d.name);
        if (select) next.add(k);
        else next.delete(k);
      });
      return next;
    });
  };

  // New: scan only selected documents
  const processSelectedOcr = async () => {
    if (!selectedDocs || selectedDocs.size === 0) {
      toast("No files selected", { description: "Choose files to scan or use Scan all files." });
      return;
    }

    try {
      setIsProcessing(true);
      setGlobalProcessing(true);

      // refresh docs list
      const docsList = await window.fileAPI.listDocuments();
      setDocs(docsList);

      const allowedExts = new Set(["png","jpg","jpeg","tif","tiff","bmp","pdf"]);
      // Build pathsToProcess for selected items that are not already processed
      const pathsToProcess = docsList
        .filter(doc => selectedDocs.has(normalizeName(doc.name)) && !doc.isProcessed && allowedExts.has((doc.type||"").toLowerCase()))
        .map(doc => ({ path: doc.path, name: doc.name }));

      if (pathsToProcess.length === 0) {
        toast("No selected files to process", { description: "Selected files are either processed or unavailable." });
        setIsProcessing(false);
        setGlobalProcessing(false);
        return;
      }

      // Build optimistic processing map & persist
      const filenames = pathsToProcess.map(p => normalizeName(p.name));
      const initialProcessingMap = {};
      filenames.forEach(name => initialProcessingMap[`batch:${name}`] = true);
      const storeState = useOcrStore.getState();
      const mergedOptimistic = { ...(storeState.processingMap || {}), ...initialProcessingMap };
      setProcessingMap(mergedOptimistic);
      localStorage.setItem("documentProcessingState", JSON.stringify({ batchId: null, processingMap: mergedOptimistic }));

      // Create batch task on server
      const batchResp = await createServerTask({ task_type: "batch_ocr", files: filenames, details: { total_files: filenames.length }});
      const batchTaskId = batchResp?.task_id;
      if (!batchTaskId) throw new Error("No batch task id returned from server");
      setBatchId(batchTaskId);

      // create per-file tasks (same as processFolderOcr)
      const fileTaskMap = {};
      for (let i = 0; i < filenames.length; i++) {
        const name = filenames[i];
        const fileResp = await createServerTask({
          task_type: "ocr_file",
          filename: name,
          details: { batch_id: batchTaskId, index: i + 1 }
        });
        fileTaskMap[name] = fileResp?.task_id || null;
      }

      try {
        localStorage.setItem("batchOcr:pendingMap", JSON.stringify(fileTaskMap));
        localStorage.setItem("batchOcr:inflight", String(batchTaskId));
      } catch (err) { /* noop */ }

      // Confirm optimistic state with worker
      localStorage.setItem("documentProcessingState", JSON.stringify({ batchId: batchTaskId, processingMap: mergedOptimistic }));

      const workerResponse = await window.fileAPI.startBatchOcr({
        files: pathsToProcess.map(p => p.path),
        batch_task_id: batchTaskId
      });
      if (!workerResponse?.success) throw new Error(workerResponse?.error || "Failed to start OCR worker");

      // Merge confirmed processing files
      const actualMap = { ...mergedOptimistic };
      if (Array.isArray(workerResponse.processing_files)) {
        workerResponse.processing_files.forEach(fname => actualMap[`batch:${normalizeName(fname)}`] = true);
      }
      setProcessingMap(actualMap);
      localStorage.setItem("documentProcessingState", JSON.stringify({ batchId: batchTaskId, processingMap: actualMap }));

      if (typeof onTaskStart === "function") onTaskStart(batchTaskId, { type: "batch_ocr", files: filenames });
    } catch (err) {
      console.error("Failed to start OCR process for selection:", err);
      toast.error(err.message || "Failed to start OCR process");
      setProcessingMap({});
      localStorage.removeItem("documentProcessingState");
      setBatchId(null);
    } finally {
      setIsProcessing(false);
      window.fileAPI.listDocuments().then(setDocs);
    }
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64, mimeFallback = "application/octet-stream") => {
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
    // Ensure docs is an array before filtering
      if (!Array.isArray(docs)) {
        return [];
      }
    return docs.filter((row) => {

      if (searchTerm.startsWith('=')) { //OCR search query
        const normalized = normalizeName(row.name);
        const hasMatch = Boolean(ocrMatches[normalized]);
        console.log(`Filtering "${row.name}": ocrMatch=${hasMatch}`);
        return hasMatch;
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
  }, [docs, searchTerm, selectedFilters, ocrMatches]);

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
             {/* Button: open/select folder */}
            <button 
                className="openFolderBtn" 
                onClick={handleFolderOpen}
              >
                <FaFolderOpen />
                {/* Open Folder */}
            </button>
            <button
              className="ocrProcessBtn"
              onClick={processFolderOcr}
              // block only when a batch is already running (or local prepare state)
              disabled={batchProcessing || isProcessing}
              title={batchProcessing ? "Batch OCR running" : isProcessing ? "Preparing batch OCR" : "Scan all files"}
            >
              {batchProcessing ? 'Processing...' : isProcessing ? 'Preparing...' : 'Scan all files'}
            </button>
            <button
              className="ocrProcessBtn"
              onClick={processSelectedOcr}
              disabled={selectedDocs.size === 0 || batchProcessing || isProcessing}
              title={selectedDocs.size === 0 ? "Select files to scan" : "Scan only selected files"}
              style={{ marginLeft: 8 }}
            >
              {isProcessing ? 'Processing...' : `Scan Selected (${selectedDocs.size})`}
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
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every(d => selectedDocs.has(normalizeName(d.name)))}
                    onChange={(e) => selectAllVisible(e.target.checked)}
                  />
                </th>
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
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(normalizeName(doc.name))}
                        onChange={(e) => { e.stopPropagation(); toggleSelectDoc(doc.name); }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td>
                      {doc.name}
                      {(processingMap[`batch:${normalizeName(doc.name)}`] || processingMap[normalizeName(doc.name)]) && (
                        <span className="inlineSpinner" title="Scanning..." />
                      )}
                      {doc.isProcessed && (
                        <FaCheck style={{ color: "#2ea44f", marginLeft: 8 }} title="Scanned" />
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
                  const files = await window.fileAPI.selectFile({ type: "all", multi: true });
                  if (!files) return;

                  for (const file of files) {
                    // pass explicit customDir to guarantee the file lands in the currently selected folder
                    await window.fileAPI.saveFileToFolder({ sourcePath: file, customDir: selectedFolder || undefined });
                    console.log("[Management] saved file ->", file, "to", selectedFolder || "(default documents)");
                  }

                  // small delay to ensure FS settled (saves are sync but keep a short tick for UI race conditions)
                  await new Promise((r) => setTimeout(r, 120));
                  toast("Refreshing...");
                  const refreshed = await window.fileAPI.listDocuments();
                  setDocs(refreshed);
                  console.log("[Management] refreshed docs after upload:", refreshed.length);
                  toast.success("Files added to folder", { description: `${files.length} file(s) copied` });
                } catch (err) {
                  console.error("Upload failed:", err);
                  toast.error("Upload failed", { description: String(err) });
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
