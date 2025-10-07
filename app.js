const express = require('express')
const path = require('path')
const app = express()
const PORT = 5000;

app.use(express.static(path.join(__dirname, 'public')))

app.get('/',(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/about',(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'about.html'))
})

app.listen(5000, ()=>{console.log(`Server is running on http://localhost:5000`)})