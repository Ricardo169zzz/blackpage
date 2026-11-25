const { handleRequest } = require("../server");

module.exports = async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ status: "error", message: err?.message || "Internal Server Error" }));
    }
  }
};
