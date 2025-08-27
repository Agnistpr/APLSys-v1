import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiSearch, FiChevronRight } from 'react-icons/fi';
import { MdClear, MdEdit, MdAdd, MdDelete } from 'react-icons/md';
import { FaFilter } from 'react-icons/fa';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');

  const inlineActions = ["filed leave"];
  const [expandedLogs, setExpandedLogs] = useState(new Set());

  const filterRef = useRef(null);

  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const columnLabelMap = { user: 'User', action: 'Action' };

  // Close filter on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      const data = await window.fileAPI.getLogs(selectedDate);
      setLogs(data);
    };
    fetchLogs();
  }, [selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = { user: new Set(), action: new Set() };
    logs.forEach(row => {
      values.user.add(row.user || '');
      values.action.add(row.action || '');
    });
    return {
      user: Array.from(values.user),
      action: Array.from(values.action),
    };
  }, [logs]);

  const clearFilters = () => setSelectedFilters({});

  const toggleFilterValue = (column, value) => {
    setSelectedFilters(prev => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter(v => v !== value)
        : [...colValues, value];
      return { ...prev, [column]: updated, __activeColumn: column };
    });
  };

  const getActionIcon = (action) => {
    if (action.toLowerCase().includes("edit")) return <MdEdit />;
    if (action.toLowerCase().includes("add")) return <MdAdd />;
    if (action.toLowerCase().includes("delete")) return <MdDelete />;
    return <MdEdit />;
  };

  const formatLogDetails = (log, mainDesc) => {
    const action = log.useraction.toLowerCase();
    if (action.includes("filed leave")) {
      return `${log.username} filed leave for ${log.mainDesc}`;
    }
    if (action.includes("edited item ")) {
      return `${log.username} ${log.useraction}`;
    }
    return `${log.username} ${log.useraction}`;
  };

  const formatTimestamp = (dateString) => {
    const dateObj = new Date(dateString);
    const now = new Date();

    const isToday =
      dateObj.getDate() === now.getDate() &&
      dateObj.getMonth() === now.getMonth() &&
      dateObj.getFullYear() === now.getFullYear();

    const isSameYear = dateObj.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today ${dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }

    const day = dateObj.getDate();
    const daySuffix = (d) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };

    const month = dateObj.toLocaleString("default", { month: "long" });
    const year = isSameYear ? "" : `, ${dateObj.getFullYear()}`;
    const time = dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    return `${month} ${day}${daySuffix(day)}${year} - ${time}`;
  };

  const filtered = useMemo(() => {
    return logs.filter(row => {
      const matchesSearch =
        row.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.useraction?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        const fieldMap = { user: 'username', action: 'useraction' };
        const field = fieldMap[column] || column;
        return values.length === 0 || values.includes(row[field] || '');
      });

      return matchesSearch && matchesFilters;
    });
  }, [logs, searchTerm, selectedFilters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const toggleExpand = (idx) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      newSet.has(idx) ? newSet.delete(idx) : newSet.add(idx);
      return newSet;
    });
  };

  return (
    <div className="logsContainer">
      <div className="logsHeaderRow">
        <div className="logsHeader">
          <h1>Logs</h1>
          <button className="exportBtn" onClick={() => window.fileAPI.exportLogs()}>
            Export
          </button>
        </div>

        <div className="logsControls">
          <div className="filterContainer" ref={filterRef}>
            <button className="filterBtn" onClick={() => setFilterOpen(prev => !prev)}>
              <FaFilter />
            </button>

            {filterOpen && (
              <div className="filterDropdown">
                <div className="filterHeader">
                  <strong>Filter by</strong>
                  <button className="clearFilterBtn" onClick={clearFilters}>Clear</button>
                </div>
                <div className="filterColumns">
                  {['user', 'action'].map((col) => (
                    <div
                      key={col}
                      className={`filterColumnName ${selectedFilters[col] ? 'activeColumn' : ''}`}
                      onClick={() => {
                        setSelectedFilters((prev) => ({
                          ...prev,
                          __activeColumn: prev.__activeColumn === col ? null : col
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
                        checked={selectedFilters[selectedFilters.__activeColumn]?.includes(val) || false}
                        onChange={() => toggleFilterValue(selectedFilters.__activeColumn, val)}
                      />
                      {val || '—'}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="logCalendar">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="searchContainer">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="searchIconBtn"><FiSearch /></button>
            {searchTerm && (
              <button className="clearSearchBtn" onClick={() => setSearchTerm('')}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="logList">
        {paginated.map((log, idx) => {
          const isInlineAction = inlineActions.some(action =>
            log.useraction.toLowerCase().includes(action)
          );

          const isExpanded = expandedLogs.has(idx);
          const [mainDescRaw, noteRaw] = log.description?.split('||NOTE||') || ['', ''];
          const mainDesc = (mainDescRaw || '').trim();
          const note = (noteRaw || '').trim();

          return (
            <div
              key={idx}
              className={`logEntry ${log.description ? "expandable" : ""}`}
              onClick={() => !isInlineAction && log.description && toggleExpand(idx)}
            >
              <div className="logLeftIcon">{getActionIcon(log.useraction)}</div>
              <div className="logMain">
                <div className="logTop">{formatLogDetails(log)}</div>
                <div className="logBottom">{formatTimestamp(log.dateofaction)}</div>

                {!isInlineAction && isExpanded && log.description && (
                  <div className="logExtra">
                    {mainDesc && <div className="logMainDesc">{mainDesc}</div>}
                    {note && <div className="logNote">{note}</div>}
                  </div>
                )}
              </div>

              {!isInlineAction && log.description && (
                <div className="logExpandIcon">
                  <FiChevronRight
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && (
        <div className="tableFooter">
          <div className="paginationItems">
            <label>Items: </label>
            <select
              value={itemsPerPage === logs.length ? 'all' : itemsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setItemsPerPage(val === 'all' ? logs.length : Number(val));
                setCurrentPage(1);
              }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
              <option value="all">All</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logs;