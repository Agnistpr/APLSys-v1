import React, { useEffect, useState, useRef, useMemo } from 'react';
import { FiSearch } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp } from 'react-icons/fa';

const Attendance = ({ setActivePage, setSelectedEmployeeId, setPreviousPage, activePage  }) => {
  const [attendance, setAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [sortColumn, setSortColumn] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem('attendanceDate') || '');
  const sortRef = useRef(null);

  const columns = ['date', 'fullName', 'position', 'shift', 'timeIn', 'timeOut', 'utot', 'status'];
  const columnLabelMap = {
    date: 'Date',
    fullName: 'Name',
    position: 'Position',
    shift: 'Shift',
    timeIn: 'Time In',
    timeOut: 'Time Out',
    utot: 'UT/OT',
    status: 'Status'
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = selectedDate
          ? await window.fileAPI.getAttendanceByDate(selectedDate)
          : await window.fileAPI.getAttendance();

        const formatted = data.map(row => {
          const [shiftStart = '', shiftEnd = ''] = row.shift?.split(' - ') || [];
          const timeIn = row.timeIn || '';
          const timeOut = row.timeOut || '';
          const expected = calculateMinutes(shiftStart, shiftEnd);
          const actual = calculateMinutes(timeIn, timeOut);
          const diff = actual - expected;

          return {
            ...row,
            date: typeof row.date === 'string' ? row.date : new Date(row.date).toLocaleDateString('en-CA'),
            utot: `${Math.abs(diff)} min(s)`,
            status: diff < 0 ? 'Undertime' : 'On time / Overtime',
            diffValue: diff
          };
        });

        setAttendance(formatted);
      } catch (err) {
        console.error(err);
        setAttendance([]);
      }
    };

    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const filtered = useMemo(() => {
    return attendance.filter(row =>
      row.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [attendance, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? '';
      const bVal = b[sortColumn] ?? '';

      if (sortColumn === 'diffValue') return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  return (
    <div className="attendanceContainer">
      <div className="attendanceHeaderRow">
        <div className="attendanceHeader">
          <h1>Attendance</h1>
          <button className="exportBtn" onClick={() => window.fileAPI.exportAttendance()}>
            Export All
          </button>
        </div>

        <div className="attendanceControls">
          <div className="sortContainer" ref={sortRef}>
            <div
              className="sortIcon"
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            >
              {sortOrder === 'asc' ? <FaSortAmountDownAlt /> : <FaSortAmountUp />}
            </div>
            <div className="sortText" onClick={() => setDropdownOpen(prev => !prev)}>
              Sort: {columnLabelMap[sortColumn] || sortColumn}
            </div>
            {dropdownOpen && (
              <div className="sortDropdown">
                {columns.map(col => (
                  <div
                    key={col}
                    className="dropdownItem"
                    onClick={() => {
                      setSortColumn(col === 'utot' ? 'diffValue' : col);
                      setDropdownOpen(false);
                    }}
                  >
                    {columnLabelMap[col] || col}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="calendarContainer">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDate(val);
                localStorage.setItem('attendanceDate', val);
              }}
            />
          </div>

          <div className="searchContainer">
            <input
              type="text"
              placeholder="Search..."
              className="searchBar"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="searchIconBtn">
              <FiSearch />
            </button>
            {searchTerm && (
              <button className="clearSearchBtn" onClick={() => setSearchTerm('')}>
                <MdClear />
              </button>
            )}
          </div>
        </div>
      </div>

      <table className="attendanceTable">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{columnLabelMap[col] || col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No attendance records found.</td>
            </tr>
          ) : (
            paginated.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => {
                  if (row.employeeid) {
                    setSelectedEmployeeId(row.employeeid);
                    setPreviousPage(activePage);
                    setActivePage('EmployeeInformation');
                  }
                }}
              >
                <td>{row.date}</td>
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
        </div>
      </div>
    </div>
  );
};

export default Attendance;