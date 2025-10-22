import React from "react";

const SkeletonLoader = ({ columns = 10, rows = 5 }) => {
  const headerColumns = Array.from({ length: columns });
  const bodyRows = Array.from({ length: rows });

  return (
    <div className="skeletonTable">
      <div className="skeletonTableHeader">
        {headerColumns.map((_, i) => (
          <div key={i} className="skeleton skeleton-header" />
        ))}
      </div>

      <div className="skeletonTableBody">
        {bodyRows.map((_, rowIdx) => (
          <div key={rowIdx} className="skeletonTableRow">
            {headerColumns.map((_, colIdx) => (
              <div key={colIdx} className="skeleton" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;