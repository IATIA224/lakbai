import React, { useState } from 'react';
import './updatecsv.css';

const UpdateCSV = () => {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use the file name as the key in the DB
      const res = await fetch(`/api/files/${file.name}`, {
        method: 'PUT',
        body: formData
      });

      const data = await res.json();
      if (data.ok) {
        alert(`Upload successful: ${file.name}`);
      } else {
        alert('Upload failed: ' + (data.error || JSON.stringify(data)));
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    }
  };

  return (
    <div className="updatecsv-root">
      <div className="updatecsv-header">
        <div>
          <div className="updatecsv-title">Update CSV</div>
          <div className="updatecsv-desc">Select a fare CSV to update fare data. Upload is mock — add server logic as needed.</div>
        </div>
      </div>

      <div className="updatecsv-input-row">
        <label className="updatecsv-file">
          <input type="file" accept=".csv" onChange={handleFileChange} />
          {file ? file.name : "Choose CSV file…"}
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="updatecsv-btn primary" onClick={handleUpload}>Upload</button>
          <button className="updatecsv-btn ghost" onClick={() => setFile(null)}>Clear</button>
        </div>
      </div>

      <div className="updatecsv-preview" aria-live="polite">
        {file ? `Selected file: ${file.name}\n\nSize: ${file.size} bytes` : 'No file selected.'}
      </div>
    </div>
  );
};

export default UpdateCSV;
