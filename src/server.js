const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server properti-indahweb is running on http://localhost:${PORT}`);
});
