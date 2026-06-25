const express=require('express');
require('dotenv').config();

const app=require('./src/app');

const PORT =process.env.PORT || 5000;
console.log(app);
app.listen(PORT,()=>{
  console.log(`server running on port ${PORT}`);
});