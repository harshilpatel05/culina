const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (_req, res) => {
	res.json({ status: "ok", message: "Culina backend is running" });
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});