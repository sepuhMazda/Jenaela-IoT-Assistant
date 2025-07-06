// src/components/AddData.js

import React, { useState } from 'react';
import { db } from '../firebase';

const AddData = () => {
  const [data, setData] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await db.collection('data').add({
        content: data,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      setData('');
    } catch (error) {
      console.error("Error adding document: ", error);
    }
  };

  return (
    <div>
      <h2>Add Data</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter data"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default AddData;