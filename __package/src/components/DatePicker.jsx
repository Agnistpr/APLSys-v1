import React from "react";

const DatePicker = ({ value, onChange, storageKey = "genericDate" }) => {
  const handleChange = (e) => {
    const newVal = e.target.value;
    onChange(newVal);
    localStorage.setItem(storageKey, newVal);
  };

  return (
    <div className="calendarContainer">
      <input type="date" value={value} onChange={handleChange} />
    </div>
  );
};

export default DatePicker;
