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
    if (mode === "add-to-shift") {
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
    if (modalMode === "add-to-shift" || modalMode === "batch-edit") {
      window.employeeAPI.getPeople().then((res) => {
        setModalEmployees(res || []);
      });
    }
  }, [modalOpen, modalMode]);

  const filteredForModal = modalEmployees.filter((e) =>
    e.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const handleCreateShift = async () => {
    if (!modalStart || !modalEnd) return;
    await window.shiftAPI.createShift(modalStart, modalEnd);
    closeModal();
  };

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
    <div className="shiftContainer">
      <div className="shiftHeaderRow">
        <h1>Shifting Schedule</h1>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded"
            onClick={() => openModal("add-shift")}
          >
            Add Shift
          </button>

          <button
            className="px-3 py-2 bg-purple-600 text-white rounded"
            onClick={() => openModal("batch-edit")}
          >
            Batch Edit Shifts
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
              <div className="shiftCardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>{shiftKey}</h2>
                <button
                  className="px-2 py-1 bg-green-600 text-white rounded"
                  onClick={() => openModal("add-to-shift", { shiftReadable: shiftKey })}
                >
                  Add Employee
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
            <div className="shiftCardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              {modalMode === "add-shift" && "Add New Shift"}
              {modalMode === "add-to-shift" && "Add Employees to Shift"}
              {modalMode === "batch-edit" && "Batch Edit Shifts"}
            </h2>

            {modalMode === "add-shift" && (
              <>
                <label className="block mb-2">Start Time</label>
                <input type="time" className="w-full mb-4 border p-2 rounded"
                  value={modalStart} onChange={(e) => setModalStart(e.target.value)} />

                <label className="block mb-2">End Time</label>
                <input type="time" className="w-full mb-6 border p-2 rounded"
                  value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} />

                <button onClick={handleCreateShift}
                  className="w-full bg-blue-600 text-white py-2 rounded">
                  Create Shift
                </button>
              </>
            )}

            {(modalMode === "add-to-shift" || modalMode === "batch-edit") && (
              <>
                <input
                  placeholder="Search employees…"
                  className="w-full mb-4 border p-2 rounded"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                />

                <div className="max-h-60 overflow-y-auto border rounded p-2 mb-4">
                  {filteredForModal.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 mb-2">
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

            {modalMode === "add-to-shift" && (
              <button
                onClick={handleAddToShift}
                className="w-full bg-green-600 text-white py-2 rounded"
              >
                Add Selected Employees
              </button>
            )}

            {modalMode === "batch-edit" && (
              <>
                <label className="block mb-2">New Start Time</label>
                <input type="time" className="w-full mb-4 border p-2 rounded"
                  value={modalStart} onChange={(e) => setModalStart(e.target.value)} />

                <label className="block mb-2">New End Time</label>
                <input type="time" className="w-full mb-6 border p-2 rounded"
                  value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} />

                <button
                  onClick={handleBatchShift}
                  className="w-full bg-purple-600 text-white py-2 rounded"
                >
                  Apply to Selected
                </button>
              </>
            )}

            <button className="mt-4 w-full border py-2 rounded" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shifting;