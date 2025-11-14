import React from 'react';

const shiftSections = ['Cutting', 'Extrusion', 'Printing', 'Slitting', 'Quality Assurance', 'Delivery'];

const employeeData = [
  {
    id: '001',
    name: 'John Zhongli',
    machine: 'C01'
  },
  {
    id: '001',
    name: 'John Zhongli',
    machine: 'C01'
  },
  {
    id: '001',
    name: 'John Zhongli',
    machine: 'C01'
  },
  {
    id: '001',
    name: 'John Zhongli',
    machine: 'C01'
  },
  {
    id: '001',
    name: 'John Zhongli',
    machine: 'C01'
  }
];

const Shifting = () => {
  return (
    <div className="shiftingContainer">
      <div className="shiftingContent">
        <div className="shiftingHeader">
          <h1>Shifting Schedule</h1>
          <div className="shiftingControls">
            <button className="exportBtn">Export</button>
            <div className="timeBox">
              8:00 AM - 6:00 PM
              <span className="calendarIcon">📅</span>
            </div>
          </div>
        </div>
        <div className="shiftGrid">
          {shiftSections.map((section, index) => (
            <div className="shiftCard" key={index}>
              <div className="cardHeader">
                <span>{section}</span>
                <button className="addBtn">+</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>ID #</th>
                    <th>Full Name</th>
                    <th>Machine #</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeData.map((emp, i) => (
                    <tr key={i}>
                      <td>{emp.id}</td>
                      <td>{emp.name}</td>
                      <td>{emp.machine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Shifting;