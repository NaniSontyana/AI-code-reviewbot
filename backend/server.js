const express=require('express');
require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend Gateway running on http://localhost:${PORT}`);
});