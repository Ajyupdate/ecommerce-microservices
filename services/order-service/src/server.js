const app = require('./app');

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Order Service listening on port ${PORT}`);
});