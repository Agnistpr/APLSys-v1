import React, { useRef, useEffect } from "react";
import { FaSortAmountDownAlt, FaSortAmountUp } from "react-icons/fa";

const SortDropdown = ({
  columns,
  columnLabelMap,
  sortColumn,
  sortOrder,
  onSortChange,
  dropdownOpen,
  setDropdownOpen,
}) => {
  const sortRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="sortContainer" ref={sortRef}>
      <div
        className="sortIcon"
        onClick={() => onSortChange(sortColumn, sortOrder === "asc" ? "desc" : "asc")}
      >
        {sortOrder === "asc" ? <FaSortAmountDownAlt /> : <FaSortAmountUp />} |
      </div>

      <div className="sortText" onClick={() => setDropdownOpen((prev) => !prev)}>
        Sort: {columnLabelMap[sortColumn]}
      </div>

      {dropdownOpen && (
        <div className="tabSortOptions">
          {columns.map((col) => (
            <div key={col} onClick={() => onSortChange(col, sortOrder)}>
              {columnLabelMap[col]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SortDropdown;