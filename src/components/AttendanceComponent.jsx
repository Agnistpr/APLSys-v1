import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const DashboardAttendance = ({ setActivePage, setSelectedEmployeeId }) => {
  const [attendance, setAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);

  //ref
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  // footer
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const columns = ['fullName', 'position', 'shift', 'timeIn', 'timeOut', 'status', 'diffValue'];
  const columnLabelMap = {
    fullName: 'Name',
    position: 'Position',
    shift: 'Shift',
    timeIn: 'Time In',
    timeOut: 'Time Out',
    status: 'Status',
    diffValue: 'UT/OT',
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
    const fetchAttendance = async () => {
      const today = new Date().toISOString().split('T')[0];
      const data = await window.fileAPI.getAttendanceByDate(today);
      const formatted = data.map(row => {
        const [shiftStart = '', shiftEnd = ''] = row.shift?.split(' - ') || [];
        const timeIn = row.timeIn || '';
        const timeOut = row.timeOut || '';
        const expected = calculateMinutes(shiftStart, shiftEnd);
        const actual = calculateMinutes(timeIn, timeOut);
        const diff = actual - expected;

        return {
          ...row,
          utot: `${Math.abs(diff)} min(s)`,
          status: diff < 0 ? 'Undertime' : 'On time / Overtime',
          diffValue: diff
        };
      });
      setAttendance(formatted);
    };

    fetchAttendance();
  }, []);

  const calculateMinutes = (start, end) => {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    const h = parseInt(hour);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const uniqueValues = useMemo(() => {
    const values = { position: new Set(), status: new Set() };
    attendance.forEach(row => {
      values.position.add(row.position);
      values.status.add(row.status);
    });
    return {
      position: Array.from(values.position),
      status: Array.from(values.status)
    };
  }, [attendance]);

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
    return attendance.filter(row => {
      const matchesSearch = row.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column]);
      });
      return matchesSearch && matchesFilters;
    });
  }, [attendance, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';
      if (sortColumn === 'diffValue') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
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
  
  const formatNumericDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US');
  };

  return (
    <div className="tabSection">
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Today's Attendance:</h2>

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
                  {['position', 'status'].map((col) => (
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
            <th>Position</th>
            <th>Shift</th>
            <th>Time-in</th>
            <th>Time-out</th>
            <th>UT/OT</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr><td colSpan={7}>No records found.</td></tr>
          ) : (
            paginated.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => {
                  setSelectedEmployeeId(row.employeeid);
                  setActivePage('EmployeeInformation');
                }}
              >
                <td>{row.fullName}</td>
                <td>{row.position}</td>
                <td>{formatTime(row.shift?.split(' - ')[0])} - {formatTime(row.shift?.split(' - ')[1])}</td>
                <td>{formatTime(row.timeIn)}</td>
                <td>{formatTime(row.timeOut)}</td>
                <td style={{ color: row.diffValue < 0 ? 'red' : 'green' }}>{row.utot}</td>
                <td>{row.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

        <div className="tableFooter">
          <div className="paginationItems">
            <label>Items: </label>
            <select
              value={itemsPerPage === attendance.length ? 'all' : itemsPerPage}
              onChange={(e) => {
                const val = e.target.value;
                setItemsPerPage(val === 'all' ? attendance.length : Number(val));
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
            <button className="exportBtn" onClick={() => window.fileAPI.exportTodayAttendance()}>
              Export
            </button>
          </div>
      </div>
    </div>
  );
};

export default DashboardAttendance;
