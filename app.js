const express = require('express')
const path = require('path')
const fs = require('fs')
const app = express()
const PORT = 5000;

app.use(express.static(path.join(__dirname, 'public')))

app.get('/',(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/about',(req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'about.html'))
})

app.get('/nations', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/nations/nations.json'));
  res.json(data);
});

app.listen(5000, ()=>{console.log(`Server is running on http://localhost:5000`)})