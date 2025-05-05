const express = require('express');
const path = require('path');
const app = express();

app.get('/', (req, res) => {
    console.log('Serving homepage.html');
    res.sendFile(path.join(__dirname, 'homepage.html'));
});

app.use(express.static(path.join(__dirname, '.')));

const port = 8080;
app.listen(port, () => {
    console.log(`Medora frontend server running at http://localhost:${port}`);
});
