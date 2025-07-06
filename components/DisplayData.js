// src/components/DisplayData.js

import React, { useEffect, useState } from 'react';
import { db } from '../firebase';

const DisplayData = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const unsubscribe = db.collection('data')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        setData(snapshot.docs.map(doc => doc.data()));
      });
    return unsubscribe;
  }, []);

  return (
    <div>
      <h2>Data</h2>
      {data.map((item, index) => (
        <p key={index}>{item.content}</p>
      ))}
    </div>
  );
};

export default DisplayData;