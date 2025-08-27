import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FiSearch, FiEdit } from 'react-icons/fi';
import { MdClear } from 'react-icons/md';
import { FaSortAmountDownAlt, FaSortAmountUp, FaFilter } from 'react-icons/fa';

const InventoryComponent = ({ userId, setActivePage, setSelectedEmployeeId }) => {
  //db
  const [logs, setLogs] = useState([]);
  const [cardData, setCardData] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('inventoryDate') || '';
  });

  //ref
  const sortRef = useRef(null);
  const filterRef = useRef(null);

  // footer
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const columns = ['name', 'department', 'position', 'itemname', 'quantity', 'date'];
  const columnLabelMap = {
    name: 'Name',
    department: 'Department',
    position: 'Position',
    itemname: 'Item',
    quantity: 'Quantity',
    date: 'Date',
  };

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    itemid: '',
    itemname: '',
    quantity: ''
  });


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
    const fetchLogs = async () => {
      const dateParam = selectedDate?.trim() || "";
      const data = await window.fileAPI.getInventoryLogs(dateParam);
      setLogs(data);
    };
    fetchLogs();
  }, [selectedDate]);

  useEffect(() => {
    const fetchCardData = async () => {
      const data = await window.fileAPI.getInventoryCard();
      setCardData(data);
    };
    fetchCardData();
  }, []);

  const uniqueValues = useMemo(() => {
    const values = {
      department: new Set(),
      position: new Set(),
      itemname: new Set(),
    };
    logs.forEach(row => {
      values.department.add(row.department || '');
      values.position.add(row.position || '');
      values.itemname.add(row.itemname || '');
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      itemname: Array.from(values.itemname),
    };
  }, [logs]);

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
    return logs.filter(row => {
      const matchesSearch = Object.values(row)
        .some(val => String(val || '').toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilters = Object.entries(selectedFilters).every(([column, values]) => {
        if (column === '__activeColumn') return true;
        return values.length === 0 || values.includes(row[column] || '');
      });
      return matchesSearch && matchesFilters;
    });
  }, [logs, searchTerm, selectedFilters]);

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

  return (
    <div className="tabSection">
      <div className="inventoryRow">
        <h2 className="tabTitle">Inventory</h2>
        <button className="exportBtn" onClick={() => window.fileAPI.exportInventory()}>
          Export
        </button>
      </div>
      <div className="tabCards">
          {cardData.map((row, idx) => (
            <div key={idx} className="dashboardCards">
              <div className="cardBody">
                <div className="cardInfo">
                  <div className="cardValue">{row.quantity}</div>
                  <div className="cardTitle">{row.itemname}</div>
                </div>
              </div>
              <div className="cardFooter">
                  Last Modified: {row.lastmodified ? new Date(row.lastmodified).toLocaleDateString() : '—'}                <button
                  className="editCardBtn"
                  onClick={() => {
                    setEditForm({
                      itemid: row.itemid,
                      itemname: row.itemname,
                      quantity: row.quantity
                    });
                    setEditModalOpen(true);
                  }}
                  title="Edit item"
                >
                  <FiEdit />
                </button>
              </div>
            </div>
          ))}
        </div>

      <div className="tabHeaderRow">
        <div className="inventoryRow">
          <h2 className="tabTitle">Inventory Logs</h2>
          <button className="exportBtn" onClick={() => window.fileAPI.exportInventoryLogs(selectedDate)}>
            Export
          </button>
        </div>
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
                  {['department', 'position', 'itemname'].map((col) => (
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
                localStorage.setItem('inventoryDate', val);
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
            <th>Item</th>
            <th>Quantity</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {paginated.length === 0 ? (
            <tr><td colSpan={6}>No records found.</td></tr>
          ) : (
            paginated.map((row, idx) => (
              <tr 
                key={idx}
                onClick={() => {
                  setSelectedEmployeeId(row.employeeid);
                  setActivePage('EmployeeInformation');
                }}
              >
                <td>{row.name}</td>
                <td>{row.department}</td>
                <td>{row.position}</td>
                <td>{row.itemname}</td>
                <td>{row.quantity}</td>
                <td>{row.date ? new Date(row.date).toLocaleDateString() : ""}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

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
      {editModalOpen && (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target.classList.contains('modalOverlay')) {
              setEditModalOpen(false);
            }
          }}
        >
          <div className="modalContent">
            <h3>Edit Item</h3>

            <label>Item Name</label>
            <input
              type="text"
              value={editForm.itemname}
              onChange={(e) => setEditForm({ ...editForm, itemname: e.target.value })}
            />

            <label>Quantity</label>
            <input
              type="number"
              value={editForm.quantity}
              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
            />

            <div className="modalActions">
              <button onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button
                  onClick={async () => {
                    const oldItem = cardData.find((i) => i.itemid === editForm.itemid);

                    await window.fileAPI.updateItem(editForm);
                    setEditModalOpen(false);

                    const updated = await window.fileAPI.getInventoryCard();
                    setCardData(updated);

                    if (oldItem) {
                      const diffs = [];
                      const labelMap = {
                        itemname: "Item Name",
                        quantity: "Quantity"
                      };

                      for (const key of Object.keys(labelMap)) {
                        const oldVal = oldItem[key] != null ? String(oldItem[key]) : "";
                        const newVal = editForm[key] != null ? String(editForm[key]) : "";

                        if (oldVal !== newVal) {
                          diffs.push(`${labelMap[key]}: "${oldVal}" to "${newVal}"`);
                        }
                      }

                      if (diffs.length > 0) {
                        const oldName = oldItem.itemname || "";
                        console.log(oldName);

                        const description = diffs.map(d => `- ${d}`).join("\n");
                        console.log("Logging with userId:", userId);
                        await window.fileAPI.logAction(
                          userId,
                          `edited item "${oldName}"`,
                          description
                        );
                      }
                    }
                  }}
                >
                  Save
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryComponent;