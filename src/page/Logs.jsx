import React, { useEffect, useState, useMemo } from "react";
import { FiChevronRight } from "react-icons/fi";
import { MdEdit, MdAdd, MdDelete } from "react-icons/md";
import DatePicker from "../components/DatePicker.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const Logs = ({uid}) => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("logsDate") || "";
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  const columns = ["user", "action"];
  const columnLabelMap = { user: "User", action: "Action" };

  useEffect(() => {
    console.log("[Logs] Fetching logs for date:", selectedDate);
    const fetchLogs = async () => {
      const data = await window.utilityAPI.getLogs(selectedDate);
      console.log("[Logs] Received logs:", data);
      setLogs(data || []);
    };
    fetchLogs();
  }, [selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = { user: new Set(), action: new Set() };

    logs.forEach((r) => {
      values.user.add(r.username || "");

      if (r.useraction) {
        const short = r.useraction.split(" ")[0].toLowerCase();
        values.action.add(short.charAt(0).toUpperCase() + short.slice(1));
      }
    });

    return {
      user: Array.from(values.user),
      action: Array.from(values.action)
    };
  }, [logs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters, selectedDate]);

  const filtered = useMemo(() => {
    return logs.filter((row) => {
      const matchesSearch =
        row.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.useraction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        if (col === "__activeColumn") return true;
        const map = { user: "username", action: "useraction" };
        const field = map[col];

        if (col === "action") {
          const short = (row.useraction || "").split(" ")[0];
          const formatted = short.charAt(0).toUpperCase() + short.slice(1);
          return !vals?.length || vals.includes(formatted);
        }

        return !vals?.length || vals.includes(row[field] || "");
      });

      return matchesSearch && matchesFilters;
    });
  }, [logs, searchTerm, selectedFilters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const toggleExpand = (i) => {
    setExpandedLogs((prev) => {
      const s = new Set(prev);
      s.has(i) ? s.delete(i) : s.add(i);
      return s;
    });
  };

  const getActionIcon = (a) => {
    const x = a.toLowerCase();
    if (x.includes("edit")) return <MdEdit />;
    if (x.includes("add")) return <MdAdd />;
    if (x.includes("delete")) return <MdDelete />;
    if (x.includes("import")) return <MdAdd />;
    return <MdEdit />;
  };

  const formatLogDetails = (log) => `${log.username} ${log.useraction}`;

  const formatTimestamp = (d) => {
    const dateObj = new Date(d);
    return dateObj.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  return (
    <div className="logsContainer">
      <div className="logsHeaderRow">
        <div className="logsHeader">
          <h1>Logs</h1>
          <button
            className="exportBtn"
            onClick={async () => {
              try {
                const result = await window.exportAPI.exportLogs(selectedDate);
                console.log(uid);
                if (result.success) {
                  await window.userAPI.logAction(uid, "exported a copy of Logs");
                  window.toast("Logs exported successfully!", "success");
                  const data = await window.utilityAPI.getLogs(selectedDate);
                  setLogs(data || []);
                } else {
                  window.toast(result.message || "Export failed", "error");
                }
              } catch (err) {
                console.error("Export error:", err);
                window.toast("An error occurred during export", "error");
              }
            }}
          >
            Export
          </button>
        </div>

        <div className="logsControls">
          <FilterPanel
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            uniqueValues={uniqueValues}
            columnLabelMap={columnLabelMap}
          />

          <DatePicker value={selectedDate} onChange={setSelectedDate} storageKey="logsDate" />

          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      <div className="logList">
        {paginated.map((log, i) => {
          const expanded = expandedLogs.has(i);
          const [a = "", b = ""] = (log.description || "").split("||NOTE||");
          return (
            <div
              key={i}
              className={`logEntry ${log.description ? "expandable" : ""}`}
              onClick={() => {
                const shortAction = (log.useraction || "").split(" ")[0];
                if (log.description && !["Imported", "Exported"].includes(shortAction)) {
                  toggleExpand(i);
                }
              }}
            >
              <div className="logLeftIcon">{getActionIcon(log.useraction)}</div>
              <div className="logMain">
                <div className="logTop">{formatLogDetails(log)}</div>
                <div className="logBottom">{formatTimestamp(log.dateofaction)}</div>

                {expanded && log.description && (
                  <div className="logExtra">
                    {a && a.trim() !== "" && <div className="logMainDesc">{a}</div>}
                    {b && b.trim() !== "" && <div className="logNote">{b}</div>}
                  </div>
                )}
              </div>

              {log.description && !["Imported", "Exported"].includes((log.useraction || "").split(" ")[0]) && (
                <div className="logExpandIcon">
                  <FiChevronRight
                    style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="tableFooter">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
        <div></div>
      </div>
    </div>
  );
};

export default Logs;