import React, { useEffect, useState, useMemo } from "react";
import { FiEdit } from "react-icons/fi";
import ImportModal from "../components/Import.jsx";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";

const InventoryComponent = ({ uid, setActivePage, setSelectedEmployeeId }) => {
  // --- State ---
  const [logs, setLogs] = useState([]);
  const [cardData, setCardData] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => localStorage.getItem("inventoryDate") || "");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ itemid: "", itemname: "", quantity: "" });

  // --- Columns ---
  const columns = ["name", "department", "position", "itemname", "quantity", "date"];
  const columnLabelMap = {
    name: "Name",
    department: "Department",
    position: "Position",
    itemname: "Item",
    quantity: "Quantity",
    date: "Date",
  };

  // --- Fetch Logs & Cards ---
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const data = await window.inventoryAPI.getInventoryLogs(selectedDate?.trim() || "");
      setLogs(data);
      setLoading(false);
    };
    fetchLogs();
  }, [selectedDate]);

  useEffect(() => {
    const fetchCardData = async () => {
      const data = await window.inventoryAPI.getInventoryCard();
      setCardData(data);
    };
    fetchCardData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters, selectedDate]);

  // --- Unique Filter Values ---
  const uniqueValues = useMemo(() => {
    const values = { department: new Set(), position: new Set(), itemname: new Set() };
    logs.forEach((r) => {
      values.department.add(r.department || "");
      values.position.add(r.position || "");
      values.itemname.add(r.itemname || "");
    });
    return {
      department: Array.from(values.department),
      position: Array.from(values.position),
      itemname: Array.from(values.itemname),
    };
  }, [logs]);

  // --- Filtered, Sorted, Paginated ---
  const filtered = useMemo(() => {
    return logs.filter((row) => {
      const matchesSearch = Object.values(row)
        .some((val) => String(val || "").toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilters = Object.entries(selectedFilters).every(([col, vals]) => {
        return col === "__activeColumn" || !vals.length || vals.includes(row[col] || "");
      });
      return matchesSearch && matchesFilters;
    });
  }, [logs, searchTerm, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? "";
      const bVal = b[sortColumn] ?? "";
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  // --- Render ---
  return (
    <div className="tabSection">
      {/* ====== Inventory Cards ====== */}
      <div className="inventoryRow">
        <h2 className="tabTitle">Inventory</h2>
        <button className="exportBtn" onClick={() => window.exportAPI.exportInventory()}>
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
              Last Modified:{" "}
              {row.lastmodified ? new Date(row.lastmodified).toLocaleDateString() : "—"}
              <button
                className="editCardBtn"
                onClick={() => {
                  setEditForm({
                    itemid: row.itemid,
                    itemname: row.itemname,
                    quantity: row.quantity,
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

      {/* ====== Logs Section ====== */}
      <div className="tabHeaderRow">
        <h2 className="tabTitle">Inventory Logs</h2>
        <div className="tabControls">
          <SortDropdown
            columns={columns}
            columnLabelMap={columnLabelMap}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSortChange={(col, order) => {
              setSortColumn(col);
              setSortOrder(order);
            }}
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
          />

          <FilterPanel
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            uniqueValues={uniqueValues}
            columnLabelMap={columnLabelMap}
          />

          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            storageKey="inventoryDate"
          />

          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      {/* ====== Table ====== */}
      <div className="tableContainer">
        <table className={`tabTable ${loading ? "skeleton" : ""}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{columnLabelMap[col]}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: itemsPerPage }).map((_, idx) => (
                <tr key={idx} className="skeletonRow">
                  {columns.map((_, i) => (
                    <td key={i}>
                      <div className="shimmerCell" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>No records found.</td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr
                  key={idx}
                  onDoubleClick={() => {
                    setSelectedEmployeeId(row.employeeid);
                    setActivePage("EmployeeInformation");
                  }}
                >
                  <td>{row.name}</td>
                  <td>{row.department}</td>
                  <td>{row.position}</td>
                  <td>{row.itemname}</td>
                  <td>{row.quantity}</td>
                  <td>
                    {row.date
                      ? new Date(row.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ====== Footer ====== */}
      <div className="tableFooter">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={logs.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onExport={() => window.exportAPI.exportInventoryLogs(selectedDate)}
        />
      </div>

      {/* ====== Edit Modal ====== */}
      {editModalOpen && (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target.classList.contains("modalOverlay")) {
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
                  await window.inventoryAPI.updateItem(editForm);
                  setEditModalOpen(false);
                  const updated = await window.inventoryAPI.getInventoryCard();
                  setCardData(updated);

                  if (oldItem) {
                    const diffs = [];
                    const labelMap = { itemname: "Item Name", quantity: "Quantity" };
                    for (const key of Object.keys(labelMap)) {
                      const oldVal = String(oldItem[key] ?? "");
                      const newVal = String(editForm[key] ?? "");
                      if (oldVal !== newVal) diffs.push(`${labelMap[key]}: "${oldVal}" → "${newVal}"`);
                    }
                    if (diffs.length) {
                      const description = diffs.map((d) => `- ${d}`).join("\n");
                      await window.userAPI.logAction(uid, `edited item "${oldItem.itemname}"`, description);
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
