require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.error(err));

app.get('/', (req, res) => {
  res.send('API running');
});

app.listen(3000, () => console.log("Server running on port 3000"));