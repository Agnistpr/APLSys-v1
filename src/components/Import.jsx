import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import { MdClose } from "react-icons/md";

const ImportModal = ({ show, onClose, onImportComplete }) => {
  const [dbColumns, setDbColumns] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [matchMethod, setMatchMethod] = useState("employeeid");

  useEffect(() => {
    if (show) {
      setDbColumns([]);
      setCsvData([]);
      setCsvHeaders([]);
      setMapping({});
      setLoading(false);

      (async () => {
        const cols = await window.attendanceAPI.getAttendanceColumns();
        const filtered = (cols || []).filter(
          (col) => col.toLowerCase() !== "attendanceid"
        );
        setDbColumns(filtered);
      })();
    }
  }, [show]);

  useEffect(() => {
    if (!csvHeaders.length) return;

    const autoMap = {};
    let extraCols = [];

    if (matchMethod === "first_last") {
      extraCols = ["firstname", "lastname"];
    } else if (matchMethod === "full_name") {
      extraCols = ["fullname"];
    } else if (matchMethod === "employeeid") {
      extraCols = ["employeeid"];
    }

    for (const dbCol of [...dbColumns, ...extraCols]) {
      const match = csvHeaders.find(
        (h) => h.toLowerCase() === dbCol.toLowerCase()
      );
      if (match) autoMap[dbCol] = match;
    }

    setMapping(autoMap);
  }, [matchMethod, csvHeaders, dbColumns]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = Object.keys(results.data[0] || {});
        setCsvHeaders(headers);
        setCsvData(results.data);

        const autoMap = {};
        let extraCols = [];

        if (matchMethod === "first_last") {
          extraCols = ["firstname", "lastname"];
        } else if (matchMethod === "full_name") {
          extraCols = ["fullname"];
        } else if (matchMethod === "employeeid") {
          extraCols = ["employeeid"];
        }

        for (const dbCol of [...dbColumns, ...extraCols]) {
          const match = headers.find(
            (h) => h.toLowerCase() === dbCol.toLowerCase()
          );
          if (match) autoMap[dbCol] = match;
        }

        setMapping(autoMap);
      },
    });
  };

  const handleMappingChange = (dbCol, csvCol) => {
    setMapping((prev) => ({ ...prev, [dbCol]: csvCol }));
  };

  const handleConfirmImport = async () => {
    if (!csvData.length) return window.toast("No CSV data to import.", "error");
    setLoading(true);

    try {
      let mappedData = csvData.map((row) => {
        const mapped = {};
        for (const [dbCol, csvCol] of Object.entries(mapping)) {
          mapped[dbCol] = row[csvCol] || "";
        }
        return mapped;
      });

      if (matchMethod !== "employeeid") {
        const employees = await window.employeeAPI.getEmployees();
        const normalize = (s) =>
          (s || "").toLowerCase().replace(/[.,]/g, "").trim();

        mappedData = mappedData.map((row) => {
          let match = null;

          if (matchMethod === "first_last") {
            const first = normalize(row.firstname);
            const last = normalize(row.lastname);
            match = employees.find((e) => {
              const [lname, fname] = e.name
                .split(",")
                .map((x) => normalize(x || ""));
              return lname === last && fname.startsWith(first);
            });
          } else if (matchMethod === "full_name") {
            const csvFull = normalize(
              row.fullname ||
                `${row.firstname || ""} ${row.middlename || ""} ${
                  row.lastname || ""
                }`
            );

            match = employees.find((e) => {
              const dbFull = normalize(e.name);
              const variants = [
                dbFull,
                dbFull.replace(",", ""),
                dbFull.split(",").reverse().join(" "),
              ].map((v) => normalize(v));

              return variants.some(
                (v) =>
                  v === csvFull ||
                  v.replace(/\s+/g, " ") === csvFull ||
                  v.includes(csvFull) ||
                  csvFull.includes(v)
              );
            });
          }

          if (match) row.employeeid = match.employeeid;
          return row;
        });

        const unmatched = mappedData.filter((r) => !r.employeeid);
        if (unmatched.length > 0) {
          window.toast(
            `${unmatched.length} record(s) could not match any employee.`,
            "warning"
          );
        }

        mappedData = mappedData.filter((r) => r.employeeid);
      }

      const res = await window.importAPI.importAttendance(mappedData);

      if (res.success) {
        if (res.inserted === 0) {
          window.toast("All rows were duplicates.", "error");
        } else {
          window.toast(
            `Imported ${res.inserted} ${res.type || "attendance"} record${
              res.inserted === 1 ? "" : "s"
            } successfully.`,
            "success"
          );
        }

        onImportComplete();
        onClose();
      } else {
        window.toast(`Import failed: ${res.error}`, "error");
      }
    } catch (err) {
      window.toast(`Unexpected error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredColumns = () => {
    const baseCols = dbColumns.filter(
      (c) => c.toLowerCase() !== "employeeid"
    );

    if (matchMethod === "first_last") {
      return Array.from(new Set([...baseCols, "firstname", "lastname"]));
    }

    if (matchMethod === "full_name") {
      return Array.from(new Set([...baseCols, "fullname"]));
    }

    if (matchMethod === "employeeid") {
      return Array.from(new Set([...baseCols, "employeeid"]));
    }

    return baseCols;
  };


  if (!show) return null;

  return (
    <div
      className="modalOverlay"
      onClick={(e) =>
        e.target.classList.contains("modalOverlay") && onClose()
      }
    >
      <div className="modalContent">
        <div className="modalHeader">
          <h3>Import Attendance Data</h3>
          <button className="closeBtn" onClick={onClose}>
            <MdClose />
          </button>
        </div>
        <hr className="modalDivider" />

        {loading ? (
          <div className="loadingContainer">
            <div className="spinner"></div>
            <p>Importing data...</p>
          </div>
        ) : (
          <>
            <label htmlFor="csvUpload" className="importLabel">
              Select CSV File:
            </label>
            <input
              type="file"
              id="csvUpload"
              accept=".csv"
              onChange={handleFileUpload}
            />

            {csvHeaders.length > 0 && (
              <>
                <h4>Choose Employee Matching Method</h4>

                {/* 🔹 Tabs instead of select */}
                <div className="matchTabs">
                  {[
                    { key: "employeeid", label: "Employee ID" },
                    { key: "first_last", label: "First + Last Name" },
                    { key: "full_name", label: "Full Name" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      className={`matchTab ${
                        matchMethod === tab.key ? "active" : ""
                      }`}
                      onClick={() => setMatchMethod(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <table className="tabTable">
                  <thead>
                    <tr>
                      <th>Database Field</th>
                      <th>CSV Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredColumns().map((col) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td>
                          <select
                            value={mapping[col] || ""}
                            onChange={(e) =>
                              handleMappingChange(col, e.target.value)
                            }
                          >
                            <option value="">-- Choose --</option>
                            {csvHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="modalFooter">
                  <button
                    className="actionBtn"
                    onClick={handleConfirmImport}
                    disabled={loading}
                  >
                    Import
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImportModal;
