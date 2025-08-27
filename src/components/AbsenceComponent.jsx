import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const DashboardAbsence = ({ setActivePage, setSelectedEmployeeId }) => {
  const [absence, setAbsence] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('absenceDate') || new Date().toISOString().split('T')[0];
  });

  //ref
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  // footer
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const columns = ['fullName', 'department', 'position', 'shift'];
  const columnLabelMap = {
    fullName: 'Name',
    department: 'Department',
    position: 'Position',
    shift: 'Shift',
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchAbsences = async () => {
      const data = await window.fileAPI.getAbsent(selectedDate);
      setAbsence(data);
    };
    fetchAbsences();
  }, [selectedDate]);

  const uniqueValues = useMemo(() => {
    const values = {
      department: new Set(),
      position: new Set(),
      shift: new Set(),
    };
    absence.forEach(row => {
      const formatTime = (time) => {
        if (!time) return '';
        const [hour, minute] = time.split(':');
        const h = parseInt(hour, 10);
        const period = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minute} ${period}`;
      };

      let shiftDisplay = '';
      if (row.shift) {
        const [start, end] = row.shift.split(' - ');
        shiftDisplay = `${formatTime(start)} - ${formatTime(end)}`;
      }

      values.department.add(row.department || '');
      values.position.add(row.position || '');
      values.shift.add(shiftDisplay);
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      shift: Array.from(values.shift),
    };
  }, [absence]);

  const clearFilters = () => {
    setSelectedFilters({});
  };

  const toggleFilterValue = (column, value) => {
    setSelectedFilters(prev => {
      const colValues = prev[column] || [];
      const updated = colValues.includes(value)
        ? colValues.filter(v => v !== value)
        : [...colValues, value];
      return {
        ...prev,
        [column]: updated,
        __activeColumn: column
      };
    });
  };

  const filtered = useMemo(() => {
    return absence.filter(row => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column] || '');
      });
      return matchesSearch && matchesFilters;
    });
  }, [absence, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const formatTime = (time) => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Absent</h2>

        <div className="tabControls">
          <div className="sortContainer" ref={sortRef}>
            <div className="sortIcon" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
            </div>
            <div className="sortText" onClick={() => setDropdownOpen(prev => !prev)}>
              Sort: {columnLabelMap[sortColumn]}
            </div>
            {dropdownOpen && (
              <div className="tabSortOptions">
                {columns.map((col) => (
                  <div
                    key={col}
                    onClick={() => {
                      setSortColumn(col);
                      setDropdownOpen(false);
                    }}
                  >
                    {columnLabelMap[col]}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filterContainer" ref={filterRef}>
            <button className="filterBtn" onClick={() => setFilterOpen((prev) => !prev)}>
              <FaFilter />
            </button>

            {filterOpen && (
              <div className="filterDropdown">
                <div className="filterHeader">
                  <strong>Filter by</strong>
                  <button className="clearFilterBtn" onClick={clearFilters}>Clear</button>
                </div>
                <div className="filterColumns">
                  {['department', 'position', 'shift'].map((col) => (
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
                  {uniqueValues[selectedFilters.__activeColumn]?.map((val) => (
                    <label key={val} className="filterValueItem">
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

          <div className="calendarContainer">
            <input
              type="date"
              value={selectedDate}
              isClearable={false}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                localStorage.setItem('absenceDate', val);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="tabSearchContainer">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="searchIconBtn"><FiSearch /></span>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <table className="tabTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Position</th>
            <th>Shift</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr><td colSpan={4}>No records found.</td></tr>
          ) : (
            paginated.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => {
                  console.log(row);
                  setSelectedEmployeeId(row.employeeid);
                  setActivePage('EmployeeInformation');
                }}
              >
                <td>{row.fullName}</td>
                <td>{row.department}</td>
                <td>{row.position}</td>
                <td>{formatTime(row.shift?.split(' - ')[0])} - {formatTime(row.shift?.split(' - ')[1])}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="tableFooter">
        <div className="paginationItems">
          <label>Items: </label>
          <select
            value={itemsPerPage === absence.length ? 'all' : itemsPerPage}
            onChange={(e) => {
              const val = e.target.value;
              setItemsPerPage(val === 'all' ? absence.length : Number(val));
              setCurrentPage(1);
            }}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
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
                pages.push(1, 2, 'ellipsis', totalPages);
              } else if (currentPage >= totalPages - 1) {
                pages.push(1, 'ellipsis', totalPages - 1, totalPages);
              } else {
                pages.push(1, currentPage, 'ellipsis', totalPages);
              }
            }

            return pages.map((page, idx) => {
              if (page === 'ellipsis') {
                if (showJumpInput) {
                  return (
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
                        if (val === '' || (/^\d+$/.test(val) && Number(val) <= totalPages)) {
                          setJumpPage(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const pageNum = Number(jumpPage);
                          if (pageNum >= 1 && pageNum <= totalPages) {
                            setCurrentPage(pageNum);
                            setShowJumpInput(false);
                            setJumpPage('');
                          }
                        } else if (e.key === 'Escape') {
                          setShowJumpInput(false);
                          setJumpPage('');
                        }
                      }}
                      onBlur={() => {
                        setShowJumpInput(false);
                        setJumpPage('');
                      }}
                      placeholder="Page #"
                    />
                  );
                } else {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="paginationEllipsis"
                      onClick={() => setShowJumpInput(true)}
                      title="Jump to page"
                    >
                      {jumpPage !== '' ? jumpPage : '...'}
                    </span>
                  );
                }
              } else {
                return (
                  <button
                    key={page}
                    className={`paginationBtn ${currentPage === page ? 'currentPage' : ''}`}
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
        <div>
          <button className="exportBtn" onClick={() => window.fileAPI.exportAbsence(selectedDate)}>
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardAbsence;
