import React, { useEffect, useState, useMemo } from "react";
import { MdEdit } from "react-icons/md";
import DatePicker from "../components/DatePicker.jsx";
import SortDropdown from "../components/SortDropdown.jsx";
import FilterPanel from "../components/FilterPanel.jsx";
import Pagination from "../components/Pagination.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ApplicantInformation = ({ applicantId, goBack }) => {
  const [applicant, setApplicant] = useState(null);
  const [applications, setApplications] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [positionsList, setPositionsList] = useState([]);
  const [sortColumn, setSortColumn] = useState("applicationDate");
  const [sortOrder, setSortOrder] = useState("asc");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [confirmChanges, setConfirmChanges] = useState(false);
  const [pendingChange, setPendingChange] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem("applicationDate") || "";
  });

  const validationRules = {
    contact: { regex: /^\d{11}$/, message: "Contact number must be exactly 11 digits." },
    email: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email address." },
  };

  useEffect(() => {
    const fetchDeptPos = async () => {
      const result = await window.utilityAPI.getDeptPos();
      setDeptPosList(result);
    };
    fetchDeptPos();
  }, []);

  useEffect(() => {
    const fetchApplicant = async () => {
      const data = await window.applicantAPI.getApplicant(applicantId);
      if (!data) return;
      setApplicant(data);
    };

    const fetchApplications = async () => {
      setLoading(true);
      const data = await window.applicantAPI.getApplicantApplications(applicantId, selectedDate);
      setLoading(false);
      setApplications(data);
    };

    fetchApplicant();
    fetchApplications();
  }, [applicantId, selectedDate]);

  const handleEditClick = (field, value) => {
    setEditingField(field);
    setFieldValue(value);
  };

  const handleKeyDown = async (e, field) => {
    if (e.key === "Enter") {
      setEditingField(null);
      const safeValue = fieldValue.trim();

      if (validationRules[field]) {
        const { regex, message } = validationRules[field];
        if (!regex.test(safeValue)) {
          window.toast(message, "error");
          return;
        }
      }

      setPendingChange({ field, value: safeValue });
      setConfirmChanges(true);
    }
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    const { field, value } = pendingChange;

    try {
      await window.applicantAPI.updateApplicant(applicantId, field, value);
      setApplicant((prev) => ({ ...prev, [field]: value }));
      window.toast("Change saved successfully", "success");
    } catch (err) {
      console.error("Update failed:", err);
      window.toast("Database update failed.", "error");
    } finally {
      setEditingField(null);
      setConfirmChanges(false);
      setPendingChange(null);
    }
  };

  const renderEditableField = (label, field, type = "text") => {
    return (
      <p key={field} className="editableField">
        <strong>{label}:</strong>{" "}
        {editingField === field ? (
          <input
            type={type}
            value={fieldValue}
            autoFocus
            onChange={(e) => setFieldValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, field)}
            onBlur={() => setEditingField(null)}
          />
        ) : (
          <>
            {applicant[field] || "—"}
            <MdEdit className="editIcon" onClick={() => handleEditClick(field, applicant[field])} />
          </>
        )}
      </p>
    );
  };

  const filePicker = async () => {
    try {
      const filePaths = await window.fileAPI.selectFile({ type: "images", multi: false });
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        const filePath = filePaths[0];
        const fileData = await window.fileAPI.readFileAsBase64(filePath);
        const fileExt = filePath.split(".").pop().toLowerCase();
        const base64Data = `data:image/${fileExt};base64,${fileData}`;

        setUploadMessage("Uploading...");
        const res = await window.applicantAPI.updateApplicant(applicantId, "photo", base64Data);

        if (res.success) {
          setApplicant((prev) => ({ ...prev, photo: res.imageUrl }));
          setUploadMessage("Profile image updated.");
          setIsError(false);
        } else {
          setUploadMessage("Upload failed.");
          setIsError(true);
        }
      } else {
        setUploadMessage("No image selected.");
        setIsError(true);
      }
      setTimeout(() => setUploadMessage(""), 3000);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Error uploading image.");
      setIsError(true);
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const filtered = useMemo(() => {
    return applications.filter((row) => {
      return Object.entries(selectedFilters).every(([column, values]) => {
        if (column === "__activeColumn") return true;
        if (values.length === 0) return true;
        return values.includes(row[column]);
      });
    });
  }, [applications, selectedFilters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn] ?? "";
      const bVal = b[sortColumn] ?? "";
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filtered, sortColumn, sortOrder]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  if (!applicant) return <div className="loadingContainer"><div className="spinner"></div></div>;

  return (
    <div className="applicantInfoContainer">
      <div className="applicantInfoHeader">
        <h2>Applicant Profile</h2>
        <button onClick={goBack}>x</button>
      </div>

      <div className="applicantInfoGrid">
        <div className="applicantInfoPhoto">
          <div className="ImageContainer" onClick={filePicker}>
            {applicant.photo ? (
              <img src={applicant.photo} alt="Profile" className="previewImage" />
            ) : (
              <div className="placeholderPhoto" />
            )}
          </div>
        </div>

        <div className="applicantInfoMeta">
          <div className="applicantInfoName">
            {applicant.applicantId} | {applicant.name}
          </div>
          <div className="applicantInfoDetails">
            {renderEditableField("Position Applied", "positionApplied")}
            {renderEditableField("Contact", "contact")}
            {renderEditableField("Email", "email")}
            {renderEditableField("Address", "address")}
            {renderEditableField("Application Date", "applicationDate", "date")}
            {renderEditableField("Status", "status")}
          </div>
        </div>
      </div>

      <div className="applicationsHeaderRow">
        <h1>Application History</h1>
        <div className="applicationsControls">
          <SortDropdown
            columns={["positionApplied", "applicationDate", "status"]}
            columnLabelMap={{
              positionApplied: "Position",
              applicationDate: "Date",
              status: "Status",
            }}
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
            uniqueValues={{ status: ["Pending", "Accepted", "Rejected"] }}
            columnLabelMap={{ status: "Status" }}
          />

          <DatePicker
            value={selectedDate}
            onChange={(val) => {
              setSelectedDate(val);
              localStorage.setItem("applicationDate", val);
              setCurrentPage(1);
            }}
            storageKey="applicationDate"
          />
        </div>
      </div>

      <div className="tableContainer">
        <table className={`tabTable ${loading ? "skeleton" : ""}`}>
          <thead>
            <tr>
              <th>Position</th>
              <th>Application Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: itemsPerPage }).map((_, idx) => (
                <tr key={idx} className="skeletonRow">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <td key={i}><div className="shimmerCell" /></td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr><td colSpan={3}>No records found.</td></tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.positionApplied}</td>
                  <td>{new Date(row.applicationDate).toLocaleDateString()}</td>
                  <td>{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      <ConfirmModal
        open={confirmChanges}
        title="Confirm Changes"
        message="Are you sure you want to save this change?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={handleConfirmChange}
        onCancel={() => {
          setConfirmChanges(false);
          setPendingChange(null);
        }}
      />
    </div>
  );
};

export default ApplicantInformation;