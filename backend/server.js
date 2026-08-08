require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const vacanciesRouter = require('./routes/vacancies');
const leadsRouter = require('./routes/leads');
const pitchRouter = require('./routes/pitch');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/vacancies', vacanciesRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/pitch', pitchRouter);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Smart Leads Agent API running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
