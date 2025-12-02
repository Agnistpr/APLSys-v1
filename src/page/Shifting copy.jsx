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

  // ❗ Each shift card has its own pagination
  const [pageState, setPageState] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Reset ALL pagination when filtering or searching
  useEffect(() => {
    setPageState({});
  }, [selectedFilters, searchTerm]);

  // Unique values for filtering
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

  // Filtering
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

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortColumn] ?? "";
      let bVal = b[sortColumn] ?? "";

      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [filtered, sortColumn, sortOrder]);

  // Grouping (done before card pagination)
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

  // Shift ordering
  const shiftKeys = Object.keys(grouped);

  const normalShiftKeys = shiftKeys
    .filter((k) => k !== "Missing Shift")
    .sort((a, b) => {
      const getMS = (str) => new Date("1970/01/01 " + str.split(" - ")[0]).getTime();
      return getMS(a) - getMS(b);
    });

  const missingShiftKey = shiftKeys.includes("Missing Shift") ? "Missing Shift" : null;

  // Helper: per-card slice
  const getPaginatedRows = (shiftKey) => {
    const page = pageState[shiftKey] || 1;
    const start = (page - 1) * itemsPerPage;
    return grouped[shiftKey].slice(start, start + itemsPerPage);
  };

  const setCardPage = (shift, p) =>
    setPageState((prev) => ({ ...prev, [shift]: p }));

  return (
    <div className="shiftContainer">
      <div className="shiftHeaderRow">
        <h1>Shifting Schedule</h1>

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

      {/* NORMAL SHIFT GRID */}
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

      {/* MISSING SHIFT OUTSIDE THE GRID */}
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
  );
};

export default Shifting;