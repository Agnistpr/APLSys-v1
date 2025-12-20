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
  const [itemsPerPageState, setItemsPerPageState] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [modalSelectedShift, setModalSelectedShift] = useState("");
  const [modalEmployees, setModalEmployees] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [modalRoleFilter, setModalRoleFilter] = useState("");
  const [modalPositionFilter, setModalPositionFilter] = useState("");
  const [modalShiftFilter, setModalShiftFilter] = useState("");

  const [modalShiftStart, setModalShiftStart] = useState("");
  const [modalShiftEnd, setModalShiftEnd] = useState("");

  const columns = ["name", "role", "position"];
  const columnLabelMap = { name: "Name", role: "Role", position: "Position" };

  const toTime = (s) => {
    if (!s) return "";
    const [h, m] = s.split(":");
    const hour = parseInt(h);
    const h12 = hour % 12 || 12;
    return `${h12}:${m}`;
  };

  const parseShiftReadable = (shiftReadable) => {
    if (!shiftReadable || shiftReadable === "Missing Shift") return null;
    const [start, end] = shiftReadable.split(" - ");
    return { start, end };
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
          : `${toTime(p.shift.split(" - ")[0])} - ${toTime(
              p.shift.split(" - ")[1]
            )}`;
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
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesFilters = Object.entries(selectedFilters).every(
        ([col, vals]) => {
          if (col === "__activeColumn" || !vals.length) return true;
          if (col === "shift") {
            const shiftReadable =
              p.shift === "Missing"
                ? "Missing Shift"
                : `${toTime(p.shift.split(" - ")[0])} - ${toTime(
                    p.shift.split(" - ")[1]
                  )}`;
            return vals.includes(shiftReadable);
          }
          return vals.includes(p[col] || "N/A");
        }
      );
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
          : `${toTime(p.shift.split(" - ")[0])} - ${toTime(
              p.shift.split(" - ")[1]
            )}`;
      if (!g[shiftKey]) g[shiftKey] = [];
      g[shiftKey].push(p);
    });
    return g;
  }, [sorted]);

  const shiftKeys = Object.keys(grouped);
  const normalShiftKeys = shiftKeys
    .filter((k) => k !== "Missing Shift")
    .sort((a, b) => {
      const getMS = (str) =>
        new Date("1970/01/01 " + str.split(" - ")[0]).getTime();
      return getMS(a) - getMS(b);
    });

  const missingShiftKey = shiftKeys.includes("Missing Shift")
    ? "Missing Shift"
    : null;

  const getItemsPerPage = (shiftKey) => itemsPerPageState[shiftKey] || 10;

  const getPaginatedRows = (shiftKey) => {
    const page = pageState[shiftKey] || 1;
    const itemsPerPage = getItemsPerPage(shiftKey);
    const start = (page - 1) * itemsPerPage;
    return grouped[shiftKey].slice(start, start + itemsPerPage);
  };

  const setCardPage = (shift, p) =>
    setPageState((prev) => ({ ...prev, [shift]: p }));

  const setCardItemsPerPage = (shiftKey, value) =>
    setItemsPerPageState((prev) => ({ ...prev, [shiftKey]: value }));

  const openModal = (mode, params = {}) => {
    setModalMode(mode);
    setModalOpen(true);
    setModalSearch("");
    setModalRoleFilter("");
    setModalPositionFilter("");
    setModalShiftFilter("");
    if (mode === "addToShift") setModalSelectedShift(params.shiftReadable);
    if (mode === "batchEdit") setModalSelectedShift("");
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode(null);
    setModalSelectedShift("");
    setModalEmployees([]);
    setModalSearch("");
  };

  useEffect(() => {
    if (!modalOpen || (modalMode !== "addToShift" && modalMode !== "batchEdit"))
      return;

    const loadModalPeople = async () => {
      const all = await window.shiftAPI.getShifts();

      const filtered =
        modalMode === "addToShift"
          ? all.filter((p) => {
              const parsed = parseShiftReadable(modalSelectedShift);
              if (!parsed) return true;
              if (p.shift === "Missing") return true;
              const [s, e] = p.shift.split(" - ");
              return s !== parsed.start || e !== parsed.end;
            })
          : all;

        const modalReady = filtered.map((p) => ({
          ...p,
          selected: false,
          _type: p.role === "Employee" ? "employee" : "applicant",
          _id: p.role === "Employee" ? p.employeeid : p.applicantid,
          _uid: crypto.randomUUID(),
        }));

      setModalEmployees(modalReady);
    };

    loadModalPeople();
  }, [modalOpen, modalMode, modalSelectedShift]);

  const modalUnique = useMemo(() => {
    const roles = new Set();
    const positions = new Set();
    const shifts = new Set();
    modalEmployees.forEach((e) => {
      roles.add(e.role || "N/A");
      positions.add(e.position || "N/A");
      shifts.add(
        e.shift === "Missing" || !e.shift
          ? "Missing Shift"
          : `${toTime(e.shift.split(" - ")[0])} - ${toTime(
              e.shift.split(" - ")[1]
            )}`
      );
    });
    return {
      roles: Array.from(roles),
      positions: Array.from(positions),
      shifts: Array.from(shifts),
    };
  }, [modalEmployees]);

  const filteredForModal = modalEmployees.filter((e) => {
    const nameMatch = e.name
      .toLowerCase()
      .includes(modalSearch.toLowerCase());
    const roleMatch = modalRoleFilter
      ? (e.role || "N/A") === modalRoleFilter
      : true;
    const positionMatch = modalPositionFilter
      ? (e.position || "N/A") === modalPositionFilter
      : true;
    const shiftReadable =
      e.shift === "Missing" || !e.shift
        ? "Missing Shift"
        : `${toTime(e.shift.split(" - ")[0])} - ${toTime(
            e.shift.split(" - ")[1]
          )}`;
    const shiftMatch = modalShiftFilter
      ? shiftReadable === modalShiftFilter
      : true;
    return nameMatch && roleMatch && positionMatch && shiftMatch;
  });

  const handleAddToShift = async () => {
    const ids = modalEmployees
      .filter((e) => e.selected)
      .map((e) => ({ id: e._id, type: e._type }));
    if (!ids.length) return;
    const parsed = parseShiftReadable(modalSelectedShift);
    if (!parsed) return;
    await window.shiftAPI.updateShift(ids, parsed.start, parsed.end);
    const refreshed = await window.shiftAPI.getShifts();
    setPeople(refreshed || []);
    closeModal();
  };

  const handleBatchEdit = async () => {
    const ids = modalEmployees
      .filter((e) => e.selected)
      .map((e) => ({ id: e._id, type: e._type }));
    if (!ids.length) return;
    if (!modalShiftStart || !modalShiftEnd) return;
    await window.shiftAPI.updateShift(ids, modalShiftStart, modalShiftEnd);
    const refreshed = await window.shiftAPI.getShifts();
    setPeople(refreshed || []);
    closeModal();
  };

  return (
    <>
      <div className="shiftContainer">
        <div className="shiftHeaderRow">
          <h1>Shifting Schedule</h1>
          <button className="btn btn-batch" onClick={() => openModal("batchEdit")}>
            Batch Edit
          </button>
          <div className="shiftControls">
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
            const itemsPerPage = getItemsPerPage(shiftKey);
            const totalPages = Math.ceil(total / itemsPerPage);
            const rows = getPaginatedRows(shiftKey);
            const page = pageState[shiftKey] || 1;

            return (
              <div key={shiftKey} className="shiftCard">
                <div className="shiftCardHeader">
                  <h2>{shiftKey}</h2>
                  <button
                    className="addBtn"
                    onClick={() =>
                      openModal("addToShift", { shiftReadable: shiftKey })
                    }
                  >
                    +
                  </button>
                </div>

                <div className="tableContainer">
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
                </div>

                <div className="tableFooter">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={total}
                    onPageChange={(p) => setCardPage(shiftKey, p)}
                    onItemsPerPageChange={(v) =>
                      setCardItemsPerPage(shiftKey, v)
                    }
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

              <div className="tableContainer">
                <table className="shiftTable">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaginatedRows(missingShiftKey).map((p, idx) => (
                      <tr key={idx}>
                        <td>{p.name}</td>
                        <td>{p.role}</td>
                        <td>{p.position || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tableFooter">
                <Pagination
                  currentPage={pageState[missingShiftKey] || 1}
                  totalPages={Math.ceil(
                    grouped[missingShiftKey].length /
                      getItemsPerPage(missingShiftKey)
                  )}
                  itemsPerPage={getItemsPerPage(missingShiftKey)}
                  totalItems={grouped[missingShiftKey].length}
                  onPageChange={(p) => setCardPage(missingShiftKey, p)}
                  onItemsPerPageChange={(v) =>
                    setCardItemsPerPage(missingShiftKey, v)
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modalOverlay">
          <div className="modalContent">
            <div className="modalHeader">
              <h3>
                {modalMode === "addToShift" ? "Add to Shift" : "Batch Edit Shifts"}
              </h3>
              <button className="closeBtn" onClick={closeModal}>×</button>
            </div>

            <hr className="modalDivider" />

            <div className="employeeSearchBox">
              <input
                className="modalInput"
                placeholder="Search employee name..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
              />
            </div>

            <div className="modalFilters">
              <select
                value={modalRoleFilter}
                onChange={(e) => setModalRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                {modalUnique.roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={modalPositionFilter}
                onChange={(e) => setModalPositionFilter(e.target.value)}
              >
                <option value="">All Positions</option>
                {modalUnique.positions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={modalShiftFilter}
                onChange={(e) => setModalShiftFilter(e.target.value)}
              >
                <option value="">All Shifts</option>
                {modalUnique.shifts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="modalEmployeeList">
              <div className="modalEmployeeItem" style={{ fontWeight: 600 }}>
                <span style={{ width: 20 }} />
                <span style={{ flex: 2 }}>Name</span>
                <span style={{ flex: 1 }}>Role</span>
                <span style={{ flex: 1 }}>Position</span>
                <span style={{ flex: 1 }}>Shift</span>
              </div>

              {filteredForModal.map((e) => {
                const shiftReadable =
                  e.shift === "Missing" || !e.shift
                    ? "Missing Shift"
                    : `${toTime(e.shift.split(" - ")[0])} - ${toTime(
                        e.shift.split(" - ")[1]
                      )}`;

                return (
                  <div key={e._uid} className="modalEmployeeItem">
                    <input
                      type="checkbox"
                      checked={!!e.selected}
                      onChange={() => {
                        setModalEmployees(prev =>
                          prev.map(emp =>
                            emp._uid === e._uid
                              ? { ...emp, selected: !emp.selected }
                              : emp
                          )
                        );
                      }}
                    />
                    <span style={{ flex: 2 }}>{e.name}</span>
                    <span style={{ flex: 1 }}>{e.role || "N/A"}</span>
                    <span style={{ flex: 1 }}>{e.position || "N/A"}</span>
                    <span style={{ flex: 1 }}>{shiftReadable}</span>
                  </div>
                );
              })}
            </div>

            {modalMode === "batchEdit" && (
              <div className="batchShiftInputs">
                <label>
                  Shift Start:
                  <input
                    type="time"
                    value={modalShiftStart}
                    onChange={(e) => setModalShiftStart(e.target.value)}
                  />
                </label>
                <label>
                  Shift End:
                  <input
                    type="time"
                    value={modalShiftEnd}
                    onChange={(e) => setModalShiftEnd(e.target.value)}
                  />
                </label>
              </div>
            )}

            <div className="modalFooter">
              <button className="btn btn-cancel" onClick={closeModal}>
                Cancel
              </button>

              {modalMode === "addToShift" && (
                <button className="addBtn" onClick={handleAddToShift}>
                  Add Selected
                </button>
              )}

              {modalMode === "batchEdit" && (
                <button className="addBtn" onClick={handleBatchEdit}>
                  Update Shifts
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Shifting;