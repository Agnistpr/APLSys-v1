import React, { useRef, useState, useEffect } from "react";
import { FaFilter } from "react-icons/fa";

const FilterPanel = ({
  filterOpen,
  setFilterOpen,
  selectedFilters,
  setSelectedFilters,
  uniqueValues,
  columnLabelMap,
}) => {
  const filterRef = useRef(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [pinnedColumn, setPinnedColumn] = useState(null);
  const [hoveringPanel, setHoveringPanel] = useState(false);
  const hoverTimeout = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
        setHoveredColumn(null);
        setPinnedColumn(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const clearFilters = () => setSelectedFilters({});

  const toggleFilterValue = (column, value) => {
    setSelectedFilters((prev) => {
      const current = prev[column] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [column]: updated };
    });
  };

  const handleColumnHover = (col) => {
    clearTimeout(hoverTimeout.current);
    setHoveredColumn(col);
  };

  const handleColumnLeave = () => {
    // Delay clearing to allow panel hover
    hoverTimeout.current = setTimeout(() => {
      if (!hoveringPanel && !pinnedColumn) setHoveredColumn(null);
    }, 100);
  };

  const handlePanelEnter = () => {
    clearTimeout(hoverTimeout.current);
    setHoveringPanel(true);
  };

  const handlePanelLeave = () => {
    setHoveringPanel(false);
    if (!pinnedColumn) setHoveredColumn(null);
  };

  const activeColumn = pinnedColumn || hoveredColumn;

  return (
    <div className="filterContainer" ref={filterRef}>
      <button
        className="filterBtn"
        onClick={() => setFilterOpen((prev) => !prev)}
      >
        <FaFilter />
      </button>

      {filterOpen && (
        <>
          <div className="filterDropdown">
            <div className="filterHeader">
              <strong>Filter by</strong>
              <button className="clearFilterBtn" onClick={clearFilters}>
                Clear
              </button>
            </div>

            <div className="filterColumns">
              {Object.keys(uniqueValues).map((col) => (
                <div
                  key={col}
                  className={`filterColumnName ${
                    selectedFilters[col]?.length ? "activeColumn" : ""
                  }`}
                  onMouseEnter={() => handleColumnHover(col)}
                  onMouseLeave={handleColumnLeave}
                  onClick={() => {
                    setPinnedColumn((prev) => {
                      if (prev === col) {
                        setHoveredColumn(null);
                        return null;
                      } else {
                        setHoveredColumn(col);
                        return col;
                      }
                    });
                  }}
                >
                  {columnLabelMap[col]}
                  <span className="chevronIcon">&gt;</span>
                </div>
              ))}
            </div>
          </div>

          {activeColumn && (
            <div
              className="filterValuesPanel"
              onMouseEnter={handlePanelEnter}
              onMouseLeave={handlePanelLeave}
            >
              <div className="filterValuesHeader">{columnLabelMap[activeColumn]}</div>
              <div className="filterValuesList">
                {uniqueValues[activeColumn]?.map((val) => (
                  <label key={val} className="filterValueItem">
                    <input
                      type="checkbox"
                      checked={selectedFilters[activeColumn]?.includes(val) || false}
                      onChange={() => toggleFilterValue(activeColumn, val)}
                    />
                    {val || "—"}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FilterPanel;