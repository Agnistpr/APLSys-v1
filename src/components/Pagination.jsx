import React, { useState } from "react";

const Pagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  totalItems,
}) => {
  const [jumpPage, setJumpPage] = useState('');
  const [showJumpInput, setShowJumpInput] = useState(false);

  const renderPages = () => {
    if (totalPages === 0) return null;
    const pages = [];

    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 2) pages.push(1, 2, 'ellipsis', totalPages);
      else if (currentPage >= totalPages - 1) pages.push(1, 'ellipsis', totalPages - 1, totalPages);
      else pages.push(1, currentPage, 'ellipsis', totalPages);
    }

    return pages.map((page, idx) => {
      if (page === 'ellipsis') {
        if (showJumpInput) {
          return (
            <input
              key="jumpInput"
              className="paginationJumpInput"
              type="number"
              min={1}
              max={totalPages}
              autoFocus
              value={jumpPage}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (/^\d+$/.test(val) && Number(val) <= totalPages)) {
                  setJumpPage(val);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const pageNum = Number(jumpPage);
                  if (pageNum >= 1 && pageNum <= totalPages) {
                    onPageChange(pageNum);
                    setShowJumpInput(false);
                    setJumpPage('');
                  }
                } else if (e.key === 'Escape') {
                  setShowJumpInput(false);
                  setJumpPage('');
                }
              }}
              onBlur={() => {
                setShowJumpInput(false);
                setJumpPage('');
              }}
              placeholder="Page #"
            />
          );
        } else {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="paginationEllipsis"
              onClick={() => setShowJumpInput(true)}
              title="Jump to page"
            >
              {jumpPage !== '' ? jumpPage : '...'}
            </span>
          );
        }
      } else {
        return (
          <button
            key={page}
            className={`paginationBtn ${currentPage === page ? 'currentPage' : ''}`}
            onClick={() => onPageChange(page)}
            disabled={currentPage === page}
          >
            {page}
          </button>
        );
      }
    });
  };

  return (
    <>
      <div className="paginationItems">
        <label>Items: </label>
        <select
          value={itemsPerPage === totalItems ? "all" : itemsPerPage}
          onChange={(e) => {
            const val = e.target.value;
            onItemsPerPageChange(val === "all" ? totalItems : Number(val));
            onPageChange(1);
          }}
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="all">All</option>
        </select>
      </div>

      <div className="paginationPage">
        <button
          className="paginationBtn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          &lt;
        </button>

        {renderPages()}

        <button
          className="paginationBtn"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
        >
          &gt;
        </button>
      </div>
    </>
  );
};

export default Pagination;