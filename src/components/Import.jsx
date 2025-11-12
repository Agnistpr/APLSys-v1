import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { MdClose } from "react-icons/md";

const ImportModal = ({ show, onClose, onImportComplete }) => {
  const [fileName, setFileName] = useState(null);
  const [mode, setMode] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [matchMethod, setMatchMethod] = useState("profileid");
  const [loading, setLoading] = useState(false);
  const [kioskRows, setKioskRows] = useState([]);
  const [flaggedRows, setFlaggedRows] = useState([]);
  const [nativePreviewRows, setNativePreviewRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    if (show) {
      setFileName(null);
      setMode(null);
      setCsvHeaders([]);
      setCsvData([]);
      setMapping({});
      setMatchMethod("profileid");
      setLoading(false);
      setKioskRows([]);
      setFlaggedRows([]);
      setNativePreviewRows([]);
    }
  }, [show]);

  const normalize = (s) =>
    (s || "").toString().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

  const titleCase = (s = "") =>
    s
      .toString()
      .split(" ")
      .filter(Boolean)
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
      .join(" ");

  const parseAmPmTo24 = (val) => {
    if (!val && val !== 0) return "";
    const s = String(val).trim();
    if (!s) return "";
    const hhmm24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (hhmm24) return `${String(hhmm24[1]).padStart(2, "0")}:${hhmm24[2]}`;
    const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/i);
    if (!ampm) return "";
    let hh = parseInt(ampm[1], 10);
    const mm = ampm[2] ? ampm[2] : "00";
    const suffix = ampm[3] ? ampm[3].toUpperCase() : null;
    if (suffix) {
      if (suffix === "AM" && hh === 12) hh = 0;
      if (suffix === "PM" && hh !== 12) hh += 12;
    }
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const format24ToAmPm = (hhmm) => {
    if (!hhmm) return "";
    const m = hhmm.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return hhmm;
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const period = hh >= 12 ? "PM" : "AM";
    hh = ((hh + 11) % 12) + 1;
    return `${hh}:${mm} ${period}`;
  };

  const excelSerialToISO = (serial) => {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const dateInfo = new Date((utc_value + (serial % 1) * 86400) * 1000);
    const yyyy = dateInfo.getUTCFullYear();
    const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dateInfo.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const normalizeDateToISO = (val) => {
    if (val === null || val === undefined || String(val).trim() === "") return null;
    if (typeof val === "number") {
      try {
        return excelSerialToISO(val);
      } catch (e) {
        return null;
      }
    }
    const s = String(val).trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let mmn = parseInt(m[1], 10);
      let dd = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      return `${String(y).padStart(4, "0")}-${String(mmn).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const dt = new Date(s);
    if (!isNaN(dt)) {
      const y = dt.getFullYear();
      const mmn = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      return `${y}-${mmn}-${dd}`;
    }
    return null;
  };

  const formatDateForDisplay = (val) => {
    if (!val && val !== 0) return "";
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
      try {
        const d = new Date(val + "T00:00:00");
        if (!isNaN(d)) {
          return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
        }
      } catch {}
    }
    if (typeof val === "number") {
      try {
        const iso = excelSerialToISO(val);
        const d = new Date(iso + "T00:00:00");
        return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      } catch {}
    }
    const dt = new Date(String(val));
    if (!isNaN(dt)) return dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    return String(val);
  };

  const looksLikeDate = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "number") return true;
    const s = String(v).trim();
    if (!s) return false;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) return true;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
    const first = s.split(/\s+/)[0];
    const d = new Date(first);
    return !isNaN(d);
  };

  const parseName = (raw) => {
    if (!raw) return { fullname: "" };

    let s = String(raw).replace(/\(.*?\)/g, "").trim();

    const fullname = s
      .split(/\s+/)
      .map(word => {
        if (word.endsWith(",")) {
          const clean = word.slice(0, -1);
          return clean[0]?.toUpperCase() + clean.slice(1).toLowerCase() + ",";
        } else {
          return word[0]?.toUpperCase() + word.slice(1).toLowerCase();
        }
      })
      .join(" ");

    return { fullname };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const ext = (file.name || "").split(".").pop().toLowerCase();

    if (ext === "csv") {
      setMode("native");
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const headers = Object.keys(res.data[0] || {});
          setCsvHeaders(headers);
          setCsvData(res.data);
          const auto = {};
          ["date", "timein", "timeout", "profileid", "role", "firstname", "lastname", "fullname"].forEach((k) => {
            const match = headers.find((h) => h.toLowerCase().trim() === k.toLowerCase().trim());
            if (match) auto[k] = match;
          });
          setMapping(auto);
        },
      });
      return;
    }

    if (ext === "xls" || ext === "xlsx") {
      setMode("kiosk");
      parseKioskFile(file);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = Object.keys(res.data[0] || {});
        setCsvHeaders(headers);
        setCsvData(res.data);
      },
    });
  };

  const parseKioskFile = async (file) => {
    setLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const workbook = XLSX.read(ab, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: true });

      const parsed = [];
      let currentName = null;

      const parseTime = (cell) => {
        if (cell === null || cell === undefined || String(cell).trim() === "") return "";
        const s = String(cell).trim();
        const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/i);
        if (!ampm) return "";
        let hh = parseInt(ampm[1], 10);
        const mm = ampm[2] ? ampm[2] : "00";
        const suffix = ampm[3] ? ampm[3].toUpperCase() : null;
        if (suffix) {
          if (suffix === "AM" && hh === 12) hh = 0;
          if (suffix === "PM" && hh !== 12) hh += 12;
        }
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      };

      const displayFrom24 = (hhmm) => (hhmm ? format24ToAmPm(hhmm) : "");

      const entries = [];
      for (let r = 0; r < raw.length; r++) {
        const row = raw[r] || [];
        const a = row[0] ?? "";
        if (String(a).trim() === "") continue;

        if (/[A-Z]/.test(String(a)) && String(a).includes(",") && String(a) === String(a).toUpperCase()) {
          currentName = parseName(a).fullname || currentName;
          continue;
        }

        if (!looksLikeDate(a)) {
          if (/[A-Za-z]/.test(String(a))) {
            currentName = parseName(a).fullname || currentName;
          }
          continue;
        }

        let isoDate = normalizeDateToISO(a);
        if (!isoDate && typeof a === "number") {
          try { isoDate = excelSerialToISO(a); } catch { isoDate = null; }
        }
        if (!isoDate) continue;

        const inColsIdx = [1, 3, 5];
        const outColsIdx = [2, 4, 6];

        const ins = inColsIdx
          .map(ci => parseTime(row[ci]))
          .filter(Boolean)
          .map(val => ({ val, hour: Number(val.split(":")[0]), used: false }));

        const outs = outColsIdx
          .map(ci => parseTime(row[ci]))
          .filter(Boolean)
          .map(val => ({ val, hour: Number(val.split(":")[0]), used: false }));

        entries.push({
          idx: r,
          dateRaw: a,
          dateISO: isoDate,
          ins,
          outs,
          name: currentName || "",
          rawRow: row,
        });
      }

      for (let i = 0; i < entries.length; i++) {
        const ent = entries[i];
        const earliestInObj = ent.ins.length
          ? ent.ins.reduce((acc, cur) => (cur.val < acc.val ? cur : acc), ent.ins[0])
          : null;

        if (!earliestInObj) continue;

        let chosenOut = null;
        if (ent.outs.length) {
          const availableOuts = ent.outs.filter(o => !o.used);
          if (availableOuts.length) {
            chosenOut = availableOuts.reduce((a, b) => (a.val > b.val ? a : b));
            chosenOut.used = true;
            parsed.push({
              fullname: ent.name,
              date: ent.dateISO,
              timein: displayFrom24(earliestInObj.val),
              timeout: displayFrom24(chosenOut.val),
            });
            continue;
          }
        }

        let found = false;
        for (let j = i + 1; j < entries.length; j++) {
          const nxt = entries[j];
          if (nxt.name !== ent.name) break;

          const availableNextOuts = nxt.outs.filter(o => !o.used);
          if (availableNextOuts.length) {
            const nextOutObj = availableNextOuts.reduce((a, b) => (a.val < b.val ? a : b));

            const inHour = earliestInObj.hour;
            const outHour = nextOutObj.hour;

            const isOvernight = inHour >= 15 && outHour <= 11;

            if (isOvernight) {
              nextOutObj.used = true;
              parsed.push({
                fullname: ent.name,
                date: ent.dateISO,
                timein: displayFrom24(earliestInObj.val),
                timeout: `${displayFrom24(nextOutObj.val)} (Next Day)`,
              });
              found = true;
            }
            break;
          }
        }

        if (!found) {
          parsed.push({
            fullname: ent.name,
            date: ent.dateISO,
            timein: displayFrom24(earliestInObj.val),
            timeout: "",
            _incomplete: true,
          });
        }
      }

      const byName = {};
      for (let r of parsed) {
        if (!r.fullname) continue;
        if (!byName[r.fullname]) byName[r.fullname] = [];
        byName[r.fullname].push(r);
      }

      for (const name of Object.keys(byName)) {
        const rows = byName[name];
        const last = rows[rows.length - 1];
        if (last && last._incomplete && !last.timeout) {
          const idx = parsed.indexOf(last);
          if (idx !== -1) parsed.splice(idx, 1);
        }
      }

      setKioskRows(parsed);
      setFlaggedRows(parsed.filter(r => r._incomplete));
    } catch (err) {
      console.error("Kiosk parse error", err);
      try { window.toast("Failed to parse XLS/XLSX file.", "error"); } catch {}
      setKioskRows([]);
      setFlaggedRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!csvData || !csvData.length) {
      setNativePreviewRows([]);
      return;
    }
    const build = csvData.map((row) => {
      const out = {
        date: mapping.date ? (row[mapping.date] ?? "") : "",
        timein: mapping.timein ? (row[mapping.timein] ?? "") : "",
        timeout: mapping.timeout ? (row[mapping.timeout] ?? "") : "",
        profileid: mapping.profileid ? (row[mapping.profileid] ?? "") : "",
        role: mapping.role ? (row[mapping.role] ?? "") : "",
        firstname: mapping.firstname ? (row[mapping.firstname] ?? "") : "",
        lastname: mapping.lastname ? (row[mapping.lastname] ?? "") : "",
        fullname: mapping.fullname ? (row[mapping.fullname] ?? "") : "",
      };
      return out;
    });

    const filtered = build.filter((r) => (r.timein && String(r.timein).trim()) || (r.timeout && String(r.timeout).trim()));
    setNativePreviewRows(filtered.slice(0, 200));
  }, [csvData, mapping]);

  const handleMappingChange = (dbCol, csvCol) => setMapping((prev) => ({ ...prev, [dbCol]: csvCol }));

  const previewRows = useMemo(
    () => (mode === "kiosk" ? kioskRows : nativePreviewRows),
    [mode, kioskRows, nativePreviewRows]
  );

  const handleRemoveFlagged = () => {
    if (mode !== "kiosk") return;
    const cleaned = kioskRows.filter(r => !r._incomplete);
    setKioskRows(cleaned);
    setFlaggedRows([]);
    try { window.toast("Problematic rows removed"); } catch {}
  };

const handleApplyFix = async () => {
  if (mode !== "kiosk") return;

  const valid = kioskRows.filter(r => !r._incomplete);

  const rows = valid.map(r => {
    const isNextDay = /\(Next Day\)/i.test(r.timeout || "");
    const cleanTimeout = (r.timeout || "").replace(/\s*\(Next Day\)/i, "").trim();

    return {
      fullname: r.fullname?.trim(),
      date: r.date,
      timein: parseAmPmTo24(r.timein),
      timeout: parseAmPmTo24(cleanTimeout),
      nextday: isNextDay,
    };
  });

  if (rows.length === 0) {
    window.toast("No valid rows to import", "error");
    return;
  }

  try {
    const result = await window.utilityAPI.importAttendance(rows);

    if (result.error) {
      window.toast(`Import failed: ${result.error}`, "error");
    } else {
      const { inserted = 0, skipped = 0 } = result;
      if (inserted === 0 && skipped > 0) {
        window.toast(`All ${skipped} rows skipped (duplicates)`, "error");
      } else if (skipped > 0) {
        window.toast(`Imported ${inserted} rows (${skipped} duplicates skipped)`, "success");
      } else {
        window.toast(`Successfully imported ${inserted} rows`, "success");
      }
    }

    if (onImportComplete) await onImportComplete(rows);
  } catch (err) {
    console.error(err);
    window.toast("Failed to import attendance", "error");
  }
};

  if (!show) return null;

  return (
    <div
      className="modalOverlay"
      onClick={(e) =>
        e.target.classList.contains("modalOverlay") && onClose()
      }
    >
      <div className="modalContent" role="dialog" aria-modal="true">
        <div className="modalHeader">
          <h3 className="importHeader">Import Attendance Data</h3>
          <button className="closeBtn" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <hr className="modalDivider" />

        {loading ? (
          <div className="loadingContainer">
            <div className="spinner" />
            <p>Processing...</p>
          </div>
        ) : (
          <>
            <label htmlFor="fileInput" className="importLabel">
              Select file (CSV or XLS/XLSX):
            </label>
            <input
              id="fileInput"
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileUpload}
            />

            {/* --- Mode Tabs --- */}
            {fileName && (
              <div className="modeTabs">
                {["native", "kiosk"].map((m) => (
                  <button
                    key={m}
                    className={`matchTab modeTab ${mode === m ? "active" : ""}`}
                    onClick={() => setMode(m)}
                    style={{ marginRight: 6 }}
                  >
                    {m === "native" ? "Native (CSV)" : "Kiosk (XLS)"}
                  </button>
                ))}
              </div>
            )}

            {/* --- Native Match Tabs --- */}
            {mode === "native" && csvHeaders.length > 0 && (
              <div className="matchTabs" style={{ marginTop: 10 }}>
                {[
                  { key: "profileid", label: "ID + Role" },
                  { key: "first_last", label: "First + Last Name" },
                  { key: "full_name", label: "Full Name" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setMatchMethod(t.key)}
                    className={`matchTab ${matchMethod === t.key ? "active" : ""}`}
                    style={{ marginRight: 6 }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* --- Preview Table --- */}
            {previewRows && previewRows.length > 0 ? (
              <div className="tableWrapper" style={{ marginTop: 12 }}>
                <div
                  className="tableContainer"
                  style={{
                    overflowX: "auto",
                    overflowY: "auto",
                    maxHeight: "60vh",
                    border: "1px solid #eee",
                    borderRadius: 6,
                  }}
                >
                  <table
                    className="tabTable"
                    style={{
                      minWidth: 800,
                      borderCollapse: "collapse",
                      width: "100%",
                    }}
                  >
                    <thead>
                      <tr>
                        {mode === "native" ? (
                          <>
                            {["date", "timein", "timeout"].map((col) => (
                              <th key={col} style={{ padding: 8, minWidth: 120 }}>
                                <select
                                  value={mapping[col] || ""}
                                  onChange={(e) =>
                                    handleMappingChange(col, e.target.value)
                                  }
                                  style={{ width: "100%" }}
                                >
                                  <option value="">
                                    {col === "date"
                                      ? "Date"
                                      : col === "timein"
                                      ? "Time In"
                                      : "Time Out"}
                                  </option>
                                  {csvHeaders.map((h) => (
                                    <option
                                      key={h}
                                      value={h}
                                      disabled={
                                        Object.values(mapping).includes(h) &&
                                        mapping[col] !== h
                                      }
                                    >
                                      {h}
                                    </option>
                                  ))}
                                </select>
                              </th>
                            ))}
                            {matchMethod === "profileid" &&
                              ["profileid", "role"].map((col) => (
                                <th key={col} style={{ padding: 8, minWidth: 120 }}>
                                  <select
                                    value={mapping[col] || ""}
                                    onChange={(e) =>
                                      handleMappingChange(col, e.target.value)
                                    }
                                    style={{ width: "100%" }}
                                  >
                                    <option value="">
                                      {col === "profileid"
                                        ? "Profile ID"
                                        : "Role"}
                                    </option>
                                    {csvHeaders.map((h) => (
                                      <option
                                        key={h}
                                        value={h}
                                        disabled={
                                          Object.values(mapping).includes(h) &&
                                          mapping[col] !== h
                                        }
                                      >
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </th>
                              ))}
                            {matchMethod === "first_last" &&
                              ["firstname", "lastname"].map((col) => (
                                <th key={col} style={{ padding: 8, minWidth: 120 }}>
                                  <select
                                    value={mapping[col] || ""}
                                    onChange={(e) =>
                                      handleMappingChange(col, e.target.value)
                                    }
                                    style={{ width: "100%" }}
                                  >
                                    <option value="">
                                      {col === "firstname"
                                        ? "First Name"
                                        : "Last Name"}
                                    </option>
                                    {csvHeaders.map((h) => (
                                      <option
                                        key={h}
                                        value={h}
                                        disabled={
                                          Object.values(mapping).includes(h) &&
                                          mapping[col] !== h
                                        }
                                      >
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </th>
                              ))}
                            {matchMethod === "full_name" && (
                              <th style={{ padding: 8, minWidth: 160 }}>
                                <select
                                  value={mapping["fullname"] || ""}
                                  onChange={(e) =>
                                    handleMappingChange("fullname", e.target.value)
                                  }
                                  style={{ width: "100%" }}
                                >
                                  <option value="">Full Name</option>
                                  {csvHeaders.map((h) => (
                                    <option
                                      key={h}
                                      value={h}
                                      disabled={
                                        Object.values(mapping).includes(h) &&
                                        mapping["fullname"] !== h
                                      }
                                    >
                                      {h}
                                    </option>
                                  ))}
                                </select>
                              </th>
                            )}
                          </>
                        ) : (
                          <>
                            <th style={{ padding: 8 }}>Date</th>
                            <th style={{ padding: 8 }}>Time In</th>
                            <th style={{ padding: 8 }}>Time Out</th>
                            <th style={{ padding: 8 }}>Full Name</th>
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {previewRows.slice(0, 1000).map((row, i) => (
                        <tr
                          key={i}
                          style={{
                            borderTop: "1px solid #f0f0f0",
                            background: row._incomplete ? "rgba(255, 0, 0, 0.1)" : undefined,
                          }}
                        >
                          <td style={{ padding: 8 }}>
                            {mode === "kiosk"
                              ? formatDateForDisplay(row.date)
                              : row.date}
                          </td>
                          <td style={{ padding: 8 }}>{row.timein}</td>
                          <td style={{ padding: 8, position: "relative" }}>
                            {editingCell?.index === i && editingCell?.field === "timeout" ? (
                              <input
                                type="text"
                                autoFocus
                                style={{
                                  width: "80px",
                                  fontSize: "0.9rem",
                                  padding: "2px 4px",
                                }}
                                defaultValue={row.timeout}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  setKioskRows((prev) =>
                                    prev.map((r, idx) =>
                                      idx === i ? { ...r, timeout: val, _incomplete: !val } : r
                                    )
                                  );
                                  setEditingCell(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.target.blur();
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                              />
                            ) : row.timeout ? (
                              row.timeout
                            ) : (
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button
                                  style={{
                                    background: "#e9e9ff",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    padding: "1px 4px",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => setEditingCell({ index: i, field: "timeout" })}
                                >
                                  Edit
                                </button>
                                <button
                                  style={{
                                    background: "#ffeaea",
                                    border: "1px solid #f5b5b5",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    padding: "1px 4px",
                                    color: "#b00",
                                    cursor: "pointer",
                                  }}
                                  onClick={() =>
                                    setKioskRows((prev) => prev.filter((_, idx) => idx !== i))
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>

                          {mode === "native" ? (
                            <>
                              {matchMethod === "profileid" && (
                                <>
                                  <td style={{ padding: 8 }}>{row.profileid}</td>
                                  <td style={{ padding: 8 }}>{row.role}</td>
                                </>
                              )}
                              {matchMethod === "first_last" && (
                                <>
                                  <td style={{ padding: 8 }}>{row.firstname}</td>
                                  <td style={{ padding: 8 }}>{row.lastname}</td>
                                </>
                              )}
                              {matchMethod === "full_name" && (
                                <td style={{ padding: 8 }}>{row.fullname}</td>
                              )}
                            </>
                          ) : (
                            <td style={{ padding: 8 }}>{row.fullname}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* --- Footer buttons --- */}
                <div
                  className="modalFooter"
                  style={{ marginTop: 10, display: "flex", gap: 8 }}
                >
                  {mode === "kiosk" && kioskRows.length > 0 && (
                    <>
                      <button className="actionBtn" onClick={handleApplyFix}>
                        Import
                      </button>
                    </>
                  )}
                  {mode === "native" && (
                    <button
                      className="actionBtn"
                      onClick={async () => {
                        try {
                          const result = await window.utilityAPI.importAttendance(nativePreviewRows);
                          if (result.error) {
                            window.toast(`Import failed: ${result.error}`, "error");
                          } else {
                            const { inserted = 0, skipped = 0 } = result;
                            if (inserted === 0 && skipped > 0) {
                              window.toast(`All ${skipped} rows skipped (duplicates)`, "error");
                            } else if (skipped > 0) {
                              window.toast(`Imported ${inserted} rows (${skipped} duplicates skipped)`, "success");
                            } else {
                              window.toast(`Successfully imported ${inserted} rows`, "success");
                            }
                          }
                        } catch (err) {
                          logMessage.error(err);
                          window.toast("❌ Failed to import attendance", "error");
                        }

                        if (onImportComplete) await onImportComplete(nativePreviewRows);
                      }}
                    >
                      Import
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="noRowsNotice" style={{ marginTop: 12 }}>
                <p style={{ color: "#666" }}>
                  No parsed rows yet. Upload a CSV or XLS/XLSX file and map the
                  columns (Native), or switch to Kiosk for timesheet parsing.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;