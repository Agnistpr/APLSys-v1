import React, { useEffect, useState, useMemo, useRef } from "react";
import { FiEdit, FiTrash2, FiPlus } from "react-icons/fi";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const InventoryComponent = ({ uid, setActivePage, setSelectedEmployeeId }) => {
  const [logs, setLogs] = useState([]);
  const [cardData, setCardData] = useState([]);
  const [profiles, setProfiles] = useState([]);
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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [editForm, setEditForm] = useState({
    itemid: "",
    itemname: "",
    quantity: "",
    profileid: "",
    role: "Employee",
  });
  const [addForm, setAddForm] = useState({
    itemname: "",
    quantity: "",
  });
  const [editSearchTerm, setEditSearchTerm] = useState("");
  const suggestionRef = useRef(null);

  const columns = ["name", "department", "position", "itemname", "quantity", "date"];
  const columnLabelMap = {
    name: "Name",
    department: "Department",
    position: "Position",
    itemname: "Item",
    quantity: "Quantity",
    date: "Date",
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const data = await window.inventoryAPI.getInventoryLogs(selectedDate?.trim() || "");
        setLogs(data || []);
      } catch {
        window.toast("Failed to load inventory logs", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [selectedDate]);

  useEffect(() => {
    const fetchCardData = async () => {
      try {
        const data = await window.inventoryAPI.getInventoryCard();
        setCardData(data || []);
      } catch {
        window.toast("Failed to load inventory summary", "error");
      }
    };
    fetchCardData();
  }, []);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const emps = await window.employeeAPI.getEmployees();

        const statusesToInclude = ["Pending", "Interview", "Training"];
        let allApplicants = [];

        for (const status of statusesToInclude) {
          const batch = await window.applicantAPI.getApplicants(status);
          if (Array.isArray(batch)) allApplicants.push(...batch);
        }

        const profiles = [
          ...(emps || []).map(e => ({
            profileid: e.employeeid,
            name: e.name,
            department: e.department,
            position: e.position,
            role: "Employee",
          })),
          ...(allApplicants || []).map(a => ({
            profileid: a.applicantid,
            name: a.fullname,
            department: a.department,
            position: a.position,
            role: "Applicant",
          })),
        ];

        setProfiles(profiles);
      } catch (err) {
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFilters, selectedDate]);

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

  const filtered = useMemo(() => {
    return logs.filter((row) => {
      const matchesSearch = Object.values(row).some((val) =>
        String(val || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
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

  const refreshData = async () => {
    const updated = await window.inventoryAPI.getInventoryCard();
    setCardData(updated || []);
    const newLogs = await window.inventoryAPI.getInventoryLogs(selectedDate?.trim() || "");
    setLogs(newLogs || []);
  };

  const handleAddItem = async () => {
    try {
      const added = await window.inventoryAPI.addItem({
        itemname: addForm.itemname,
        quantity: Number(addForm.quantity) || 0,
      });
      if (!added || !added.itemid) throw new Error("Add failed");
      window.toast("Item added successfully!", "success");
      setAddModalOpen(false);
      setAddForm({ itemname: "", quantity: "" });
      await refreshData();
      await window.userAPI.logAction(uid, "added new item", `${addForm.itemname} (${addForm.quantity})`);
    } catch {
      window.toast("Failed to add item", "error");
    }
  };

  const handleEditItem = async () => {
    try {
      const payload = {
        itemid: Number(editForm.itemid),
        itemname: editForm.itemname,
        quantity: Number(editForm.quantity) || 0,
      };

      const res = await window.inventoryAPI.updateItem(payload);
      if (!res || res.success === false) {
        throw new Error(res?.error || "Update failed");
      }

      const oldQty = Number(editForm.originalQuantity);
      const newQty = Number(editForm.quantity);
      const qtyChange = oldQty - newQty;

      const logPayload = {
        itemid: payload.itemid,
        profileid: editForm.profileid || null,
        quantity: qtyChange,
        role: editForm.role || "Employee",
      };

      const logRes = await window.inventoryAPI.addInventoryLog(logPayload);

      if (!logRes || logRes.success === false) {
        window.toast("Item updated, but failed to record log.", "warning");
      } else {
        window.toast("Item updated successfully!", "success");
      }

      setEditModalOpen(false);
      setEditForm({
        itemid: "",
        itemname: "",
        quantity: "",
        originalQuantity: "",
        profileid: "",
        role: "Employee",
      });
      await refreshData();
      await window.userAPI.logAction(uid, "edited item", editForm.itemname);
    } catch (err) {
      window.toast(err?.message || "Failed to update item", "error");
    }
  };

  const handleDeleteItem = (itemid, itemname) => {
    setPendingDelete({ itemid, itemname });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      if (!pendingDelete) return;
      const res = await window.inventoryAPI.deleteItem(pendingDelete.itemid);
      if (res && res.success === false) throw new Error(res.error || "Delete failed");
      window.toast(`Deleted "${pendingDelete.itemname}"`, "success");
      await refreshData();
      await window.userAPI.logAction(uid, "deleted item", pendingDelete.itemname);
    } catch {
      window.toast("Failed to delete item", "error");
    } finally {
      setPendingDelete(null);
      setConfirmOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setEditSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editSuggestions = useMemo(() => {
    const role = editForm.role || "Employee";
    const q = (editSearchTerm || "").toLowerCase();
    const result = profiles
      .filter((p) => p.role === role)
      .filter((p) => (p.name || "").toLowerCase().includes(q))
      .slice(0, 10);

    return result;
  }, [profiles, editForm.role, editSearchTerm]);

  return (
    <div className="tabSection">
      <div className="inventoryRow">
        <div className="tabTitleGroup">
          <h2 className="tabTitle">Inventory</h2>
          <button className="exportBtn" onClick={() => window.exportAPI.exportInventory()}>
            Export
          </button>
        </div>
        <button className="addBtn" onClick={() => setAddModalOpen(true)}>
          <FiPlus /> Add Item
        </button>
      </div>

      <div className="tabCards" style={{ scrollBehavior: "smooth" }}>
        {cardData.map((row, idx) => (
          <div key={row.itemid ?? idx} className="dashboardCards">
            <div className="cardBody">
              <div className="cardTitle">{row.itemname}</div>
              <div className="cardValue">{row.quantity}</div>
            </div>
            <button
              className="deleteCardBtn floating"
              onClick={() => handleDeleteItem(row.itemid, row.itemname)}
              title="Delete item"
            >
              <FiTrash2 />
            </button>
            <div className="cardFooter">
              Last Modified: {row.lastmodified ? new Date(row.lastmodified).toLocaleDateString() : "—"}
              <div className="flex gap-2">
                <button
                  className="editCardBtn"
                  onClick={() => {
                    setEditForm({
                      itemname: row.itemname,
                      quantity: row.quantity,
                      itemid: row.itemid,
                      profileid: "",
                      role: "Employee",
                    });
                    setEditModalOpen(true);
                  }}
                  title="Edit item"
                >
                  <FiEdit />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
            onChange={(val) => {
              setSelectedDate(val);
              localStorage.setItem("inventoryDate", val);
            }}
            storageKey="inventoryDate"
          />
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

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
              <tr><td colSpan={columns.length}>Loading...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={columns.length}>No records found.</td></tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.name}</td>
                  <td>{row.department}</td>
                  <td>{row.position}</td>
                  <td>{row.itemname}</td>
                  <td>{row.quantity}</td>
                  <td>{row.date ? new Date(row.date).toLocaleDateString() : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

      <ConfirmModal
        open={confirmOpen}
        title="Delete Item"
        message={`Are you sure you want to delete "${pendingDelete?.itemname}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />

      {addModalOpen && (
        <div className="modalOverlay" onClick={(e) => {
          if (e.target.classList.contains("modalOverlay")) setAddModalOpen(false);
        }}>
          <div className="modalContent">
            <h3>Add New Item</h3>
            <label>Item Name</label>
            <input
              type="text"
              value={addForm.itemname}
              onChange={(e) => setAddForm({ ...addForm, itemname: e.target.value })}
            />
            <label>Quantity</label>
            <input
              type="number"
              value={addForm.quantity}
              onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
            />
            <div className="modalActions">
              <button onClick={() => setAddModalOpen(false)}>Cancel</button>
              <button onClick={handleAddItem}>Add</button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="modalOverlay" onClick={(e) => {
          if (e.target.classList.contains("modalOverlay")) setEditModalOpen(false);
        }}>
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
            <label>Role</label>
            <select
              value={editForm.role}
              onChange={(e) => {
                setEditForm({ ...editForm, role: e.target.value, profileid: "" });
                setEditSearchTerm("");
              }}
            >
              <option value="Employee">Employee</option>
              <option value="Applicant">Applicant</option>
            </select>
            <label>Associate With (search)</label>
            <div className="employeeSearchBox" ref={suggestionRef}>
              <input
                type="text"
                className="searchInput"
                placeholder={`Search ${editForm.role}s by name...`}
                value={editSearchTerm}
                onChange={(e) => setEditSearchTerm(e.target.value)}
              />
              {editSearchTerm && editSuggestions.length > 0 && (
                <ul className="suggestionList">
                  {editSuggestions.map((p) => (
                    <li
                      key={p.profileid}
                      className={`suggestionItem ${String(editForm.profileid) === String(p.profileid) ? "selected" : ""}`}
                      onClick={() => {
                        setEditForm({ ...editForm, profileid: p.profileid });
                        setEditSearchTerm("");
                      }}
                    >
                      <strong>{p.name}</strong>
                      <span>{p.department} • {p.position}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {editForm.profileid && (
              <div className="selectedProfileTag">
                Assigned to:{" "}
                <strong>
                  {profiles.find(
                    (p) => String(p.profileid) === String(editForm.profileid) && p.role === editForm.role
                  )?.name || "Selected"}
                </strong>
                <button
                  onClick={() => setEditForm({ ...editForm, profileid: "" })}
                  style={{ marginLeft: 8 }}
                >
                  ✕
                </button>
              </div>
            )}
            <div className="modalActions">
              <button onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button onClick={handleEditItem}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryComponent;