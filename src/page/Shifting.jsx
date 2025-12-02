import React, { useEffect, useState, useMemo } from "react";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const Shifting = () => {
  const [people, setPeople] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [pageState, setPageState] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [modalStart, setModalStart] = useState("");
  const [modalEnd, setModalEnd] = useState("");
  const [modalSelectedShift, setModalSelectedShift] = useState("");
  const [modalEmployees, setModalEmployees] = useState([]);
  const [modalSearch, setModalSearch] = useState("");

  const columns = ["name", "role", "position"];
  const columnLabelMap = { name: "Name", role: "Role", position: "Position" };

  const toTime = (s) => {
    if (!s) return "";
    const [h, m] = s.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  useEffect(() => {
    const load = async () => {
      const data = await window.shiftAPI.getShifts();
      setPeople(data || []);
    };
    load();
  }, []);

  useEffect(() => {
    setPageState({});
  }, [selectedFilters, searchTerm]);

  const uniqueValues = useMemo(() => {
    const sets = { role: new Set(), position: new Set(), shift: new Set() };
    people.forEach((p) => {
      sets.role.add(p.role || "N/A");
      sets.position.add(p.position || "N/A");
      const shiftReadable =
        p.shift === "Missing"
          ? "Missing Shift"
          : `${toTime(p.shift.split(" - ")[0])} - ${toTime(p.shift.split(" - ")[1])}`;
      sets.shift.add(shiftReadable);
    });
    return {
      role: Array.from(sets.role),
      position: Array.from(sets.position),
      shift: Array.from(sets.shift),
    };
  }, [people]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        if (col === "__activeColumn" || !vals.length) return true;
        if (col === "shift") {
          const shiftReadable =
            p.shift === "Missing"
              ? "Missing Shift"
              : `${toTime(p.shift.split(" - ")[0])} - ${toTime(p.shift.split(" - ")[1])}`;
          return vals.includes(shiftReadable);
        }
        return vals.includes(p[col] || "N/A");
      });
      return matchesSearch && matchesFilters;
    });
  }, [people, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [filtered, sortColumn, sortOrder]);

  const grouped = useMemo(() => {
    const g = {};
    sorted.forEach((p) => {
      const shiftKey =
        p.shift === "Missing"
          ? "Missing Shift"
          : `${toTime(p.shift.split(" - ")[0])} - ${toTime(p.shift.split(" - ")[1])}`;
      if (!g[shiftKey]) g[shiftKey] = [];
      g[shiftKey].push(p);
    });
    return g;
  }, [sorted]);

  const shiftKeys = Object.keys(grouped);
  const normalShiftKeys = shiftKeys
    .filter((k) => k !== "Missing Shift")
    .sort((a, b) => {
      const getMS = (str) => new Date("1970/01/01 " + str.split(" - ")[0]).getTime();
      return getMS(a) - getMS(b);
    });

  const missingShiftKey = shiftKeys.includes("Missing Shift") ? "Missing Shift" : null;

  const getPaginatedRows = (shiftKey) => {
    const page = pageState[shiftKey] || 1;
    const start = (page - 1) * itemsPerPage;
    return grouped[shiftKey].slice(start, start + itemsPerPage);
  };

  const setCardPage = (shift, p) =>
    setPageState((prev) => ({ ...prev, [shift]: p }));

  const openModal = (mode, params = {}) => {
    setModalMode(mode);
    setModalOpen(true);
    if (mode === "addToShift") {
      setModalSelectedShift(params.shiftReadable);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode(null);
    setModalStart("");
    setModalEnd("");
    setModalSelectedShift("");
    setModalEmployees([]);
    setModalSearch("");
  };

  useEffect(() => {
    if (!modalOpen) return;
    if (modalMode === "addToShift" || modalMode === "batchEdit") {
      Promise.all([window.employeeAPI.getEmployees(), window.applicantAPI.getApplicants()]).then(
        ([employees, applicants]) => {
          const combined = [...(employees || []), ...(applicants || [])];
          setModalEmployees(combined);
        }
      );
    }
  }, [modalOpen, modalMode]);

  const filteredForModal = modalEmployees.filter((e) =>
    e.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const handleAddToShift = async () => {
    const ids = modalEmployees.filter(e => e.selected).map(e => e.id);
    if (!ids.length) return;
    const [start, end] = modalSelectedShift.split(" - ");
    await window.shiftAPI.assignShift(ids, start, end);
    closeModal();
  };

  const handleBatchShift = async () => {
    const ids = modalEmployees.filter(e => e.selected).map(e => e.id);
    if (!ids.length || !modalStart || !modalEnd) return;
    await window.shiftAPI.assignShiftBulk(ids, modalStart, modalEnd);
    closeModal();
  };

  return (
    <>
      <div className="shiftContainer">
        <div className="shiftHeaderRow">
          <h1>Shifting Schedule</h1>
          <div className="shiftControls">
            <button className="addBtn" onClick={() => openModal("batchEdit")}>
              Batch Edit
            </button>
            <SortDropdown
              columns={columns}
              columnLabelMap={columnLabelMap}
              sortColumn={sortColumn}
              sortOrder={sortOrder}
              dropdownOpen={dropdownOpen}
              setDropdownOpen={setDropdownOpen}
              onSortChange={(col, order) => {
                setSortColumn(col);
                setSortOrder(order);
              }}
            />
            <FilterPanel
              filterOpen={filterOpen}
              setFilterOpen={setFilterOpen}
              selectedFilters={selectedFilters}
              setSelectedFilters={setSelectedFilters}
              uniqueValues={uniqueValues}
              columnLabelMap={columnLabelMap}
            />
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name..."
            />
          </div>
        </div>

        <div className="shiftGrid">
          {normalShiftKeys.map((shiftKey) => {
            const total = grouped[shiftKey].length;
            const totalPages = Math.ceil(total / itemsPerPage);
            const rows = getPaginatedRows(shiftKey);
            const page = pageState[shiftKey] || 1;

            return (
              <div key={shiftKey} className="shiftCard">
                <div className="shiftCardHeader">
                  <h2>{shiftKey}</h2>
                  <button
                    className="addBtn"
                    onClick={() => openModal("addToShift", { shiftReadable: shiftKey })}
                  >
                    +
                  </button>
                </div>

                <table className="shiftTable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.name}</td>
                        <td>{p.role}</td>
                        <td>{p.position || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="tableFooter">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={total}
                    onPageChange={(p) => setCardPage(shiftKey, p)}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {missingShiftKey && (
          <div className="missingShiftContainer">
            <div className="shiftCard">
              <div className="shiftCardHeader">
                <h2>Missing Shift</h2>
              </div>

              {(() => {
                const total = grouped[missingShiftKey].length;
                const totalPages = Math.ceil(total / itemsPerPage);
                const page = pageState[missingShiftKey] || 1;
                const rows = getPaginatedRows(missingShiftKey);

                return (
                  <>
                    <table className="shiftTable">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p, idx) => (
                          <tr key={idx}>
                            <td>{p.name}</td>
                            <td>{p.role}</td>
                            <td>{p.position || "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="tableFooter">
                      <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        itemsPerPage={itemsPerPage}
                        totalItems={total}
                        onPageChange={(p) => setCardPage(missingShiftKey, p)}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modalOverlay">
          <div className="modalContent">
            <h2 className="modalTitle">
              {modalMode === "addToShift" && "Add Employees to Shift"}
              {modalMode === "batchEdit" && "Batch Edit Shifts"}
            </h2>

            {(modalMode === "addToShift" || modalMode === "batchEdit") && (
              <>
                <input
                  placeholder="Search employees…"
                  className="modalInput"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                />

                <div className="modalEmployeeList">
                  {filteredForModal.map((e) => (
                    <div key={e.id} className="modalEmployeeItem">
                      <input
                        type="checkbox"
                        checked={!!e.selected}
                        onChange={() => {
                          setModalEmployees(prev =>
                            prev.map(p =>
                              p.id === e.id ? { ...p, selected: !p.selected } : p
                            )
                          );
                        }}
                      />
                      <span>{e.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {modalMode === "addToShift" && (
              <button className="addBtn" onClick={handleAddToShift}>
                + Add
              </button>
            )}

            {modalMode === "batchEdit" && (
              <>
                <label>New Start Time</label>
                <input type="time" className="modalInput" value={modalStart} onChange={(e) => setModalStart(e.target.value)} />
                <label>New End Time</label>
                <input type="time" className="modalInput" value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} />
                <button className="btn btn-purple w-full" onClick={handleBatchShift}>
                  Apply to Selected
                </button>
              </>
            )}

            <button className="btn w-full btn-cancel" onClick={closeModal}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
};

export default Shifting;