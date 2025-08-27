import React from 'react';
import Sidebar from '../components/Sidebar.jsx';

const templateList = [
  'Non-Disclosure Agreement',
  'Summary Report',
  'Evaluation Form',
  'Shifting Schedule',
  'Assessment Form'
];

const recentDocuments = Array(8).fill({
  name: 'Document Name',
  filingDate: 'Date of filing:',
  disposalDate: 'Date of disposal:'
});

const DocumentManagement = () => {
  return (
    <div className="docContainer">
      <div className="docContent">
        <h1 className="docTitle">Document Management</h1>

        <div className="docSection">
          <div className="docSectionHeader">
            <span>Templates</span>
            <button className="galleryButton">Template gallery ⌄</button>
          </div>
          <div className="templateList">
            {templateList.map((template, idx) => (
              <div className="templateCard" key={idx}>
                <div className="templatePreview"></div>
                <span className="templateName">{template}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="docSection">
          <div className="docSectionHeader">
            <span>Recent Documents</span>
            <button className="filterButton">Filter ⌄</button>
          </div>
          <div className="documentGrid">
            {recentDocuments.map((doc, idx) => (
              <div className="documentCard" key={idx}>
                <div className="docPreview"></div>
                <div className="docInfo">
                  <strong>{doc.name}</strong>
                  <p>{doc.filingDate}</p>
                  <p>{doc.disposalDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManagement;
