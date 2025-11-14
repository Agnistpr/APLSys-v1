import React from "react";
import { FiSearch } from "react-icons/fi";
import { MdClear } from "react-icons/md";

const SearchBar = ({ value, onChange }) => (
  <div className="tabSearchContainer">
    <input
      type="text"
      placeholder="Search..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    <span className="searchIconBtn">
      <FiSearch />
    </span>
    {value && (
      <button onClick={() => onChange("")}>
        <MdClear />
      </button>
    )}
  </div>
);

export default SearchBar;
